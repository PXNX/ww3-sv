/*
 * The newer mechanics of Drone Wall: elite levels, weather, powers, the mass assault and the
 * extra attackers and defenders.
 */
import { describe, expect, it } from 'vitest';
import { createRandom } from '#lib/game/random.js';
import {
	AIRSTRIKE,
	DEFENSE_KINDS,
	FLYERS,
	MAX_LEVEL,
	NORMAL_LEVELS,
	POWERS,
	SOLDIERS,
	STARTING_LIVES,
	WORLD_WIDTH,
	defenseStats,
	eliteTier,
	isElite,
	upgradeCost,
	type DefenseKind
} from './config';
import { build, upgrade } from './economy';
import { ROAD } from './path';
import { callAirstrike, callPower, callStormShadow, isPowerUnlocked } from './powers';
import { createGame, type DroneWallEvent, type DroneWallState } from './state';
import { stepGame } from './step';
import { STEP_MS, flyerAt, soldierAt } from './testHelpers';
import { WEATHER, canFreeze, pickWeather } from './weather';

const random = () => createRandom(1);

/** A game that is already in a running wave with an empty queue, to place enemies by hand */
function emptyWave(): DroneWallState {
	const state = createGame();
	state.phase = 'wave';
	state.wave = 1;
	state.currency = 2000;
	state.queue = [{ atMs: 1e9, kind: 'grunt', speedScale: 1, lane: 0 }];
	return state;
}

function run(
	state: DroneWallState,
	steps: number,
	until?: (events: DroneWallEvent[]) => boolean
): DroneWallEvent[] {
	const rng = random();
	const events: DroneWallEvent[] = [];
	for (let i = 0; i < steps && !state.over; i++) {
		events.push(...stepGame(state, rng, STEP_MS));
		if (until?.(events)) break;
	}
	return events;
}

/** Builds a defense and sets its level directly, without paying for the upgrades */
function place(state: DroneWallState, slot: number, kind: DefenseKind, level = 1) {
	build(state, slot, kind);
	const defense = state.defenses[slot]!;
	defense.level = level;
	defense.cooldownMs = 0;
	return defense;
}

/** Damage per second a defense could deal with every shot hitting one target */
function dps(kind: DefenseKind, level: number): number {
	const stats = defenseStats(kind, level);
	return (stats.damage * stats.volley) / (stats.intervalMs / 1000);
}

