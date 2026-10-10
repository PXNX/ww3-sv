/*
 * One fixed step of Drone Wall: waves start and end (and bring their weather), soldiers march and
 * aircraft fly in, trenches slow and mine the soldiers, jammers slow the aircraft, defenses pick
 * targets and fire, drones, missiles and shells land, fallen enemies drop helmets that collect
 * themselves, and anyone who reaches the line costs hearts. All randomness comes from the Random
 * passed in.
 */
import type { Random } from '#lib/game/random.js';
import { FLYERS, PREP_MS, SOLDIERS, WORLD_WIDTH, hpScale, type Point } from './config';
import { damageSoldier } from './damage';
import { fireDefenses } from './defenses';
import { collectHelmets, dropHelmet } from './economy';
import { distanceBetween, pointAt } from './path';
import { updatePowers } from './powers';
import { flyProjectiles } from './projectiles';
import { updateUnits } from './units';
import type { DroneWallEvent, DroneWallState, Flyer, Soldier } from './state';
import { jamAt, mineDpsAt, slowAt, splashDamage } from './targeting';
import {
	RUSH_WARNING_MS,
	generateWave,
	isFlyerSpawn,
	rushStart,
	type FlyerSpawn,
	type SoldierSpawn,
	type SpawnEntry
} from './waves';
import { FREEZE_MS, THAW_MS, WEATHER, canFreeze, enemySpeedFactor, pickWeather } from './weather';

/** Score for clearing a wave grows with the wave number */
export function waveBonus(wave: number): number {
	return 20 + 10 * wave;
}

/** Aerial enemies enter this far above the field and leave the road alone */
const FLYER_ENTRY_Y = -30;
/** Aerial enemies fly toward a point on the line, within this much of the field's sides */
const FLIGHT_MARGIN = 30;
const WOBBLE = 7;

/** An officer speeds up the soldiers around it, a medic heals them */
const OFFICER_RANGE = 85;
const OFFICER_BOOST = 1.3;
const MEDIC_RANGE = 70;
/** Share of a soldier's health a medic heals per second */
const MEDIC_HEAL = 0.08;

export function spawnSoldier(state: DroneWallState, entry: SoldierSpawn): Soldier {
	const stats = SOLDIERS[entry.kind];
	const maxHp = Math.round(stats.hp * hpScale(state.wave));
	const start = pointAt(state.map.road, 0);
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
		hitMs: 0,
		engaged: false,
		frozenMs: 0,
		thawMs: 0,
		rally: 1
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
	const toY = state.map.lineY;
	// The flight over a tall map is long, so aircraft fly faster there (not in proportion)
	const airSpeed = Math.sqrt(state.map.height / 640);
	const flyer: Flyer = {
		id: state.nextId++,
		kind: entry.kind,
		air: true,
		hp: maxHp,
		maxHp,
		speed: stats.speed * entry.speedScale * airSpeed,
		fromX,
		toX,
		toY,
		progress: 0,
		length: Math.hypot(toX - fromX, toY - FLYER_ENTRY_Y),
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
		y: FLYER_ENTRY_Y + (flyer.toY - FLYER_ENTRY_Y) * t
	};
}

export { damageSoldier };

function startWave(state: DroneWallState, random: Random, events: DroneWallEvent[]) {
	state.wave += 1;
	state.phase = 'wave';
	state.waveMs = 0;
	state.queue = generateWave(state.wave, random, state.map.crowd);
	state.queueIndex = 0;
	state.rushAtMs = rushStart(state.queue);
	state.rushWarned = false;

	// The forecast the player saw while building comes true, and the next one is drawn
	const before = state.weather;
	state.weather = state.forecast;
	state.weatherMs = 0;
	state.forecast = pickWeather(random, state.wave + 1, state.map.climate, state.weather);
	if (state.weather !== before) events.push({ type: 'weather-changed', weather: state.weather });
	events.push({ type: 'wave-started', wave: state.wave });
}

