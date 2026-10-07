/*
 * One fixed step of Drone Wall: waves start and end, soldiers march, trenches slow and mine them,
 * defenses pick targets and fire, mortar shells land, fallen soldiers drop helmets, and anyone who
 * reaches the end of the road costs a heart. All randomness comes from the Random passed in.
 */
import type { Random } from '#lib/game/random.js';
import { PREP_MS, SLOTS, SOLDIERS, defenseStats, hpScale, type Point } from './config';
import { ageHelmets, dropHelmet } from './economy';
import { ROAD, distanceBetween, pointAt } from './path';
import type { DroneWallEvent, DroneWallState, Soldier } from './state';
import {
	mineDpsAt,
	pickMortarAim,
	pickNestTarget,
	pickSquadTarget,
	slowAt,
	splashDamage
} from './targeting';
import { generateWave, type SpawnEntry } from './waves';

/** Score for clearing a wave grows with the wave number */
export function waveBonus(wave: number): number {
	return 20 + 10 * wave;
}

export function spawnSoldier(state: DroneWallState, entry: SpawnEntry): Soldier {
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

export function damageSoldier(soldier: Soldier, amount: number) {
	if (amount <= 0 || soldier.hp <= 0) return;
	soldier.hp -= amount;
	soldier.hitMs = 140;
}

function startWave(state: DroneWallState, random: Random, events: DroneWallEvent[]) {
	state.wave += 1;
	state.phase = 'wave';
	state.waveMs = 0;
	state.queue = generateWave(state.wave, random);
	state.queueIndex = 0;
	events.push({ type: 'wave-started', wave: state.wave });
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
		spawnSoldier(state, state.queue[state.queueIndex]);
		state.queueIndex += 1;
	}
}

function checkWaveCleared(state: DroneWallState, events: DroneWallEvent[]) {
	if (state.phase !== 'wave' || state.queueIndex < state.queue.length) return;
	if (state.soldiers.length > 0 || state.shells.length > 0) return;
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

function fireDefenses(state: DroneWallState, dtMs: number, events: DroneWallEvent[]) {
	state.defenses.forEach((defense, slot) => {
		if (!defense || defense.kind === 'trench') return;
		defense.firedMs = Math.max(0, defense.firedMs - dtMs);
		defense.cooldownMs = Math.max(0, defense.cooldownMs - dtMs);
		if (defense.cooldownMs > 0) return;

		const origin = SLOTS[slot];
		const stats = defenseStats(defense.kind, defense.level);

		if (defense.kind === 'mortar') {
			const aim = pickMortarAim(state.soldiers, origin, stats);
			if (!aim) return;
			state.shells.push({
				id: state.nextId++,
				fromX: origin.x,
				fromY: origin.y,
				toX: aim.x,
				toY: aim.y,
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
				toX: aim.x,
				toY: aim.y
			});
			defense.aim = Math.atan2(aim.y - origin.y, aim.x - origin.x);
		} else {
			const target =
				defense.kind === 'squad'
					? pickSquadTarget(state.soldiers, origin, stats)
					: pickNestTarget(state.soldiers, origin, stats);
			if (!target) return;
			damageSoldier(target, stats.damage);
			defense.aim = Math.atan2(target.y - origin.y, target.x - origin.x);
			events.push({
				type: defense.kind === 'squad' ? 'squad-shot' : 'drone-strike',
				slot,
				fromX: origin.x,
				fromY: origin.y,
				toX: target.x,
				toY: target.y
			});
		}
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
}

/** Advances the game by dtMs and returns what happened, for sounds and effects */
export function stepGame(state: DroneWallState, random: Random, dtMs: number): DroneWallEvent[] {
	const events: DroneWallEvent[] = [];
	if (state.over) return events;
	state.timeMs += dtMs;

	updateWavePhase(state, random, dtMs, events);
	marchSoldiers(state, dtMs, events);
	fireDefenses(state, dtMs, events);
	landShells(state, dtMs, events);
	reapFallen(state, events);
	events.push(...ageHelmets(state, dtMs));

	if (state.lives <= 0) {
		state.over = true;
		events.push({ type: 'game-over' });
	} else {
		checkWaveCleared(state, events);
	}
	return events;
}
