/*
 * One fixed step of Drone Wall: waves start and end, soldiers march and aircraft fly in, trenches
 * slow and mine the soldiers, defenses pick targets and fire, drones, missiles and mortar shells
 * land, fallen enemies drop helmets that collect themselves, and anyone who reaches the line costs
 * a heart. All randomness comes from the Random passed in.
 */
import type { Random } from '#lib/game/random.js';
import {
	FLYERS,
	LINE_Y,
	PREP_MS,
	SLOTS,
	SOLDIERS,
	SQUAD_AIR_FACTOR,
	WORLD_WIDTH,
	defenseStats,
	hpScale,
	type Point
} from './config';
import { collectHelmets, dropHelmet } from './economy';
import { ROAD, distanceBetween, pointAt } from './path';
import { flyProjectiles, launchFpv, launchMissile } from './projectiles';
import type { DroneWallEvent, DroneWallState, Flyer, Soldier } from './state';
import {
	incomingDamage,
	mineDpsAt,
	pickAirTarget,
	pickMortarAim,
	pickNestTarget,
	pickPatriotTarget,
	pickSquadTarget,
	remainingDistance,
	slowAt,
	splashDamage
} from './targeting';
import {
	generateWave,
	isFlyerSpawn,
	type FlyerSpawn,
	type SoldierSpawn,
	type SpawnEntry
} from './waves';

/** Score for clearing a wave grows with the wave number */
export function waveBonus(wave: number): number {
	return 20 + 10 * wave;
}

/** Aerial enemies enter this far above the field and leave the road alone */
const FLYER_ENTRY_Y = -30;
/** Aerial enemies fly toward a point on the line, within this much of the field's sides */
const FLIGHT_MARGIN = 30;
const WOBBLE = 7;

export function spawnSoldier(state: DroneWallState, entry: SoldierSpawn): Soldier {
	const stats = SOLDIERS[entry.kind];
	const maxHp = Math.round(stats.hp * hpScale(state.wave));
	const start = pointAt(ROAD, 0);
	const soldier: Soldier = {
		id: state.nextId++,
		kind: entry.kind,
		progress: 0,
		hp: maxHp,
		maxHp,
		speed: stats.speed * entry.speedScale,
		lane: entry.lane,
		x: start.x,
		y: start.y,
		slow: 1,
		hitMs: 0
	};
	state.soldiers.push(soldier);
	return soldier;
}

const laneToX = (lane: number) => WORLD_WIDTH / 2 + lane * (WORLD_WIDTH / 2 - FLIGHT_MARGIN);

export function spawnFlyer(state: DroneWallState, entry: FlyerSpawn): Flyer {
	const stats = FLYERS[entry.kind];
	const maxHp = Math.round(stats.hp * hpScale(state.wave));
	const fromX = laneToX(entry.lane);
	const toX = laneToX(entry.exitLane);
	const flyer: Flyer = {
		id: state.nextId++,
		kind: entry.kind,
		air: true,
		hp: maxHp,
		maxHp,
		speed: stats.speed * entry.speedScale,
		fromX,
		toX,
		progress: 0,
		length: Math.hypot(toX - fromX, LINE_Y - FLYER_ENTRY_Y),
		phase: entry.lane * 5,
		x: fromX,
		y: FLYER_ENTRY_Y,
		hitMs: 0
	};
	state.flyers.push(flyer);
	return flyer;
}

/** Where a flyer is after flying `progress` units; the straight line plus a little wobble */
export function flyerPosition(flyer: Flyer): Point {
	const t = Math.min(1, flyer.progress / flyer.length);
	const wobble = Math.sin(flyer.progress / 38 + flyer.phase) * WOBBLE * Math.min(1, t * 6);
	return {
		x: flyer.fromX + (flyer.toX - flyer.fromX) * t + wobble,
		y: FLYER_ENTRY_Y + (LINE_Y - FLYER_ENTRY_Y) * t
	};
}

export function damageSoldier(target: Pick<Soldier, 'hp' | 'hitMs'>, amount: number) {
	if (amount <= 0 || target.hp <= 0) return;
	target.hp -= amount;
	target.hitMs = 140;
}

function startWave(state: DroneWallState, random: Random, events: DroneWallEvent[]) {
	state.wave += 1;
	state.phase = 'wave';
	state.waveMs = 0;
	state.queue = generateWave(state.wave, random);
	state.queueIndex = 0;
	events.push({ type: 'wave-started', wave: state.wave });
}

