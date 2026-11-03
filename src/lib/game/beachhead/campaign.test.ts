import { describe, expect, it } from 'vitest';
import {
	BOAT_CAPACITY,
	BOAT_COUNT,
	BASE_CHARTED_ISLANDS,
	ISLAND_IDS,
	MAX_BOAT_LEVEL,
	MAX_HQ_LEVEL,
	MAX_RADAR_LEVEL,
	MAX_TRAINING_LEVEL,
	MAX_WAREHOUSE_LEVEL,
	STARTING_BOATS,
	TROOPS
} from './config';
import {
	ACHIEVEMENTS,
	BUILDING_KEYS,
	HOME_PRODUCTION,
	INCOME_CAP_MS,
	ISLAND_PRODUCTION,
	SAVE_VERSION,
	STARTING_RESOURCES,
	TAKEBACK_INTERVAL_MS,
	WAREHOUSE_KEYS,
	WAREHOUSES_PER_RESOURCE,
	STORAGE_BASE,
	STORAGE_PER_LEVEL,
	addResources,
	applyTroopUpgrade,
	armyCapacity,
	boatCapacity,
	boatLoads,
	boatUnlocked,
	boatsAtHq,
	buildDurationMs,
	builderSlots,
	canUpgrade,
	canUpgradeTroop,
	capturesOf,
	changeTroop,
	chartedCount,
	claimAchievements,
	claimIncome,
	controlIsland,
	controlledCount,
	everCaptured,
	finishBuilds,
	fortificationScale,
	incomeRate,
	isBeachheadSave,
	isCharted,
	isUnlocked,
	islandProduction,
	landingPlan,
	levelOf,
	lootFor,
	maxLevelOf,
	modifiersFor,
	newSave,
	parseSave,
	processTakebacks,
	recordVictory,
	startUpgrade,
	starsOf,
	storageCapacity,
	totalStars,
	troopStatsForLevel,
	troopUpgradeCost,
	troopUpgradeLocked,
	upgradeCost,
	upgradeLocked,
	usedArmySpace,
	warehouseIndex,
	warehouseResource
} from './campaign';

const NOW = Date.UTC(2026, 10, 2, 12, 0, 0);

function saveWithControlled(...indexes: number[]) {
	let save = newSave(NOW);
	for (const index of indexes) save = controlIsland(save, ISLAND_IDS[index], 2);
	return save;
}

function richSave() {
	return {
		...newSave(NOW),
		resources: { wood: 100_000, stone: 100_000, iron: 100_000, gold: 100_000 }
	};
}

