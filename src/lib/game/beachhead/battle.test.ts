import { describe, expect, it } from 'vitest';
import {
	BUILDINGS,
	ISLANDS,
	ROWS,
	SQUADS,
	TROOP,
	TROOPS,
	TROOPS_PER_SQUAD,
	type Island,
	type TroopKind
} from './config';
import {
	createBattle,
	deploy,
	scoreOf,
	setFocus,
	starsOf,
	stepBattle,
	troopsAlive,
	type BattleState
} from './battle';

const OPEN_ISLAND: Island = { id: 'open', buildings: [{ kind: 'hq', x: 5, y: 3 }] };
const GUARDED_ISLAND: Island = {
	id: 'guarded',
	buildings: [
		{ kind: 'hq', x: 9, y: 3 },
		{ kind: 'mg', x: 2, y: 4 }
	]
};
const TWO_TARGETS: Island = {
	id: 'two-targets',
	buildings: [
		{ kind: 'hq', x: 9, y: 3 },
		{ kind: 'depot', x: 4, y: 1 },
		{ kind: 'depot', x: 4, y: 6 }
	]
};

function play(state: BattleState, seconds: number) {
	const step = 1000 / 60;
	for (let time = 0; time < seconds * 1000 && state.status === 'playing'; time += step) {
		stepBattle(state, step);
	}
	return state;
}

/** One landing-party unit built straight from the tuning table */
function unit(kind: TroopKind) {
	const stats = TROOPS[kind];
	return {
		kind,
		hp: stats.hp,
		damage: stats.damage,
		range: stats.range,
		speed: stats.speed,
		attackMs: stats.attackMs,
		projectile: stats.projectile,
		projectileSpeed: stats.projectileSpeed,
		splash: stats.splash,
		scatter: stats.scatter,
		spawnKind: stats.spawnKind,
		spawnEveryMs: stats.spawnEveryMs,
		spawnCap: stats.spawnCap
	};
}

const FAR_HQ: Island = { id: 'far-hq', buildings: [{ kind: 'hq', x: 9, y: 3 }] };

describe('landing', () => {
	it('starts with every craft and no troops ashore', () => {
		const state = createBattle(OPEN_ISLAND);
		expect(state.squadsLeft).toBe(SQUADS);
		expect(state.troops).toHaveLength(0);
		expect(state.status).toBe('playing');
	});

	it('lands one squad per tap and refuses off-map rows', () => {
		const state = createBattle(OPEN_ISLAND);
		expect(deploy(state, -1)).toBe(false);
		expect(deploy(state, ROWS)).toBe(false);
		expect(state.squadsLeft).toBe(SQUADS);

		expect(deploy(state, 3)).toBe(true);
		expect(state.troops).toHaveLength(TROOPS_PER_SQUAD);
		expect(state.squadsLeft).toBe(SQUADS - 1);

		deploy(state, 4);
		deploy(state, 5);
		expect(state.squadsLeft).toBe(0);
		expect(deploy(state, 3)).toBe(false);
	});

	it('lands the next squad on the tapped row', () => {
		const state = createBattle(OPEN_ISLAND);
		deploy(state, 5);
		for (const troop of state.troops) expect(troop.y).toBeCloseTo(5.5, 0);
	});
});

describe('the attack', () => {
	it('fortifies building health and damage after earlier captures', () => {
		const state = createBattle(GUARDED_ISLAND, { squads: [], defenseScale: 2 });
		const hq = state.buildings[0];
		const mg = state.buildings[1];
		expect(hq.maxHp).toBe(Math.round(BUILDINGS.hq.hp * 2));
		expect(hq.damage).toBe(0);
		expect(mg.damage).toBe(Math.round(BUILDINGS.mg.damage * 2));
		expect(mg.reloadMs).toBe(BUILDINGS.mg.reloadMs);
		expect(state.buildings[1].hp).toBe(Math.round(BUILDINGS.mg.hp * 2));
	});

	it('walks to an undefended headquarters and destroys it', () => {
		const battle = createBattle(OPEN_ISLAND);
		deploy(battle, 3);
		play(battle, 40);

		expect(battle.status).toBe('won');
		expect(battle.buildings[0].destroyed).toBe(true);
		expect(troopsAlive(battle)).toBe(TROOPS_PER_SQUAD);
		expect(starsOf(battle)).toBe(3);
		expect(scoreOf(battle)).toBeGreaterThan(BUILDINGS.hq.score);
	});

	it('lets a machine gun nest shoot the troops in front of it', () => {
		const state = createBattle(GUARDED_ISLAND);
		deploy(state, 4);
		play(state, 0.5);
		expect(state.troops.some((troop) => troop.hp < TROOP.hp)).toBe(true);
	});

	it('heads for the focused building before the nearest one', () => {
		const state = createBattle(TWO_TARGETS);
		const hq = state.buildings.find((building) => building.kind === 'hq')!;
		const depots = state.buildings.filter((building) => building.kind === 'depot');
		setFocus(state, hq.id);
		deploy(state, 4);
		play(state, 40);

		expect(hq.destroyed).toBe(true);
		expect(depots.every((depot) => !depot.destroyed)).toBe(true);
	});

	it('turns a tap on the water into no focus', () => {
		const state = createBattle(TWO_TARGETS);
		setFocus(state, state.buildings[0].id);
		setFocus(state, null);
		expect(state.focusId).toBeNull();
	});

	it('is lost when the whole landing party falls', () => {
		const island: Island = {
			id: 'death-row',
			buildings: [
				{ kind: 'hq', x: 9, y: 3 },
				...Array.from({ length: 8 }, (_, row) => ({ kind: 'mg' as const, x: 2, y: row }))
			]
		};
		const battle = createBattle(island);
		deploy(battle, 1);
		deploy(battle, 4);
		deploy(battle, 7);
		play(battle, 120);
		expect(battle.status).toBe('lost');
		expect(starsOf(battle)).toBe(0);
	});

	it('gives fewer stars when fewer troops come home', () => {
		const battle = createBattle(OPEN_ISLAND);
		deploy(battle, 3);
		play(battle, 40);
		expect(battle.status).toBe('won');

		for (const troop of battle.troops) troop.hp = 40;
		expect(starsOf(battle)).toBe(2);
		for (const troop of battle.troops) troop.hp = 10;
		expect(starsOf(battle)).toBe(1);
	});
});