function spawnEntry(state: DroneWallState, entry: SpawnEntry, events: DroneWallEvent[]) {
	if (isFlyerSpawn(entry)) {
		spawnFlyer(state, entry);
		events.push({ type: 'flyer-spawned', kind: entry.kind });
	} else {
		spawnSoldier(state, entry);
	}
}

function updateWavePhase(
	state: DroneWallState,
	random: Random,
	dtMs: number,
	events: DroneWallEvent[]
) {
	if (state.phase === 'prep') {
		state.prepMs -= dtMs;
		if (state.prepMs <= 0) startWave(state, random, events);
		return;
	}
	state.waveMs += dtMs;
	while (
		state.queueIndex < state.queue.length &&
		state.queue[state.queueIndex].atMs <= state.waveMs
	) {
		spawnEntry(state, state.queue[state.queueIndex], events);
		state.queueIndex += 1;
	}
}

function checkWaveCleared(state: DroneWallState, events: DroneWallEvent[]) {
	if (state.phase !== 'wave' || state.queueIndex < state.queue.length) return;
	if (state.soldiers.length > 0 || state.flyers.length > 0 || state.shells.length > 0) return;
	const bonus = waveBonus(state.wave);
	state.score += bonus;
	state.phase = 'prep';
	state.prepMs = PREP_MS;
	events.push({ type: 'wave-cleared', wave: state.wave, bonus });
}

function marchSoldiers(state: DroneWallState, dtMs: number, events: DroneWallEvent[]) {
	for (const soldier of state.soldiers) {
		soldier.hitMs = Math.max(0, soldier.hitMs - dtMs);
		// Trenches slow the crowd, mines hurt it
		soldier.slow = slowAt(soldier, state.defenses);
		const dps = mineDpsAt(soldier, state.defenses);
		if (dps > 0 && soldier.y >= 0) damageSoldier(soldier, (dps * dtMs) / 1000);
		if (soldier.hp <= 0) continue;

		soldier.progress += (soldier.speed * soldier.slow * dtMs) / 1000;
		const sample = pointAt(ROAD, soldier.progress);
		soldier.x = sample.x;
		soldier.y = sample.y;
	}

	// Anyone who reached the end of the road breaches the line
	state.soldiers = state.soldiers.filter((soldier) => {
		if (soldier.hp <= 0 || soldier.progress < ROAD.length) return true;
		state.lives = Math.max(0, state.lives - 1);
		events.push({ type: 'leak', x: soldier.x, y: soldier.y });
		return false;
	});
}

function flyFlyers(state: DroneWallState, dtMs: number, events: DroneWallEvent[]) {
	for (const flyer of state.flyers) {
		flyer.hitMs = Math.max(0, flyer.hitMs - dtMs);
		if (flyer.hp <= 0) continue;
		flyer.progress += (flyer.speed * dtMs) / 1000;
		const position = flyerPosition(flyer);
		flyer.x = position.x;
		flyer.y = position.y;
	}

	state.flyers = state.flyers.filter((flyer) => {
		if (flyer.hp <= 0 || flyer.progress < flyer.length) return true;
		state.lives = Math.max(0, state.lives - 1);
		events.push({ type: 'leak', x: flyer.x, y: LINE_Y });
		return false;
	});
}