function spawnEntry(state: DroneWallState, entry: SpawnEntry, events: DroneWallEvent[]) {
	if (isFlyerSpawn(entry)) {
		spawnFlyer(state, entry);
		events.push({ type: 'flyer-spawned', kind: entry.kind });
	} else {
		spawnSoldier(state, entry);
		if (entry.rush && state.rushAtMs !== null) {
			state.rushAtMs = null;
			events.push({ type: 'rush-started', wave: state.wave });
		}
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
	if (
		state.rushAtMs !== null &&
		!state.rushWarned &&
		state.waveMs >= state.rushAtMs - RUSH_WARNING_MS
	) {
		state.rushWarned = true;
		events.push({ type: 'rush-warning', wave: state.wave });
	}
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

/** Officers shout the soldiers near them faster, medics patch them up */
function rallyAndHeal(state: DroneWallState, dtMs: number) {
	const live = state.soldiers.filter((soldier) => soldier.hp > 0 && soldier.y >= 0);
	const officers = live.filter((soldier) => soldier.kind === 'officer');
	const medics = live.filter((soldier) => soldier.kind === 'medic');
	for (const soldier of state.soldiers) {
		soldier.rally = officers.some(
			(officer) => officer !== soldier && distanceBetween(officer, soldier) <= OFFICER_RANGE
		)
			? OFFICER_BOOST
			: 1;
	}
	if (medics.length === 0) return;
	for (const soldier of live) {
		if (soldier.hp >= soldier.maxHp) continue;
		if (
			medics.some((medic) => medic !== soldier && distanceBetween(medic, soldier) <= MEDIC_RANGE)
		) {
			soldier.hp = Math.min(soldier.maxHp, soldier.hp + soldier.maxHp * MEDIC_HEAL * (dtMs / 1000));
		}
	}
}

function marchSoldiers(
	state: DroneWallState,
	random: Random,
	dtMs: number,
	events: DroneWallEvent[]
) {
	rallyAndHeal(state, dtMs);
	const freezeChance = WEATHER[state.weather].freezeChance;
	for (const soldier of state.soldiers) {
		soldier.hitMs = Math.max(0, soldier.hitMs - dtMs);
		// Trenches slow the crowd, mines hurt it (sappers walk right through them)
		const sapper = soldier.kind === 'sapper';
		soldier.slow = sapper ? 1 : slowAt(soldier, state.defenses, state.map.slots);
		const dps = sapper ? 0 : mineDpsAt(soldier, state.defenses, state.map.slots);
		if (dps > 0 && soldier.y >= 0) damageSoldier(soldier, (dps * dtMs) / 1000);
		// A soldier in melee with a defender unit stands and fights
		if (soldier.hp <= 0 || soldier.engaged) continue;

		// Snow: infantry now and then freezes solid, then cannot freeze again for a while
		if (soldier.frozenMs > 0) {
			soldier.frozenMs -= dtMs;
			if (soldier.frozenMs <= 0) soldier.thawMs = THAW_MS;
			continue;
		}
		soldier.thawMs = Math.max(0, soldier.thawMs - dtMs);
		if (
			soldier.thawMs === 0 &&
			soldier.y >= 0 &&
			canFreeze(state.weather, soldier.kind) &&
			random() < (freezeChance * dtMs) / 1000
		) {
			soldier.frozenMs = FREEZE_MS[0] + random() * (FREEZE_MS[1] - FREEZE_MS[0]);
			events.push({ type: 'soldier-froze', x: soldier.x, y: soldier.y, kind: soldier.kind });
			continue;
		}

		const speed =
			soldier.speed * soldier.slow * soldier.rally * enemySpeedFactor(state.weather, soldier.kind);
		soldier.progress += (speed * dtMs) / 1000;
		const sample = pointAt(state.map.road, soldier.progress);
		soldier.x = sample.x;
		soldier.y = sample.y;
	}

	// Anyone who reached the end of the road breaches the line
	state.soldiers = state.soldiers.filter((soldier) => {
		if (soldier.hp <= 0 || soldier.progress < state.map.road.length) return true;
		state.lives = Math.max(0, state.lives - SOLDIERS[soldier.kind].leak);
		events.push({ type: 'leak', x: soldier.x, y: soldier.y });
		return false;
	});
}

function flyFlyers(state: DroneWallState, dtMs: number, events: DroneWallEvent[]) {
	for (const flyer of state.flyers) {
		flyer.hitMs = Math.max(0, flyer.hitMs - dtMs);
		if (flyer.hp <= 0) continue;
		// Jammers slow the aircraft in their field and wear them down
		const jam = jamAt(flyer, state.defenses, state.map.slots);
		if (jam.dps > 0 && flyer.y >= 0) damageSoldier(flyer, (jam.dps * dtMs) / 1000);
		flyer.progress += (flyer.speed * jam.slow * dtMs) / 1000;
		const position = flyerPosition(flyer);
		flyer.x = position.x;
		flyer.y = position.y;
	}

	state.flyers = state.flyers.filter((flyer) => {
		if (flyer.hp <= 0 || flyer.progress < flyer.length) return true;
		state.lives = Math.max(0, state.lives - FLYERS[flyer.kind].leak);
		events.push({ type: 'leak', x: flyer.x, y: flyer.toY });
		return false;
	});
}

function landShells(state: DroneWallState, dtMs: number, events: DroneWallEvent[]) {
	const flying = [];
	for (const shell of state.shells) {
		// A shell with a negative age is still waiting its turn in a salvo or a bombing run
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
		events.push({
			type: 'shell-landed',
			kind: shell.kind,
			x: shell.toX,
			y: shell.toY,
			radius: shell.radius
		});
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
	state.weatherMs += dtMs;

	updateWavePhase(state, random, dtMs, events);
	updateUnits(state, dtMs, events);
	marchSoldiers(state, random, dtMs, events);
	flyFlyers(state, dtMs, events);
	fireDefenses(state, random, dtMs, events);
	flyProjectiles(state, dtMs, damageSoldier, events);
	landShells(state, dtMs, events);
	updatePowers(state, dtMs);
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