describe('elite levels', () => {
	it('has three normal levels and three elite ones', () => {
		expect(NORMAL_LEVELS).toBe(3);
		expect(MAX_LEVEL).toBe(6);
		expect([1, 3, 4, 6].map(isElite)).toEqual([false, false, true, true]);
		expect([1, 3, 4, 5, 6].map(eliteTier)).toEqual([0, 0, 1, 2, 3]);
	});

	it.each(DEFENSE_KINDS)('%s: every upgrade costs helmets, elite ones cost the most', (kind) => {
		const costs = [1, 2, 3, 4, 5].map((level) => upgradeCost(kind, level)!);
		expect(costs.every((cost) => cost > 0)).toBe(true);
		expect(upgradeCost(kind, MAX_LEVEL)).toBeNull();
		// Going elite costs clearly more than the last normal upgrade, and it keeps climbing
		expect(costs[3]).toBeGreaterThan(costs[2]);
		expect(costs[4]).toBeGreaterThan(costs[3]);
	});

	it.each(DEFENSE_KINDS)('%s: each elite tier is stronger than the one before', (kind) => {
		const power = (level: number) => {
			const stats = defenseStats(kind, level);
			if (kind === 'trench') return stats.dps + (1 - stats.slow) * 100 + stats.range;
			if (kind === 'jammer') return stats.dps + (1 - stats.slow) * 100 + stats.range;
			if (kind === 'azov' || kind === 'leopard') {
				return stats.unitHp * stats.unitCount * (stats.damage / (stats.unitAttackMs / 1000));
			}
			return dps(kind, level);
		};
		for (let level = 2; level <= MAX_LEVEL; level++) {
			expect(power(level), `${kind} level ${level}`).toBeGreaterThan(power(level - 1));
		}
	});

	it('elite defenses fire bigger volleys', () => {
		expect(defenseStats('nest', 3).volley).toBe(1);
		expect(defenseStats('nest', 4).volley).toBeGreaterThanOrEqual(2);
		expect(defenseStats('himars', 6).volley).toBeGreaterThan(defenseStats('himars', 3).volley);
		expect(defenseStats('azov', 6).unitCount).toBeGreaterThan(defenseStats('azov', 3).unitCount);
		expect(defenseStats('leopard', 6).unitCount).toBeGreaterThan(1);
	});

	it('an elite nest launches several FPV drones with every shot', () => {
		const state = emptyWave();
		place(state, 2, 'nest', 4);
		state.soldiers.push(
			soldierAt(240, 'brute', { speed: 0 }),
			soldierAt(250, 'brute', { speed: 0 }),
			soldierAt(260, 'brute', { speed: 0 })
		);
		const events = run(state, 2);
		expect(events.filter((e) => e.type === 'drone-launched')).toHaveLength(
			defenseStats('nest', 4).volley
		);
	});

	it('an elite squad shoots several soldiers at once', () => {
		const state = emptyWave();
		place(state, 2, 'squad', 5);
		state.soldiers.push(
			soldierAt(150, 'grunt', { speed: 0 }),
			soldierAt(160, 'grunt', { speed: 0 })
		);
		const events = run(state, 2);
		const shots = events.filter((e) => e.type === 'squad-shot');
		expect(shots).toHaveLength(2);
		expect(new Set(shots.map((shot) => `${shot.toX},${shot.toY}`)).size).toBe(2);
	});

	it('the first elite upgrade unlocks the powers, higher tiers make them stronger', () => {
		const state = emptyWave();
		build(state, 2, 'squad');
		expect(state.eliteRank).toBe(0);
		expect(isPowerUnlocked(state, 'airstrike')).toBe(false);
		upgrade(state, 2);
		upgrade(state, 2);
		expect(state.eliteRank).toBe(0);
		expect(upgrade(state, 2).ok).toBe(true);
		expect(state.defenses[2]?.level).toBe(4);
		expect(state.eliteRank).toBe(1);
		expect(isPowerUnlocked(state, 'airstrike')).toBe(true);
		expect(isPowerUnlocked(state, 'stormshadow')).toBe(false);
		upgrade(state, 2);
		expect(state.eliteRank).toBe(2);
		expect(isPowerUnlocked(state, 'stormshadow')).toBe(true);
	});

	it('keeps the unlock when the elite defense is sold', () => {
		const state = emptyWave();
		place(state, 2, 'squad', 3);
		upgrade(state, 2);
		state.defenses[2] = null;
		expect(state.eliteRank).toBe(1);
		expect(isPowerUnlocked(state, 'airstrike')).toBe(true);
	});
});

