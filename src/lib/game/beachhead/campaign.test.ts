import { describe, expect, it } from 'vitest';
import {
	BOAT_CAPACITY,
	BOAT_COUNT,
	ISLAND_IDS,
	MAX_BOAT_LEVEL,
	MAX_HQ_LEVEL,
	MAX_TRAINING_LEVEL,
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
	changeTroop,
	claimAchievements,
	claimIncome,
	controlIsland,
	controlledCount,
	finishBuilds,
	incomeRate,
	isBeachheadSave,
	isUnlocked,
	islandProduction,
	landingPlan,
	levelOf,
	lootFor,
	maxLevelOf,
	modifiersFor,
	newSave,
	parseSave,
	recordVictory,
	startUpgrade,
	starsOf,
	totalStars,
	troopStatsForLevel,
	troopUpgradeCost,
	troopUpgradeLocked,
	upgradeCost,
	upgradeLocked,
	usedArmySpace
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
			boats: Array.from({ length: BOAT_COUNT }, () => 1)
		});
		expect(save.builders).toEqual([]);
		expect(save.achievements).toEqual([]);
		expect(save.islands).toEqual({});
		expect(isUnlocked(save, ISLAND_IDS, 0)).toBe(true);
		expect(isUnlocked(save, ISLAND_IDS, 1)).toBe(false);
		expect(isUnlocked(save, ISLAND_IDS, 5)).toBe(false);
	});

	it('opens the next island only after the previous one is controlled', () => {
		const save = controlIsland(newSave(NOW), ISLAND_IDS[0], 2);
		expect(isUnlocked(save, ISLAND_IDS, 1)).toBe(true);
		expect(isUnlocked(save, ISLAND_IDS, 2)).toBe(false);
	});

	it('keeps the better stars when an island is taken again', () => {
		let save = controlIsland(newSave(NOW), ISLAND_IDS[0], 3);
		save = controlIsland(save, ISLAND_IDS[0], 1);
		expect(starsOf(save, ISLAND_IDS[0])).toBe(3);
		expect(starsOf(save, ISLAND_IDS[1])).toBe(0);
		expect(totalStars(save, ISLAND_IDS)).toBe(3);
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
		expect(migrated!.levels).toEqual({ hq: 3, training: 3, boats });
		expect(migrated!.troops.tank).toBe(2);
		expect(migrated!.army.assault).toBe(6);
		expect(migrated!.resources.wood).toBe(50);
		expect(migrated!.islands[ISLAND_IDS[0]]).toEqual({ stars: 2, controlled: true });
	});

	it('returns null for anything that is neither a current nor a known old save', () => {
		expect(parseSave(null)).toBeNull();
		expect(parseSave({ version: 1 })).toBeNull();
		expect(parseSave({ version: 4, resources: STARTING_RESOURCES })).toBeNull();
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
		expect(incomeRate(save, ISLAND_IDS).wood).toBe(3.8);
		expect(islandProduction(save, 0).stone).toBe(1.3);
	});

	it('banks whole minutes only', () => {
		const save = newSave(NOW);
		expect(claimIncome(save, ISLAND_IDS, NOW + 30_000)).toBe(save);
		const minute = claimIncome(save, ISLAND_IDS, NOW + 60_000);
		expect(minute.resources).toEqual({
			wood: STARTING_RESOURCES.wood + HOME_PRODUCTION.wood,
			stone: STARTING_RESOURCES.stone,
			iron: STARTING_RESOURCES.iron,
			gold: STARTING_RESOURCES.gold
		});
		expect(minute.lastIncomeMs).toBe(NOW + 60_000);
	});

	it('stops earning after the cap', () => {
		const save = newSave(NOW);
		const capped = claimIncome(save, ISLAND_IDS, NOW + INCOME_CAP_MS * 3);
		expect(capped.resources.wood).toBe(
			STARTING_RESOURCES.wood + HOME_PRODUCTION.wood * (INCOME_CAP_MS / 60_000)
		);
		expect(capped.lastIncomeMs).toBe(NOW + INCOME_CAP_MS * 3);
	});

	it('adds loot to the stock and never subtracts below zero', () => {
		const save = addResources(newSave(NOW), { wood: 85, stone: 3, iron: 2, gold: 1 });
		expect(save.resources.wood).toBe(STARTING_RESOURCES.wood + 85);
		expect(save.resources.gold).toBe(STARTING_RESOURCES.gold + 1);
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
				boats: Array.from({ length: BOAT_COUNT }, () => MAX_BOAT_LEVEL)
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
		expect(loads[0].units).toEqual(['tank']);
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
				boats: Array.from({ length: BOAT_COUNT }, () => MAX_BOAT_LEVEL)
			}
		};
		expect(ACHIEVEMENTS.find((a) => a.id === 'fortress')!.check(maxed)).toBe(true);
		const stars = {
			...maxed,
			islands: Object.fromEntries(ISLAND_IDS.map((id) => [id, { stars: 3, controlled: true }]))
		};
		expect(ACHIEVEMENTS.find((a) => a.id === 'all-stars')!.check(stars)).toBe(true);
	});
});