describe('the campaign save', () => {
	it('starts with a small stock, level one everywhere and only the first island open', () => {
		const save = newSave(NOW);
		expect(save.version).toBe(SAVE_VERSION);
		expect(save.resources).toEqual(STARTING_RESOURCES);
		expect(save.levels).toEqual({
			hq: 1,
			training: 1,
			radar: 1,
			dojo: 1,
			bunker: 1,
			boats: Array.from({ length: BOAT_COUNT }, () => 1),
			warehouses: Array.from({ length: WAREHOUSE_KEYS.length }, () => 1)
		});
		expect(save.hero).toEqual({ level: 1, skill: 1, cards: 0 });
		expect(save.builders).toEqual([]);
		expect(save.achievements).toEqual([]);
		expect(save.islands).toEqual({});
		expect(isUnlocked(save, ISLAND_IDS, 0)).toBe(true);
		expect(isUnlocked(save, ISLAND_IDS, 1)).toBe(false);
		expect(isUnlocked(save, ISLAND_IDS, 5)).toBe(false);
	});

	it('opens the next island only after the previous one has been taken', () => {
		const save = controlIsland(newSave(NOW), ISLAND_IDS[0], 2);
		expect(isUnlocked(save, ISLAND_IDS, 1)).toBe(true);
		expect(isUnlocked(save, ISLAND_IDS, 2)).toBe(false);
	});

	it('charts only the first six islands until the radar tower is upgraded', () => {
		const save = newSave(NOW);
		expect(chartedCount(save)).toBe(BASE_CHARTED_ISLANDS);
		expect(isCharted(save, BASE_CHARTED_ISLANDS - 1)).toBe(true);
		expect(isCharted(save, BASE_CHARTED_ISLANDS)).toBe(false);
		const upgraded = { ...save, levels: { ...save.levels, radar: MAX_RADAR_LEVEL } };
		expect(chartedCount(upgraded)).toBe(ISLAND_IDS.length);
		expect(isCharted(upgraded, ISLAND_IDS.length - 1)).toBe(true);
	});

	it('keeps the next island open after the enemy retakes the one before it', () => {
		let save = controlIsland(newSave(NOW), ISLAND_IDS[0], 3);
		save = controlIsland(save, ISLAND_IDS[1], 2);
		const result = processTakebacks(save, ISLAND_IDS, NOW + TAKEBACK_INTERVAL_MS, () => 0);
		expect(result.lost).toEqual([ISLAND_IDS[0]]);
		expect(everCaptured(result.save, ISLAND_IDS[0])).toBe(true);
		expect(isUnlocked(result.save, ISLAND_IDS, 1)).toBe(true);
		expect(isUnlocked(result.save, ISLAND_IDS, 2)).toBe(true);
	});

	it('keeps the better stars when an island is taken again', () => {
		let save = controlIsland(newSave(NOW), ISLAND_IDS[0], 3);
		save = controlIsland(save, ISLAND_IDS[0], 1);
		expect(starsOf(save, ISLAND_IDS[0])).toBe(3);
		expect(starsOf(save, ISLAND_IDS[1])).toBe(0);
		expect(totalStars(save, ISLAND_IDS)).toBe(3);
	});

	it('counts every capture and hardens the island each time', () => {
		let save = controlIsland(newSave(NOW), ISLAND_IDS[0], 2);
		expect(capturesOf(save, ISLAND_IDS[0])).toBe(1);
		expect(fortificationScale(0)).toBe(1);
		expect(fortificationScale(1)).toBeCloseTo(1.2);
		save = controlIsland(save, ISLAND_IDS[0], 3);
		expect(capturesOf(save, ISLAND_IDS[0])).toBe(2);
		expect(modifiersFor(save, ISLAND_IDS[0]).defenseScale).toBeCloseTo(1.4);
		expect(fortificationScale(20)).toBe(3);
	});

	it('retakes one random controlled island every six hours and keeps its stars', () => {
		const save = saveWithControlled(0, 1, 2);
		const first = processTakebacks(save, ISLAND_IDS, NOW + TAKEBACK_INTERVAL_MS, () => 0);
		expect(first.lost).toEqual([ISLAND_IDS[0]]);
		expect(first.save.islands[ISLAND_IDS[0]]).toMatchObject({
			controlled: false,
			stars: 2,
			captures: 1
		});
		expect(controlledCount(first.save, ISLAND_IDS)).toBe(2);

		const later = processTakebacks(
			first.save,
			ISLAND_IDS,
			NOW + TAKEBACK_INTERVAL_MS * 3,
			() => 0.99
		);
		expect(later.lost).toHaveLength(2);
		expect(controlledCount(later.save, ISLAND_IDS)).toBe(0);
		expect(later.save.lastTakebackMs).toBe(NOW + TAKEBACK_INTERVAL_MS * 3);
	});

	it('does not retake an island when the player holds none', () => {
		const save = newSave(NOW);
		const result = processTakebacks(save, ISLAND_IDS, NOW + TAKEBACK_INTERVAL_MS * 2, () => 0);
		expect(result.lost).toEqual([]);
		expect(result.save.lastTakebackMs).toBe(NOW + TAKEBACK_INTERVAL_MS * 2);
	});

	it('pays more for a first capture than for a replay, and more on later islands', () => {
		expect(lootFor(0, true).wood).toBeGreaterThan(lootFor(0, false).wood);
		expect(lootFor(5, true).wood).toBeGreaterThan(lootFor(0, true).wood);
	});

	it('rejects broken save files', () => {
		const save = newSave(NOW);
		expect(isBeachheadSave(save)).toBe(true);
		expect(isBeachheadSave(null)).toBe(false);
		expect(isBeachheadSave({ ...save, version: 2 })).toBe(false);
		expect(isBeachheadSave({ ...save, resources: { ...save.resources, wood: -1 } })).toBe(false);
		expect(isBeachheadSave({ ...save, resources: { wood: Number.NaN } })).toBe(false);
		expect(isBeachheadSave({ ...save, levels: { ...save.levels, hq: 0 } })).toBe(false);
		expect(isBeachheadSave({ ...save, levels: { ...save.levels, boats: [1] } })).toBe(false);
		expect(isBeachheadSave({ ...save, builders: [{ key: 'nope' }] })).toBe(false);
		expect(isBeachheadSave({ ...save, achievements: [1] })).toBe(false);
		expect(
			isBeachheadSave({
				...save,
				islands: { [ISLAND_IDS[0]]: { stars: 4, controlled: true } }
			})
		).toBe(false);
		expect(
			isBeachheadSave({
				...save,
				islands: { [ISLAND_IDS[0]]: { stars: 0, controlled: true } }
			})
		).toBe(false);
	});
});