describe('the special troops', () => {
	it('has the M113 drop reinforcements until its cap is reached', () => {
		const apc = { ...unit('apc'), spawnEveryMs: 100, spawnCap: 2 };
		const state = createBattle(FAR_HQ, { squads: [[apc]] });
		deploy(state, 3);
		play(state, 0.6);

		const spawned = state.troops.filter((troop) => troop.spawnedBy !== undefined);
		expect(spawned).toHaveLength(2);
		expect(spawned.every((troop) => troop.kind === 'assault')).toBe(true);
		expect(spawned.every((troop) => troop.maxHp === TROOPS.assault.hp)).toBe(true);
		expect(state.deployed).toBe(3);
		expect(state.events.filter((event) => event.kind === 'troop-spawn')).toHaveLength(2);

		// The cap holds even after many more spawn intervals
		play(state, 1);
		expect(state.troops.filter((troop) => troop.spawnedBy !== undefined)).toHaveLength(2);
	});

	it('scatters the field artillery around the aim point', () => {
		const state = createBattle(FAR_HQ, { squads: [[unit('artillery')]] });
		deploy(state, 3);
		play(state, 20);

		const shots = state.events.filter(
			(event) => event.kind === 'troop-shot' && event.troopKind === 'artillery'
		);
		expect(shots.length).toBeGreaterThan(0);
		for (const shot of shots) {
			if (shot.kind !== 'troop-shot') continue;
			// It aims at the left edge of the headquarters, but never lands right on it
			expect(Math.hypot(shot.toX - 9, shot.toY - 3.5)).toBeGreaterThan(0.4);
		}
	});

	it('lets a demolitionist blow up a headquarters with a handful of charges', () => {
		const island: Island = {
			id: 'demo-run',
			buildings: [{ kind: 'hq', x: 4, y: 3 }]
		};
		const state = createBattle(island, { squads: [[unit('demo')]] });
		deploy(state, 3);
		play(state, 15);

		expect(state.status).toBe('won');
		expect(state.buildings[0].destroyed).toBe(true);
	});
});

describe('the island layouts', () => {
	it('all sit on the map without overlapping and have one headquarters', () => {
		const cells = new Set<string>();
		for (const island of ISLANDS) {
			cells.clear();
			const hqs = island.buildings.filter((building) => building.kind === 'hq');
			expect(hqs, island.id).toHaveLength(1);
			for (const building of island.buildings) {
				const stats = BUILDINGS[building.kind];
				expect(building.x, `${island.id} ${building.kind} x`).toBeGreaterThanOrEqual(2);
				expect(building.x + stats.width, `${island.id} ${building.kind} right`).toBeLessThanOrEqual(
					12
				);
				expect(building.y, `${island.id} ${building.kind} top`).toBeGreaterThanOrEqual(0);
				expect(
					building.y + stats.height,
					`${island.id} ${building.kind} bottom`
				).toBeLessThanOrEqual(ROWS);
				for (let dx = 0; dx < stats.width; dx++) {
					for (let dy = 0; dy < stats.height; dy++) {
						const key = `${building.x + dx},${building.y + dy}`;
						expect(cells.has(key), `${island.id} overlaps at ${key}`).toBe(false);
						cells.add(key);
					}
				}
			}
		}
	});

	it('opens the islands in order and grows harder', () => {
		expect(new Set(ISLANDS.map((island) => island.id)).size).toBe(ISLANDS.length);
		expect(ISLANDS.length).toBeGreaterThanOrEqual(5);
		const guns = (island: Island) =>
			island.buildings.filter((building) => BUILDINGS[building.kind].damage > 0).length;
		expect(guns(ISLANDS[0])).toBeLessThanOrEqual(guns(ISLANDS[ISLANDS.length - 1]));
		expect(guns(ISLANDS[ISLANDS.length - 1])).toBeGreaterThanOrEqual(5);
	});
});
