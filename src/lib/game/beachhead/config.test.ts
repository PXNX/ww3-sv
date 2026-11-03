import { describe, expect, it } from 'vitest';
import {
	BOAT_CAPACITY,
	BUILDINGS,
	COLUMNS,
	ISLANDS,
	ISLAND_IDS,
	ISLAND_MAP_POSITIONS,
	LANDING_PARTY,
	ROWS,
	SHORE_X,
	SKILLS,
	SKILL_ENERGY,
	SQUADS,
	TROOP,
	TROOPS,
	TROOPS_PER_SQUAD,
	type BuildingKind,
	type SkillId
} from './config';

const OFFENSIVE: readonly BuildingKind[] = [
	'field-cannon',
	'mortar',
	'fpv-nest',
	'air-defence',
	'sniper',
	'mg',
	'flame'
];

describe('beachhead tuning', () => {
	it('uses a landscape grid with the beach on the left', () => {
		expect(COLUMNS).toBeGreaterThan(ROWS);
		expect(SHORE_X).toBeGreaterThan(0);
		expect(SHORE_X).toBeLessThan(COLUMNS / 4);
	});

	it('fits exactly the whole landing party into the three craft', () => {
		expect(SQUADS).toBe(3);
		expect(TROOPS_PER_SQUAD).toBeGreaterThan(0);
		expect(LANDING_PARTY).toBe(SQUADS * TROOPS_PER_SQUAD);
	});

	it('gives every building a solid footprint and health', () => {
		for (const [kind, stats] of Object.entries(BUILDINGS)) {
			expect(stats.width, kind).toBeGreaterThan(0);
			expect(stats.height, kind).toBeGreaterThan(0);
			expect(stats.hp, kind).toBeGreaterThan(0);
			expect(stats.score, kind).toBeGreaterThan(0);
		}
	});

	it('makes every offensive building able to reach and reload', () => {
		for (const kind of OFFENSIVE) {
			const stats = BUILDINGS[kind];
			expect(stats.damage, kind).toBeGreaterThan(0);
			expect(stats.range, kind).toBeGreaterThan(0);
			expect(stats.reloadMs, kind).toBeGreaterThan(0);
			expect(stats.splash, kind).toBeGreaterThanOrEqual(0);
		}
	});

	it('keeps the headquarters and depots harmless', () => {
		expect(BUILDINGS.hq.damage).toBe(0);
		expect(BUILDINGS.depot.damage).toBe(0);
		expect(BUILDINGS.hq.score).toBeGreaterThan(BUILDINGS.depot.score);
	});

	it('gives the mortar a dead zone and a wide splash', () => {
		expect(BUILDINGS.mortar.minRange).toBeGreaterThan(0);
		expect(BUILDINGS.mortar.splash).toBeGreaterThan(BUILDINGS['field-cannon'].splash);
		expect(BUILDINGS.mortar.targeting).toBe('farthest');
	});

	it('only marks the slow lobbed guns and the drone nest as projectiles', () => {
		const withProjectiles = OFFENSIVE.filter((kind) => BUILDINGS[kind].projectile);
		expect(withProjectiles.sort()).toEqual(['air-defence', 'fpv-nest', 'mortar'].sort());
		for (const kind of withProjectiles) {
			expect(BUILDINGS[kind].projectileSpeed, kind).toBeGreaterThan(0);
		}
		expect(BUILDINGS['fpv-nest'].homing).toBe(true);
		expect(BUILDINGS['air-defence'].homing).toBe(true);
		expect(BUILDINGS.mortar.homing).toBeUndefined();
	});

	it('picks the right troop for each kind of gun', () => {
		expect(BUILDINGS.sniper.targeting).toBe('weakest');
		expect(BUILDINGS['fpv-nest'].targeting).toBe('weakest');
		expect(BUILDINGS['air-defence'].targeting).toBe('farthest');
		expect(BUILDINGS.mg.targeting).toBeUndefined();
	});

	it('has a healthy, hard-hitting soldier that reacts to blasts', () => {
		expect(TROOP.hp).toBeGreaterThan(BUILDINGS.mg.damage);
		expect(TROOP.damage).toBeGreaterThan(0);
		expect(TROOP.range).toBeGreaterThan(TROOP.body);
		expect(TROOP.speed).toBeGreaterThan(0);
		expect(TROOP.knockback).toBeGreaterThan(0);
		expect(TROOP.drag).toBeGreaterThan(0);
		expect(TROOP.stunMs).toBeGreaterThan(0);
		expect(TROOP.muzzleMs).toBeGreaterThan(0);
	});

	it('uses every defensive structure somewhere in the campaign', () => {
		const used = new Set(ISLANDS.flatMap((island) => island.buildings.map((b) => b.kind)));
		for (const kind of Object.keys(BUILDINGS) as BuildingKind[]) {
			expect(used.has(kind), kind).toBe(true);
		}
	});

	it('keeps island ids unique and in sync with the id list', () => {
		expect(new Set(ISLAND_IDS).size).toBe(ISLANDS.length);
		expect(ISLAND_IDS).toEqual(ISLANDS.map((island) => island.id));
	});

	it('places every island inside the sea chart', () => {
		expect(ISLAND_MAP_POSITIONS).toHaveLength(ISLANDS.length);
		for (const [index, position] of ISLAND_MAP_POSITIONS.entries()) {
			expect(position.x, `island ${index} x`).toBeGreaterThan(0);
			expect(position.x, `island ${index} x`).toBeLessThan(100);
			expect(position.y, `island ${index} y`).toBeGreaterThan(0);
			expect(position.y, `island ${index} y`).toBeLessThan(100);
		}
	});

	it('gives every island exactly one headquarters', () => {
		for (const island of ISLANDS) {
			expect(
				island.buildings.filter((building) => building.kind === 'hq'),
				island.id
			).toHaveLength(1);
		}
	});

	it('gets harder from the first island to the last', () => {
		const health = (index: number) =>
			ISLANDS[index].buildings.reduce((sum, building) => sum + BUILDINGS[building.kind].hp, 0);
		const guns = (index: number) =>
			ISLANDS[index].buildings.filter((building) => BUILDINGS[building.kind].damage > 0).length;
		const threat = (index: number) =>
			ISLANDS[index].buildings.reduce(
				(sum, building) => sum + BUILDINGS[building.kind].hp + BUILDINGS[building.kind].damage * 10,
				0
			);

		expect(health(ISLANDS.length - 1)).toBeGreaterThan(health(0));
		expect(guns(ISLANDS.length - 1)).toBeGreaterThan(guns(0));
		expect(threat(ISLANDS.length - 1)).toBeGreaterThan(threat(0));
		// Late islands may trade raw health for more dangerous guns, but no later island is a pushover
		for (let index = 1; index < ISLANDS.length; index++) {
			expect(guns(index), ISLANDS[index].id).toBeGreaterThanOrEqual(guns(index - 1));
			expect(threat(index), ISLANDS[index].id).toBeGreaterThan(threat(0));
		}
	});
});