describe('migrating older saves', () => {
	it('turns the single stock and the three upgrades of version 1 into the new economy', () => {
		const migrated = parseSave({
			version: 1,
			supplies: 100,
			upgrades: { hq: 2, troops: 2, landing: 2 },
			islands: {},
			lastIncomeMs: NOW
		});
		expect(migrated).not.toBeNull();
		expect(migrated!.version).toBe(SAVE_VERSION);
		expect(migrated!.resources).toEqual({ wood: 100, stone: 60, iron: 30, gold: 10 });
		expect(migrated!.levels.hq).toBe(2);
		expect(migrated!.levels.training).toBe(2);
		expect(migrated!.levels.boats.slice(0, 4)).toEqual([2, 2, 2, 1]);
		expect(migrated!.builders).toEqual([]);
		expect(migrated!.achievements).toEqual([]);
		expect(usedArmySpace(migrated!)).toBeLessThanOrEqual(armyCapacity(migrated!));
	});

	it('keeps the levels and army of a version 2 save', () => {
		const boats = Array.from({ length: BOAT_COUNT }, () => 3);
		const migrated = parseSave({
			version: 2,
			supplies: 50,
			levels: { hq: 3, training: 3, boats },
			troops: { assault: 3, tank: 2, mortar: 1, drone: 1, medic: 1, hero: 1 },
			army: { assault: 6, tank: 2, mortar: 0, drone: 0, medic: 0 },
			islands: { [ISLAND_IDS[0]]: { stars: 2, controlled: true } },
			lastIncomeMs: NOW
		});
		expect(migrated).not.toBeNull();
		expect(migrated!.levels).toEqual({
			hq: 3,
			training: 3,
			radar: 1,
			dojo: 1,
			boats,
			warehouses: Array.from({ length: WAREHOUSE_KEYS.length }, () => 1)
		});
		expect(migrated!.troops.tank).toBe(2);
		expect(migrated!.army.assault).toBe(6);
		expect(migrated!.resources.wood).toBe(50);
		expect(migrated!.islands[ISLAND_IDS[0]]).toEqual({
			stars: 2,
			controlled: true,
			captures: 1
		});
	});

	it('adds the radar tower, takeback clock and capture counts to a version 3 save', () => {
		const current = newSave(NOW);
		const legacyV3 = {
			...current,
			version: 3,
			levels: { hq: 2, training: 2, boats: current.levels.boats },
			islands: {
				[ISLAND_IDS[0]]: { stars: 2, controlled: true },
				[ISLAND_IDS[1]]: { stars: 3, controlled: false }
			}
		} as Record<string, unknown>;
		delete legacyV3.lastTakebackMs;
		const migrated = parseSave(legacyV3);
		expect(migrated).not.toBeNull();
		expect(migrated!.version).toBe(SAVE_VERSION);
		expect(migrated!.levels.radar).toBe(1);
		expect(migrated!.lastTakebackMs).toBe(NOW);
		expect(migrated!.islands[ISLAND_IDS[0]].captures).toBe(1);
		expect(migrated!.islands[ISLAND_IDS[1]].captures).toBe(1);
	});

	it('adds warehouses to a version 4 save', () => {
		const current = newSave(NOW);
		const legacyV4 = {
			...current,
			version: 4,
			levels: {
				hq: current.levels.hq,
				training: current.levels.training,
				radar: current.levels.radar,
				boats: current.levels.boats
			}
		} as Record<string, unknown>;
		const migrated = parseSave(legacyV4);
		expect(migrated).not.toBeNull();
		expect(migrated!.version).toBe(SAVE_VERSION);
		expect(migrated!.levels.warehouses).toHaveLength(WAREHOUSE_KEYS.length);
		expect(migrated!.levels.warehouses.every((level) => level === 1)).toBe(true);
	});

	it('returns null for anything that is neither a current nor a known old save', () => {
		expect(parseSave(null)).toBeNull();
		expect(parseSave({ version: 1 })).toBeNull();
		expect(parseSave({ version: 6, resources: STARTING_RESOURCES })).toBeNull();
	});
});