describe('weather', () => {
	it('starts clear and brings a forecast for the next wave, which then comes true', () => {
		const state = createGame('lightning');
		expect(state.weather).toBe('clear');
		state.forecast = 'snow';
		state.prepMs = 1;
		const events = run(state, 3);
		expect(state.weather).toBe('snow');
		expect(events).toContainEqual({ type: 'weather-changed', weather: 'snow' });
		expect(state.weatherMs).toBeGreaterThan(0);
	});

	it('keeps the first waves clear and draws later weather from the map climate', () => {
		const climate = ['snow', 'fog'] as const;
		expect(pickWeather(random(), 1, climate, 'clear')).toBe('clear');
		expect(pickWeather(random(), 2, climate, 'clear')).toBe('clear');
		const seen = new Set<string>();
		const rng = createRandom(3);
		for (let i = 0; i < 40; i++) seen.add(pickWeather(rng, 6, climate, 'clear'));
		expect([...seen].sort()).toEqual(['fog', 'snow']);
		expect(pickWeather(random(), 6, [], 'clear')).toBe('clear');
	});

	it('draws a different forecast every wave from the map climate', () => {
		const state = createGame('tundra');
		state.wave = 5;
		state.prepMs = 1;
		const seen = new Set<string>();
		const rng = createRandom(9);
		for (let i = 0; i < 12; i++) {
			state.phase = 'prep';
			state.prepMs = 1;
			state.queue = [];
			state.soldiers = [];
			stepGame(state, rng, STEP_MS);
			seen.add(state.forecast);
		}
		expect(seen.size).toBeGreaterThan(1);
		for (const weather of seen) expect(state.map.climate).toContain(weather);
	});

	it('fog blinds the FPV drones: they hit weaker and the nest sees less far', () => {
		const clear = emptyWave();
		const foggy = emptyWave();
		foggy.weather = 'fog';
		for (const state of [clear, foggy]) {
			place(state, 2, 'nest');
			state.soldiers.push(soldierAt(250, 'brute', { speed: 0 }));
			run(state, 2);
		}
		expect(clear.projectiles).toHaveLength(1);
		expect(foggy.projectiles).toHaveLength(1);
		expect(foggy.projectiles[0].damage).toBeCloseTo(
			clear.projectiles[0].damage * WEATHER.fog.fpvPower
		);

		// A soldier at the edge of the nest's normal reach is out of sight in fog
		const far = emptyWave();
		far.weather = 'fog';
		place(far, 2, 'nest');
		const reach = defenseStats('nest', 1).range;
		const slot = far.map.slots[2];
		const target = soldierAt(340, 'brute', { speed: 0 });
		far.soldiers.push(target);
		const distance = Math.hypot(target.x - slot.x, target.y - slot.y);
		expect(distance).toBeLessThan(reach);
		expect(distance).toBeGreaterThan(reach * WEATHER.fog.fpvRange);
		run(far, 2);
		expect(far.projectiles).toHaveLength(0);
	});

	it('rain bogs down vehicles but not infantry', () => {
		const dry = emptyWave();
		const wet = emptyWave();
		wet.weather = 'rain';
		const places = [dry, wet].map((state) => {
			const tank = soldierAt(100, 'tank');
			const grunt = soldierAt(100, 'grunt');
			state.soldiers.push(tank, grunt);
			run(state, 60);
			return { tank: tank.progress - 100, grunt: grunt.progress - 100 };
		});
		expect(places[1].tank).toBeCloseTo(places[0].tank * WEATHER.rain.vehicleSpeed, 0);
		expect(places[1].grunt).toBeCloseTo(places[0].grunt, 5);
	});

	it('rain slows the Leopard tank of the player, not an Azov fighter', () => {
		const travel = (weather: 'clear' | 'rain', kind: 'leopard' | 'azov') => {
			const state = emptyWave();
			state.weather = weather;
			place(state, 2, kind);
			// A soldier to run at, far enough that the unit is still on its way after 1 s
			state.soldiers.push(soldierAt(160, 'brute', { speed: 0 }));
			run(state, 30);
			return state.units[0].x;
		};
		const slot = createGame().map.slots[2];
		const leopardDry = Math.abs(travel('clear', 'leopard') - slot.x);
		const leopardWet = Math.abs(travel('rain', 'leopard') - slot.x);
		expect(leopardWet).toBeLessThan(leopardDry);
		expect(travel('rain', 'azov')).toBeCloseTo(travel('clear', 'azov'), 5);
	});

	it('snow slows infantry, and never freezes vehicles', () => {
		const clear = emptyWave();
		const snowy = emptyWave();
		snowy.weather = 'snow';
		const a = soldierAt(100, 'grunt');
		const b = soldierAt(100, 'grunt');
		clear.soldiers.push(a);
		snowy.soldiers.push(b);
		// No freezing for this one: the random numbers are always high
		for (let i = 0; i < 30; i++) {
			stepGame(clear, () => 0.99, STEP_MS);
			stepGame(snowy, () => 0.99, STEP_MS);
		}
		expect(b.progress - 100).toBeCloseTo((a.progress - 100) * WEATHER.snow.infantrySpeed, 5);
		expect(canFreeze('snow', 'grunt')).toBe(true);
		expect(canFreeze('snow', 'tank')).toBe(false);
		expect(canFreeze('snow', 'buggy')).toBe(false);
		expect(canFreeze('rain', 'grunt')).toBe(false);
	});

	it('snow freezes infantry solid for a moment, then lets them go and keeps them from freezing again', () => {
		const state = emptyWave();
		state.weather = 'snow';
		const grunt = soldierAt(100, 'grunt');
		state.soldiers.push(grunt);
		// Low random numbers: the soldier freezes on the first step
		const events = stepGame(state, () => 0, STEP_MS);
		expect(events.map((e) => e.type)).toContain('soldier-froze');
		expect(grunt.frozenMs).toBeGreaterThan(1400);
		const frozenAt = grunt.progress;
		for (let i = 0; i < 60; i++) stepGame(state, () => 0.99, STEP_MS);
		expect(grunt.progress).toBe(frozenAt);
		for (let i = 0; i < 120; i++) stepGame(state, () => 0.99, STEP_MS);
		expect(grunt.frozenMs).toBeLessThanOrEqual(0);
		expect(grunt.progress).toBeGreaterThan(frozenAt);
		// Just thawed: always-low random numbers cannot freeze it right away
		expect(grunt.thawMs).toBeGreaterThan(0);
		const before = grunt.progress;
		stepGame(state, () => 0, STEP_MS);
		expect(grunt.frozenMs).toBeLessThanOrEqual(0);
		expect(grunt.progress).toBeGreaterThan(before);
	});

	it('a frozen soldier can still be shot', () => {
		const state = emptyWave();
		state.weather = 'snow';
		place(state, 2, 'squad');
		const grunt = soldierAt(150, 'grunt');
		state.soldiers.push(grunt);
		stepGame(state, () => 0, STEP_MS);
		expect(grunt.frozenMs).toBeGreaterThan(0);
		run(state, 60 * 2, () => state.kills > 0);
		expect(state.kills).toBe(1);
	});
});