describe('the expanded landing party', () => {
	it('gives every troop kind real stats and a boat space that fits', () => {
		for (const [kind, stats] of Object.entries(TROOPS)) {
			expect(stats.hp, kind).toBeGreaterThan(0);
			expect(stats.damage, kind).toBeGreaterThan(0);
			expect(stats.range, kind).toBeGreaterThan(0);
			expect(stats.speed, kind).toBeGreaterThan(0);
			expect(stats.attackMs, kind).toBeGreaterThan(0);
			expect(stats.space, kind).toBeGreaterThanOrEqual(0);
			if (kind !== 'hero') expect(stats.space, kind).toBeLessThanOrEqual(BOAT_CAPACITY[1]);
		}
		// Both heroes ride along without taking up boat space
		expect(Object.entries(TROOPS).filter(([, stats]) => stats.space === 0)).toHaveLength(2);
	});

	it('has an area gun that cannot hit the same spot twice', () => {
		const artillery = TROOPS.artillery;
		expect(artillery.projectile).toBe('shell');
		expect(artillery.splash).toBeGreaterThan(TROOPS.mortar.splash);
		expect(artillery.scatter).toBeGreaterThan(1);
		// It outranges every other troop but pays for it with a slow reload
		for (const [kind, stats] of Object.entries(TROOPS)) {
			if (kind !== 'artillery') expect(artillery.range, kind).toBeGreaterThan(stats.range);
		}
		expect(artillery.attackMs).toBeGreaterThan(TROOPS.mortar.attackMs);
	});

	it('lets the M113 keep dropping reinforcements', () => {
		const apc = TROOPS.apc;
		expect(apc.spawnKind).toBe('assault');
		expect(apc.spawnEveryMs).toBeGreaterThan(0);
		expect(apc.spawnCap).toBeGreaterThan(0);
		// It is the toughest thing on the beach and barely shoots itself
		expect(apc.hp).toBeGreaterThan(TROOPS.tank.hp);
		expect(apc.damage).toBeLessThan(TROOPS.assault.damage);
	});

	it('trades all its staying power for one huge demolition charge', () => {
		const demo = TROOPS.demo;
		expect(demo.hp).toBeLessThan(TROOPS.assault.hp);
		expect(demo.damage).toBeGreaterThan(TROOPS.tank.damage * 4);
		expect(demo.splash).toBeGreaterThan(0);
		expect(demo.speed).toBeGreaterThan(TROOPS.assault.speed);
	});

	it('gives the heavy a minigun that fires faster than anything else', () => {
		const heavy = TROOPS.heavy;
		for (const [kind, stats] of Object.entries(TROOPS)) {
			if (kind !== 'heavy') expect(heavy.attackMs, kind).toBeLessThan(stats.attackMs);
		}
		expect(heavy.hp).toBeGreaterThan(TROOPS.assault.hp * 2);
	});
});