describe('production', () => {
	it('pays only the home shore with no islands controlled', () => {
		expect(incomeRate(newSave(NOW), ISLAND_IDS)).toEqual(HOME_PRODUCTION);
	});

	it('adds the production of every controlled island', () => {
		const save = saveWithControlled(0, 2);
		expect(controlledCount(save, ISLAND_IDS)).toBe(2);
		const income = incomeRate(save, ISLAND_IDS);
		for (const kind of ['wood', 'stone', 'iron', 'gold'] as const) {
			expect(income[kind]).toBe(
				HOME_PRODUCTION[kind] + ISLAND_PRODUCTION[0][kind] + ISLAND_PRODUCTION[2][kind]
			);
		}
	});

	it('raises all income with the headquarters', () => {
		let save = saveWithControlled(0);
		save = { ...save, levels: { ...save.levels, hq: 2 } };
		// 1.25 times the home wood and the first island's line
		expect(incomeRate(save, ISLAND_IDS).wood).toBeCloseTo(
			Math.round(1.25 * (HOME_PRODUCTION.wood + ISLAND_PRODUCTION[0].wood) * 10) / 10,
			5
		);
		expect(islandProduction(save, 0).stone).toBe(1.3);
	});

	it('banks whole minutes only', () => {
		const save = newSave(NOW);
		expect(claimIncome(save, ISLAND_IDS, NOW + 30_000)).toBe(save);
		const minute = claimIncome(save, ISLAND_IDS, NOW + 60_000);
		expect(minute.resources).toEqual({
			wood: STARTING_RESOURCES.wood + HOME_PRODUCTION.wood,
			stone: STARTING_RESOURCES.stone + HOME_PRODUCTION.stone,
			iron: STARTING_RESOURCES.iron + HOME_PRODUCTION.iron,
			gold: STARTING_RESOURCES.gold + HOME_PRODUCTION.gold
		});
		expect(minute.lastIncomeMs).toBe(NOW + 60_000);
	});

	it('stops earning after the cap', () => {
		const save = newSave(NOW);
		const capped = claimIncome(save, ISLAND_IDS, NOW + INCOME_CAP_MS * 3);
		expect(capped.resources.wood).toBe(
			Math.min(
				storageCapacity(save, 'wood'),
				STARTING_RESOURCES.wood + HOME_PRODUCTION.wood * (INCOME_CAP_MS / 60_000)
			)
		);
		expect(capped.lastIncomeMs).toBe(NOW + INCOME_CAP_MS * 3);
	});

	it('adds loot to the stock and never subtracts below zero', () => {
		const save = addResources(newSave(NOW), { wood: 85, stone: 3, iron: 2, gold: 1 });
		expect(save.resources.wood).toBe(STARTING_RESOURCES.wood + 85);
		expect(save.resources.gold).toBe(STARTING_RESOURCES.gold + 1);
	});

	it('stops a stockpile at the warehouse capacity', () => {
		const save = richSave();
		const full = { ...save, resources: { wood: 0, stone: 0, iron: 0, gold: 0 } };
		const loot = addResources(full, {
			wood: 1_000_000,
			stone: 1_000_000,
			iron: 1_000_000,
			gold: 1_000_000
		});
		for (const kind of ['wood', 'stone', 'iron', 'gold'] as const) {
			expect(loot.resources[kind]).toBe(storageCapacity(full, kind));
		}
	});
});