describe('powers', () => {
	function unlocked(rank = 1): DroneWallState {
		const state = emptyWave();
		state.eliteRank = rank;
		return state;
	}

	it('are locked until an elite defense exists', () => {
		const state = emptyWave();
		expect(callAirstrike(state, 300)).toEqual({ ok: false, reason: 'locked' });
		expect(callStormShadow(state, 100, 300)).toEqual({ ok: false, reason: 'locked' });
		expect(state.currency).toBe(2000);
		expect(state.shells).toHaveLength(0);
	});

	it('cost helmets, and need enough of them', () => {
		const state = unlocked();
		state.currency = POWERS.airstrike.cost - 1;
		expect(callAirstrike(state, 300)).toEqual({ ok: false, reason: 'poor' });
		expect(state.powers.airstrike.cooldownMs).toBe(0);
		state.currency = POWERS.airstrike.cost + 5;
		expect(callAirstrike(state, 300)).toEqual({ ok: true, cost: POWERS.airstrike.cost });
		expect(state.currency).toBe(5);
	});

	it('are expensive: more than the starting helmets', () => {
		expect(POWERS.airstrike.cost).toBeGreaterThan(40);
		expect(POWERS.stormshadow.cost).toBeGreaterThan(POWERS.airstrike.cost);
	});

	it('cool down before they can be called again, and cool down on their own', () => {
		const state = unlocked();
		expect(callAirstrike(state, 300).ok).toBe(true);
		expect(callAirstrike(state, 300)).toEqual({ ok: false, reason: 'cooldown' });
		// The other power has its own cooldown
		state.eliteRank = 2;
		expect(callStormShadow(state, 100, 300).ok).toBe(true);
		run(state, Math.ceil(POWERS.airstrike.cooldownMs / STEP_MS) + 5);
		expect(state.powers.airstrike.cooldownMs).toBe(0);
		expect(callAirstrike(state, 300).ok).toBe(true);
	});

	it('an airstrike drops a row of bombs across the whole field, in the band that was picked', () => {
		const state = unlocked();
		const events: DroneWallEvent[] = [];
		callAirstrike(state, 320, events);
		expect(events).toContainEqual({
			type: 'power-called',
			power: 'airstrike',
			x: WORLD_WIDTH / 2,
			y: 320
		});
		expect(state.shells).toHaveLength(AIRSTRIKE.bombs[0]);
		expect(state.runs).toHaveLength(1);
		for (const bomb of state.shells) {
			expect(bomb.kind).toBe('bomb');
			expect(Math.abs(bomb.toY - 320)).toBeLessThanOrEqual(AIRSTRIKE.halfBand);
			// Waiting for the jets to get there: the bombs fall from left to right
			expect(bomb.ageMs).toBeLessThanOrEqual(0);
		}
		const xs = state.shells.map((bomb) => bomb.toX);
		expect(xs).toEqual([...xs].sort((a, b) => a - b));
		expect(state.shells[0].ageMs).toBeGreaterThan(state.shells.at(-1)!.ageMs);
		expect(Math.min(...xs)).toBeLessThan(60);
		expect(Math.max(...xs)).toBeGreaterThan(WORLD_WIDTH - 60);
	});

	it('an airstrike wipes out a crowd on the road in its band', () => {
		const state = unlocked();
		// The first row of the serpentine road, at y = 120
		const crowd = Array.from({ length: 12 }, (_, i) =>
			soldierAt(150 + i * 18, 'grunt', { speed: 0 })
		);
		state.soldiers.push(...crowd);
		const aimY = crowd[0].y;
		callAirstrike(state, aimY);
		const events = run(state, 60 * 4, () => state.shells.length === 0);
		const landed = events.filter((e) => e.type === 'shell-landed' && e.kind === 'bomb');
		expect(landed).toHaveLength(AIRSTRIKE.bombs[0]);
		expect(state.soldiers.length).toBeLessThan(crowd.length / 2);
		// The jets are gone afterwards
		run(state, 60);
		expect(state.runs).toHaveLength(0);
	});

	it('an airstrike leaves soldiers far from its band alone', () => {
		const state = unlocked();
		const far = soldierAt(ROAD.length - 20, 'grunt', { speed: 0 });
		state.soldiers.push(far);
		callAirstrike(state, 40);
		run(state, 60 * 3);
		expect(far.hp).toBe(far.maxHp);
	});

	it('a higher elite rank drops more bombs and hits harder', () => {
		const one = unlocked(1);
		const three = unlocked(3);
		callAirstrike(one, 300);
		callAirstrike(three, 300);
		expect(three.shells.length).toBeGreaterThan(one.shells.length);
		expect(three.shells[0].damage).toBeGreaterThan(one.shells[0].damage);
	});

	it('powers keep up with the wave: the same strike hits harder later', () => {
		const early = unlocked();
		const late = unlocked();
		late.wave = 15;
		callAirstrike(early, 300);
		callAirstrike(late, 300);
		expect(late.shells[0].damage).toBeGreaterThan(early.shells[0].damage * 2);
	});

	it('a Storm Shadow flies in from the side and flattens one spot', () => {
		const state = unlocked(2);
		const tank = soldierAt(150, 'tank', { speed: 0 });
		const nearby = soldierAt(155, 'grunt', { speed: 0 });
		const away = soldierAt(ROAD.length - 20, 'grunt', { speed: 0 });
		state.wave = 10;
		state.soldiers.push(tank, nearby, away);
		callStormShadow(state, tank.x, tank.y);
		expect(state.shells).toHaveLength(1);
		expect(state.shells[0].kind).toBe('cruise');
		expect(state.shells[0].fromX < 0 || state.shells[0].fromX > WORLD_WIDTH).toBe(true);
		const events = run(state, 60 * 3, () => state.shells.length === 0);
		expect(events.some((e) => e.type === 'shell-landed' && e.kind === 'cruise')).toBe(true);
		expect(nearby.hp).toBeLessThanOrEqual(0);
		expect(tank.hp).toBeLessThan(tank.maxHp * 0.5);
		expect(away.hp).toBe(away.maxHp);
	});

	it('callPower picks the right power and refuses when the game is over', () => {
		const state = unlocked(2);
		expect(callPower(state, 'airstrike', 100, 300).ok).toBe(true);
		expect(callPower(state, 'stormshadow', 100, 300).ok).toBe(true);
		state.over = true;
		state.powers.airstrike.cooldownMs = 0;
		expect(callPower(state, 'airstrike', 100, 300)).toEqual({ ok: false, reason: 'game-over' });
	});
});