describe('beachhead support skills', () => {
	const skills = Object.keys(SKILLS) as SkillId[];

	it('offers all five support calls', () => {
		expect(skills.sort()).toEqual(['barrage', 'flamingo', 'flare', 'heal', 'smoke']);
	});

	it('gives every skill an area and a cost the HUD can show', () => {
		for (const skill of skills) {
			expect(SKILLS[skill].radius, skill).toBeGreaterThan(0);
			expect(SKILLS[skill].damage, skill).toBeGreaterThanOrEqual(0);
			expect(SKILLS[skill].delayMs, skill).toBeGreaterThanOrEqual(0);
		}
	});

	it('gives the two strikes damage and the three zones a duration', () => {
		expect(SKILLS.flamingo.damage).toBeGreaterThan(0);
		expect(SKILLS.barrage.damage).toBeGreaterThan(0);
		expect(SKILLS.barrage.shells).toBeGreaterThan(1);
		expect(SKILLS.barrage.scatter).toBeGreaterThan(0);
		for (const skill of ['flare', 'smoke', 'heal'] as const) {
			expect(SKILLS[skill].durationMs, skill).toBeGreaterThan(0);
			expect(SKILLS[skill].damage, skill).toBe(0);
		}
		expect(SKILLS.heal.healPerSecond).toBeGreaterThan(0);
	});

	it('starts with enough energy for the first call and raises the price each time', () => {
		expect(SKILL_ENERGY.start).toBeGreaterThanOrEqual(SKILL_ENERGY.baseCost);
		expect(SKILL_ENERGY.costStep).toBeGreaterThan(0);
		expect(SKILL_ENERGY.max).toBeGreaterThanOrEqual(SKILL_ENERGY.start);
		expect(SKILL_ENERGY.rewardPerBuilding).toBeGreaterThan(0);
	});
});