describe('warehouses', () => {
	it('gives every resource two warehouses', () => {
		expect(WAREHOUSE_KEYS).toHaveLength(WAREHOUSES_PER_RESOURCE * 4);
		for (const key of WAREHOUSE_KEYS) {
			expect(warehouseIndex(key)).toBeGreaterThanOrEqual(0);
			expect(warehouseIndex(key)).toBeLessThan(WAREHOUSES_PER_RESOURCE);
			expect(['wood', 'stone', 'iron', 'gold']).toContain(warehouseResource(key));
		}
		const save = newSave(NOW);
		expect(save.levels.warehouses).toHaveLength(WAREHOUSE_KEYS.length);
		expect(levelOf(save, WAREHOUSE_KEYS[0])).toBe(1);
	});

	it('starts with room for the first upgrade and grows with every warehouse level', () => {
		const save = newSave(NOW);
		const base = STORAGE_BASE + WAREHOUSES_PER_RESOURCE * STORAGE_PER_LEVEL;
		expect(storageCapacity(save, 'wood')).toBe(base);
		const raised = {
			...save,
			levels: {
				...save.levels,
				warehouses: save.levels.warehouses.map((level, index) => (index === 0 ? level + 1 : level))
			}
		};
		expect(storageCapacity(raised, 'wood')).toBe(base + STORAGE_PER_LEVEL);
		expect(storageCapacity(raised, 'stone')).toBe(base);
	});

	it('upgrades one warehouse at a time on a builder', () => {
		const save = richSave();
		const key = WAREHOUSE_KEYS[0];
		expect(canUpgrade(save, key)).toBe(true);
		const started = startUpgrade(save, key, NOW, 1)!;
		expect(started).not.toBeNull();
		expect(started.builders[0].key).toBe(key);
		const finished = finishBuilds(started, started.builders[0].endsAt);
		expect(levelOf(finished, key)).toBe(2);
		expect(storageCapacity(finished, warehouseResource(key))).toBeGreaterThan(
			storageCapacity(save, warehouseResource(key))
		);
	});

	it('stops at the maximum warehouse level', () => {
		const save = richSave();
		const key = WAREHOUSE_KEYS[0];
		const maxed = {
			...save,
			levels: {
				...save.levels,
				hq: MAX_HQ_LEVEL,
				warehouses: save.levels.warehouses.map((level, index) =>
					index === 0 ? MAX_WAREHOUSE_LEVEL : level
				)
			}
		};
		expect(upgradeCost(maxed, key)).toBeNull();
		expect(canUpgrade(maxed, key)).toBe(false);
	});
});