describe('the mass assault', () => {
	it('warns a few seconds ahead, then pours in all at once', () => {
		const state = createGame();
		state.wave = 5;
		state.prepMs = 1;
		const events = run(state, 60 * 100, (all) => all.some((e) => e.type === 'rush-started'));
		const types = events.map((e) => e.type);
		expect(types).toContain('wave-started');
		expect(types).toContain('rush-warning');
		expect(types).toContain('rush-started');
		expect(types.indexOf('rush-warning')).toBeLessThan(types.indexOf('rush-started'));
		// Said once each
		expect(types.filter((type) => type === 'rush-warning')).toHaveLength(1);
		expect(types.filter((type) => type === 'rush-started')).toHaveLength(1);
		expect(state.wave).toBe(6);
	});

	it('has none in the waves in between', () => {
		const state = createGame();
		state.wave = 6;
		state.prepMs = 1;
		const events = run(state, 60 * 60, (all) => all.some((e) => e.type === 'wave-cleared'));
		expect(events.some((e) => e.type === 'rush-warning')).toBe(false);
	});
});

describe('new attackers', () => {
	it('a tank costs two hearts when it breaches the line, an armored car one', () => {
		const state = emptyWave();
		state.soldiers.push(soldierAt(ROAD.length - 0.1, 'tank'));
		stepGame(state, random(), STEP_MS);
		expect(state.lives).toBe(STARTING_LIVES - SOLDIERS.tank.leak);
		expect(SOLDIERS.tank.leak).toBe(2);
		state.soldiers.push(soldierAt(ROAD.length - 0.1, 'btr'));
		stepGame(state, random(), STEP_MS);
		expect(state.lives).toBe(STARTING_LIVES - 3);
	});

	it('a bomber that gets through costs two hearts, a swarm drone one', () => {
		const state = emptyWave();
		state.flyers.push(flyerAt(200, state.map.lineY - 0.1, 'bomber'));
		stepGame(state, random(), STEP_MS);
		expect(state.lives).toBe(STARTING_LIVES - FLYERS.bomber.leak);
		state.flyers.push(flyerAt(100, state.map.lineY - 0.1, 'swarm'));
		stepGame(state, random(), STEP_MS);
		expect(state.lives).toBe(STARTING_LIVES - 3);
	});

	it('a sapper walks through trenches: no slowing, no mines', () => {
		const state = emptyWave();
		place(state, 2, 'trench', 3);
		const sapper = soldierAt(190, 'sapper');
		const grunt = soldierAt(190, 'grunt');
		state.soldiers.push(sapper, grunt);
		run(state, 30);
		expect(sapper.slow).toBe(1);
		expect(sapper.hp).toBe(sapper.maxHp);
		expect(grunt.slow).toBeLessThan(1);
		expect(grunt.hp).toBeLessThan(grunt.maxHp);
	});

	it('an officer rallies the soldiers around it into a faster march', () => {
		const state = emptyWave();
		const officer = soldierAt(300, 'officer');
		const near = soldierAt(310, 'grunt');
		const far = soldierAt(60, 'grunt');
		state.soldiers.push(officer, near, far);
		stepGame(state, random(), STEP_MS);
		expect(near.rally).toBeGreaterThan(1);
		expect(far.rally).toBe(1);
		const before = near.progress;
		run(state, 60);
		expect(near.progress - before).toBeGreaterThan(SOLDIERS.grunt.speed * 1.2 * 0.9);
	});

	it('a medic heals the soldiers around it, but not itself', () => {
		const state = emptyWave();
		const medic = soldierAt(300, 'medic', { speed: 0 });
		const hurt = soldierAt(310, 'brute', { speed: 0 });
		const lonely = soldierAt(60, 'brute', { speed: 0 });
		medic.hp = 10;
		hurt.hp = 50;
		lonely.hp = 50;
		state.soldiers.push(medic, hurt, lonely);
		run(state, 60);
		expect(hurt.hp).toBeGreaterThan(50 + hurt.maxHp * 0.05);
		expect(lonely.hp).toBe(50);
		expect(medic.hp).toBe(10);
		run(state, 60 * 30);
		expect(hurt.hp).toBe(hurt.maxHp);
	});

	it('a buggy is fast, and rain slows it like any vehicle', () => {
		expect(SOLDIERS.buggy.speed).toBeGreaterThan(SOLDIERS.grunt.speed * 2);
		expect(SOLDIERS.buggy.vehicle).toBe(true);
		expect(SOLDIERS.medic.vehicle).toBe(false);
	});
});