function fireDefenses(
	state: DroneWallState,
	random: Random,
	dtMs: number,
	events: DroneWallEvent[]
) {
	state.defenses.forEach((defense, slot) => {
		if (!defense || defense.kind === 'trench') return;
		defense.firedMs = Math.max(0, defense.firedMs - dtMs);
		defense.cooldownMs = Math.max(0, defense.cooldownMs - dtMs);
		if (defense.cooldownMs > 0) return;

		const origin = SLOTS[slot];
		const stats = defenseStats(defense.kind, defense.level);
		let aim: Point;

		if (defense.kind === 'mortar') {
			const spot = pickMortarAim(state.soldiers, origin, stats);
			if (!spot) return;
			state.shells.push({
				id: state.nextId++,
				fromX: origin.x,
				fromY: origin.y,
				toX: spot.x,
				toY: spot.y,
				ageMs: 0,
				flightMs: stats.flightMs,
				damage: stats.damage,
				radius: stats.splashRadius
			});
			events.push({
				type: 'shell-launched',
				slot,
				fromX: origin.x,
				fromY: origin.y,
				toX: spot.x,
				toY: spot.y
			});
			aim = spot;
		} else if (defense.kind === 'nest') {
			const target = pickNestTarget(
				state.soldiers,
				origin,
				stats,
				incomingDamage(state.projectiles, 'fpv')
			);
			if (!target) return;
			launchFpv(state, random, origin, stats, target);
			events.push({ type: 'drone-launched', slot, x: origin.x, y: origin.y });
			aim = target;
		} else if (defense.kind === 'patriot') {
			const target = pickPatriotTarget(
				state.flyers,
				origin,
				stats,
				incomingDamage(state.projectiles, 'missile')
			);
			if (!target) return;
			launchMissile(state, origin, stats, target);
			events.push({ type: 'missile-launched', slot, x: origin.x, y: origin.y });
			aim = target;
		} else {
			// The squad shoots whoever is closest to breaking through, aircraft included, but
			// rifles do little against those
			const ground = pickSquadTarget(state.soldiers, origin, stats);
			const air = pickAirTarget(state.flyers, origin, stats.range);
			const shootAir =
				air !== null && (!ground || remainingDistance(air) < remainingDistance(ground));
			const target = shootAir ? air : ground;
			if (!target) return;
			damageSoldier(target, shootAir ? stats.damage * SQUAD_AIR_FACTOR : stats.damage);
			events.push({
				type: 'squad-shot',
				slot,
				fromX: origin.x,
				fromY: origin.y,
				toX: target.x,
				toY: target.y
			});
			aim = target;
		}
		defense.aim = Math.atan2(aim.y - origin.y, aim.x - origin.x);
		defense.cooldownMs = stats.intervalMs;
		defense.firedMs = 160;
	});
}

function landShells(state: DroneWallState, dtMs: number, events: DroneWallEvent[]) {
	const flying = [];
	for (const shell of state.shells) {
		shell.ageMs += dtMs;
		if (shell.ageMs < shell.flightMs) {
			flying.push(shell);
			continue;
		}
		const centre: Point = { x: shell.toX, y: shell.toY };
		for (const soldier of state.soldiers) {
			if (soldier.hp <= 0) continue;
			damageSoldier(
				soldier,
				splashDamage(shell.damage, distanceBetween(centre, soldier), shell.radius)
			);
		}
		events.push({ type: 'shell-landed', x: shell.toX, y: shell.toY, radius: shell.radius });
	}
	state.shells = flying;
}

function reapFallen(state: DroneWallState, events: DroneWallEvent[]) {
	state.soldiers = state.soldiers.filter((soldier) => {
		if (soldier.hp > 0) return true;
		const stats = SOLDIERS[soldier.kind];
		dropHelmet(state, soldier, stats.value);
		state.kills += 1;
		state.score += stats.points;
		events.push({ type: 'soldier-fell', x: soldier.x, y: soldier.y, kind: soldier.kind });
		return false;
	});
	state.flyers = state.flyers.filter((flyer) => {
		if (flyer.hp > 0) return true;
		const stats = FLYERS[flyer.kind];
		dropHelmet(state, flyer, stats.value);
		state.kills += 1;
		state.score += stats.points;
		events.push({ type: 'flyer-fell', x: flyer.x, y: flyer.y, kind: flyer.kind });
		return false;
	});
}

/** Advances the game by dtMs and returns what happened, for sounds and effects */
export function stepGame(state: DroneWallState, random: Random, dtMs: number): DroneWallEvent[] {
	const events: DroneWallEvent[] = [];
	if (state.over) return events;
	state.timeMs += dtMs;

	updateWavePhase(state, random, dtMs, events);
	marchSoldiers(state, dtMs, events);
	flyFlyers(state, dtMs, events);
	fireDefenses(state, random, dtMs, events);
	flyProjectiles(state, dtMs, damageSoldier, events);
	landShells(state, dtMs, events);
	reapFallen(state, events);
	events.push(...collectHelmets(state, dtMs));

	if (state.lives <= 0) {
		state.over = true;
		events.push({ type: 'game-over' });
	} else {
		checkWaveCleared(state, events);
	}
	return events;
}