describe('buildings and builders', () => {
	it('charges resources and starts a timed build on one builder', () => {
		const save = newSave(NOW);
		const cost = upgradeCost(save, 'boat-0');
		expect(cost).not.toBeNull();
		expect(canUpgrade(save, 'boat-0')).toBe(true);
		const started = startUpgrade(save, 'boat-0', NOW, 1);
		expect(started).not.toBeNull();
		expect(started!.builders).toHaveLength(1);
		expect(started!.resources.wood).toBe(save.resources.wood - cost!.wood);
		expect(started!.levels.boats[0]).toBe(1);
		// A single builder slot cannot take a second job
		expect(startUpgrade(started!, 'boat-1', NOW, 1)).toBeNull();
		// Pro's second slot can
		expect(startUpgrade(started!, 'boat-1', NOW, 2)).not.toBeNull();
	});

	it('refuses an upgrade that costs more than the stock', () => {
		const save = newSave(NOW);
		expect(canUpgrade(save, 'hq')).toBe(false);
		expect(startUpgrade(save, 'hq', NOW, 1)).toBeNull();
	});

	it('finishes a build exactly when its timer runs out', () => {
		const started = startUpgrade(newSave(NOW), 'boat-0', NOW, 1)!;
		const task = started.builders[0];
		const duration = task.endsAt - task.startedAt;
		expect(duration).toBe(buildDurationMs('boat-0', 1));
		expect(finishBuilds(started, task.endsAt - 1)).toBe(started);
		const finished = finishBuilds(started, task.endsAt);
		expect(finished.builders).toHaveLength(0);
		expect(finished.levels.boats[0]).toBe(2);
	});

	it('takes longer for every level and family', () => {
		expect(buildDurationMs('hq', 2)).toBeGreaterThan(buildDurationMs('hq', 1));
		expect(buildDurationMs('hq', 1)).toBeGreaterThan(buildDurationMs('training', 1));
		expect(buildDurationMs('training', 1)).toBeGreaterThan(buildDurationMs('boat-0', 1));
	});

	it('only lets training and boats outgrow the headquarters by one level', () => {
		const save = richSave();
		expect(upgradeLocked(save, 'training')).toBe(false);
		const training = startUpgrade(save, 'training', NOW, 1)!;
		const done = finishBuilds(training, training.builders[0].endsAt);
		expect(levelOf(done, 'training')).toBe(2);
		expect(upgradeLocked(done, 'training')).toBe(true);

		const hq = startUpgrade(richSave(), 'hq', NOW, 1)!;
		const raised = finishBuilds(hq, hq.builders[0].endsAt);
		expect(levelOf(raised, 'hq')).toBe(2);
		expect(upgradeLocked(raised, 'training')).toBe(false);
	});

	it('stops at the maximum level of every building', () => {
		const save = richSave();
		const maxed = {
			...save,
			levels: {
				hq: MAX_HQ_LEVEL,
				training: MAX_TRAINING_LEVEL,
				radar: MAX_RADAR_LEVEL,
				boats: Array.from({ length: BOAT_COUNT }, () => MAX_BOAT_LEVEL),
				warehouses: Array.from({ length: WAREHOUSE_KEYS.length }, () => MAX_WAREHOUSE_LEVEL)
			}
		};
		for (const key of BUILDING_KEYS) {
			expect(upgradeCost(maxed, key), key).toBeNull();
			expect(canUpgrade(maxed, key), key).toBe(false);
			expect(maxLevelOf(key), key).toBeGreaterThan(0);
		}
	});

	it('gives a Pro subscriber a second builder slot', () => {
		expect(builderSlots(false)).toBe(1);
		expect(builderSlots(true)).toBe(2);
	});
});