describe('new defenders', () => {
	it('a sniper picks the toughest soldier and goes through armor', () => {
		const rifle = emptyWave();
		const sniper = emptyWave();
		for (const state of [rifle, sniper]) {
			const car = soldierAt(150, 'btr', { speed: 0 });
			const grunt = soldierAt(155, 'grunt', { speed: 0 });
			state.soldiers.push(car, grunt);
		}
		place(rifle, 2, 'squad');
		place(sniper, 2, 'sniper');
		run(rifle, 2);
		run(sniper, 2);
		const [car, grunt] = sniper.soldiers;
		expect(car.maxHp - car.hp).toBeGreaterThan(0);
		expect(grunt.hp).toBe(grunt.maxHp);
		// The squad's bullets bounce off the armored car, the sniper's do not
		const squadDamage = rifle.soldiers[0].maxHp - rifle.soldiers[0].hp;
		expect(squadDamage).toBeLessThan(car.maxHp - car.hp);
	});

	it('a sniper goes for officers and medics first', () => {
		const state = emptyWave();
		place(state, 2, 'sniper');
		const brute = soldierAt(150, 'brute', { speed: 0 });
		const medic = soldierAt(155, 'medic', { speed: 0 });
		state.soldiers.push(brute, medic);
		run(state, 2);
		expect(medic.hp).toBeLessThan(medic.maxHp);
		expect(brute.hp).toBe(brute.maxHp);
	});

	it('a Gepard shreds aircraft and barely scratches the ground', () => {
		const air = emptyWave();
		place(air, 2, 'gepard');
		const heli = flyerAt(air.map.slots[2].x + 30, air.map.slots[2].y - 40, 'heli');
		air.flyers.push(heli);
		run(air, 120);
		expect(heli.hp).toBeLessThan(heli.maxHp * 0.6);

		const ground = emptyWave();
		place(ground, 2, 'gepard');
		const brute = soldierAt(150, 'brute', { speed: 0 });
		ground.soldiers.push(brute);
		run(ground, 120);
		expect(brute.hp).toBeLessThan(brute.maxHp);
		expect(brute.maxHp - brute.hp).toBeLessThan(heli.maxHp - heli.hp);
	});

	it('a Gepard prefers aircraft over soldiers in reach', () => {
		const state = emptyWave();
		place(state, 2, 'gepard');
		const slot = state.map.slots[2];
		const brute = soldierAt(150, 'brute', { speed: 0 });
		const heli = flyerAt(slot.x + 20, slot.y - 30, 'heli');
		state.soldiers.push(brute);
		state.flyers.push(heli);
		run(state, 3);
		expect(heli.hp).toBeLessThan(heli.maxHp);
		expect(brute.hp).toBe(brute.maxHp);
	});

	it('HIMARS fires a whole salvo of rockets, spread over the crowd, one after the other', () => {
		const state = emptyWave();
		place(state, 2, 'himars');
		const crowd = [150, 175, 200, 225, 250].map((progress) =>
			soldierAt(progress, 'brute', { speed: 0 })
		);
		state.soldiers.push(...crowd);
		const events = run(state, 2);
		const launched = events.filter((e) => e.type === 'shell-launched');
		expect(launched).toHaveLength(defenseStats('himars', 1).volley);
		for (const shot of launched) expect(shot.kind).toBe('rocket');
		expect(state.shells.every((shell) => shell.kind === 'rocket')).toBe(true);
		// Staggered: the later rockets wait to be fired
		const ages = state.shells.map((shell) => shell.ageMs);
		expect(ages[0]).toBeGreaterThan(ages.at(-1)!);
		expect(
			new Set(state.shells.map((shell) => `${shell.toX | 0},${shell.toY | 0}`)).size
		).toBeGreaterThan(1);
		const landed = run(state, 60 * 4, () => state.shells.length === 0).filter(
			(e) => e.type === 'shell-landed'
		);
		expect(landed).toHaveLength(defenseStats('himars', 1).volley);
	});

	it('HIMARS and Pion reach much farther than a mortar, and cannot hit what is close', () => {
		const mortar = defenseStats('mortar', 3);
		expect(defenseStats('himars', 1).range).toBeGreaterThan(mortar.range * 1.4);
		expect(defenseStats('pion', 1).range).toBeGreaterThan(defenseStats('himars', 3).range);
		const state = emptyWave();
		place(state, 2, 'pion');
		const close = soldierAt(150, 'brute', { speed: 0 });
		close.x = state.map.slots[2].x + 30;
		close.y = state.map.slots[2].y;
		state.soldiers.push(close);
		run(state, 2);
		expect(state.shells).toHaveLength(0);
	});

	it('Pion fires rarely but hits hard and wide', () => {
		const pion = defenseStats('pion', 1);
		const mortar = defenseStats('mortar', 1);
		expect(pion.intervalMs).toBeGreaterThan(mortar.intervalMs * 3);
		expect(pion.damage).toBeGreaterThan(mortar.damage * 3);
		expect(pion.splashRadius).toBeGreaterThan(mortar.splashRadius);
		const state = emptyWave();
		place(state, 2, 'pion');
		const target = soldierAt(300, 'tank', { speed: 0 });
		state.soldiers.push(target);
		const events = run(state, 60 * 5, (all) => all.some((e) => e.type === 'shell-landed'));
		expect(events.filter((e) => e.type === 'shell-launched')).toHaveLength(1);
		expect(target.hp).toBeLessThan(target.maxHp);
		// Then a long reload
		const again = run(state, 60 * 3);
		expect(again.filter((e) => e.type === 'shell-launched')).toHaveLength(0);
	});

	it('a jammer slows aircraft in its field and wears them down', () => {
		const state = emptyWave();
		place(state, 2, 'jammer');
		const slot = state.map.slots[2];
		const jammed = flyerAt(slot.x + 20, slot.y - 40, 'heli', { speed: 40 });
		const free = flyerAt(slot.x + 300, slot.y - 40, 'heli', { speed: 40 });
		state.flyers.push(jammed, free);
		const jammedStart = jammed.progress;
		const freeStart = free.progress;
		run(state, 30);
		expect(jammed.progress - jammedStart).toBeLessThan((free.progress - freeStart) * 0.8);
		expect(jammed.hp).toBeLessThan(jammed.maxHp);
		expect(free.hp).toBe(free.maxHp);
	});

	it('a jammer does not bother the soldiers on the ground', () => {
		const state = emptyWave();
		place(state, 2, 'jammer', 3);
		const grunt = soldierAt(190, 'grunt');
		state.soldiers.push(grunt);
		run(state, 30);
		expect(grunt.slow).toBe(1);
		expect(grunt.hp).toBe(grunt.maxHp);
	});

	it('every defense kind can be built and has stats for every level', () => {
		for (const kind of DEFENSE_KINDS) {
			const state = emptyWave();
			expect(build(state, 0, kind).ok).toBe(true);
			for (let level = 1; level <= MAX_LEVEL; level++) {
				expect(defenseStats(kind, level).range).toBeGreaterThan(0);
			}
		}
	});
});