describe('boats and the landing party', () => {
	it('starts with three boats and adds one per headquarters level', () => {
		expect(boatsAtHq(1)).toBe(STARTING_BOATS);
		expect(boatsAtHq(2)).toBe(STARTING_BOATS + 1);
		expect(boatsAtHq(8)).toBe(BOAT_COUNT);
		const save = newSave(NOW);
		expect(boatUnlocked(save, 2)).toBe(true);
		expect(boatUnlocked(save, 3)).toBe(false);
	});

	it('grows the boat capacity with every level', () => {
		for (let level = 1; level < MAX_BOAT_LEVEL; level++) {
			expect(boatCapacity(level + 1)).toBeGreaterThan(boatCapacity(level));
		}
		expect(boatCapacity(1)).toBe(BOAT_CAPACITY[1]);
	});

	it('refuses to load more units than the boats can carry', () => {
		const save = newSave(NOW);
		expect(usedArmySpace(save)).toBe(18);
		expect(armyCapacity(save)).toBe(18);
		expect(changeTroop(save, 'assault', 1)).toBe(save);
		const lighter = changeTroop(save, 'assault', -1);
		expect(lighter.army.assault).toBe(17);
		expect(changeTroop(lighter, 'assault', 1).army.assault).toBe(18);
	});

	it('packs big units first and puts the hero on the first boat', () => {
		const save = {
			...newSave(NOW),
			army: {
				assault: 0,
				tank: 3,
				mortar: 0,
				drone: 0,
				medic: 0,
				artillery: 0,
				apc: 0,
				demo: 0,
				heavy: 0
			}
		};
		// A tank takes six spaces, so each starting boat carries exactly one
		const loads = boatLoads(save);
		expect(loads[0].units).toEqual(['tank', 'hero']);
		expect(loads[1].units).toEqual(['tank']);
		expect(loads[2].units).toEqual(['tank']);
		expect(loads[3].units).toHaveLength(0);

		const plan = landingPlan(save);
		expect(plan).toHaveLength(3);
		expect(plan[0].filter((troop) => troop.kind === 'hero')).toHaveLength(1);
		expect(plan[0][plan[0].length - 1].kind).toBe('hero');
	});

	it('packs the new heavy units before the lighter ones', () => {
		const save = {
			...newSave(NOW),
			army: {
				assault: 0,
				tank: 0,
				mortar: 0,
				drone: 0,
				medic: 0,
				artillery: 1,
				apc: 1,
				demo: 1,
				heavy: 1
			}
		};
		// APC 5, artillery 4 + demo 2, heavy 4: exactly the three starting boats
		const loads = boatLoads(save);
		expect(loads[0].units).toEqual(['apc']);
		expect(loads[1].units).toEqual(['artillery', 'demo']);
		expect(loads[2].units).toEqual(['heavy']);
		expect(landingPlan(save)[0].map((troop) => troop.kind)).toEqual(['apc', 'hero']);
	});

	it('counts the boat space of every new unit when the army changes', () => {
		const save = newSave(NOW);
		// The starting army already fills all three boats
		expect(changeTroop(save, 'apc', 1)).toBe(save);
		expect(changeTroop(save, 'heavy', 1)).toBe(save);
		const room = changeTroop(save, 'assault', -5);
		expect(changeTroop(room, 'apc', 1).army.apc).toBe(1);
		expect(usedArmySpace(changeTroop(room, 'apc', 1))).toBe(18);
	});

	it('still sends the hero alone when every boat is empty', () => {
		const save = {
			...newSave(NOW),
			army: {
				assault: 0,
				tank: 0,
				mortar: 0,
				drone: 0,
				medic: 0,
				artillery: 0,
				apc: 0,
				demo: 0,
				heavy: 0
			}
		};
		const plan = modifiersFor(save).squads;
		expect(plan).toHaveLength(1);
		expect(plan[0]).toHaveLength(1);
		expect(plan[0][0].kind).toBe('hero');
	});
});

describe('troop training', () => {
	it('needs a training ground above the troop level', () => {
		const save = newSave(NOW);
		expect(troopUpgradeLocked(save, 'assault')).toBe(true);
		expect(canUpgradeTroop(save, 'assault')).toBe(false);
		const raised = richSave();
		const trained = {
			...raised,
			levels: { ...raised.levels, training: 3 }
		};
		expect(troopUpgradeLocked(trained, 'assault')).toBe(false);
		expect(canUpgradeTroop(trained, 'assault')).toBe(true);
	});

	it('charges the cost, raises the level and makes the troop tougher', () => {
		const base = richSave();
		const save = { ...base, levels: { ...base.levels, training: 3 } };
		const cost = troopUpgradeCost(save, 'assault')!;
		const trained = applyTroopUpgrade(save, 'assault');
		expect(trained.troops.assault).toBe(2);
		expect(trained.resources.wood).toBe(save.resources.wood - cost.wood);
		expect(troopStatsForLevel('assault', 2).hp).toBeGreaterThan(TROOP_HIT('assault'));
	});

	it('stops at the top troop level', () => {
		const base = richSave();
		const save = {
			...base,
			levels: { ...base.levels, training: MAX_TRAINING_LEVEL },
			troops: { assault: 8, tank: 8, mortar: 8, drone: 8, medic: 8, hero: 8 }
		};
		expect(troopUpgradeCost(save, 'assault')).toBeNull();
		expect(canUpgradeTroop(save, 'tank')).toBe(false);
	});
});

function TROOP_HIT(kind: keyof typeof TROOPS): number {
	return TROOPS[kind].hp;
}

describe('achievements', () => {
	it('pays the first landing once and only once', () => {
		const save = controlIsland(newSave(NOW), ISLAND_IDS[0], 2);
		const payout = claimAchievements(save);
		expect(payout.earned).toContain('first-landing');
		expect(payout.coins).toBeGreaterThanOrEqual(25);
		const again = claimAchievements(payout.save);
		expect(again.earned).toEqual([]);
		expect(again.coins).toBe(0);
	});

	it('tracks the wins, the hero and the skill-free runs', () => {
		let save = newSave(NOW);
		save = recordVictory(save, { stars: 3, skillsUsed: 0, heroAlive: true });
		save = recordVictory(save, { stars: 1, skillsUsed: 2, heroAlive: false });
		expect(save.stats).toEqual({
			wins: 2,
			threeStarWins: 1,
			winsWithoutSkills: 1,
			heroWins: 1
		});
	});

	it('lists every achievement with a positive Fake News reward', () => {
		expect(new Set(ACHIEVEMENTS.map((achievement) => achievement.id)).size).toBe(
			ACHIEVEMENTS.length
		);
		for (const achievement of ACHIEVEMENTS) {
			expect(achievement.coins, achievement.id).toBeGreaterThan(0);
		}
	});

	it('pays the fortress reward only for a fully maxed base', () => {
		const partial = richSave();
		expect(ACHIEVEMENTS.find((a) => a.id === 'fortress')!.check(partial)).toBe(false);
		const maxed = {
			...partial,
			levels: {
				hq: MAX_HQ_LEVEL,
				training: MAX_TRAINING_LEVEL,
				radar: MAX_RADAR_LEVEL,
				boats: Array.from({ length: BOAT_COUNT }, () => MAX_BOAT_LEVEL),
				warehouses: Array.from({ length: WAREHOUSE_KEYS.length }, () => MAX_WAREHOUSE_LEVEL)
			}
		};
		expect(ACHIEVEMENTS.find((a) => a.id === 'fortress')!.check(maxed)).toBe(true);
		const stars = {
			...maxed,
			islands: Object.fromEntries(
				ISLAND_IDS.map((id) => [id, { stars: 3, controlled: true, captures: 1 }])
			)
		};
		expect(ACHIEVEMENTS.find((a) => a.id === 'all-stars')!.check(stars)).toBe(true);
	});
});
