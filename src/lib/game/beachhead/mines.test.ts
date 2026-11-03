import { describe, expect, it } from 'vitest';
import {
	BUILDINGS,
	ISLANDS,
	MINES,
	MINE_KINDS,
	TROOPS,
	VEHICLE_TROOPS,
	isMine,
	type Island,
	type MineKind,
	type TroopKind
} from './config';
import {
	castSkill,
	createBattle,
	deploy,
	scoreOf,
	setFocus,
	stepBattle,
	type BattleState
} from './battle';

function unit(kind: TroopKind) {
	const stats = TROOPS[kind];
	return {
		kind,
		hp: stats.hp,
		damage: stats.damage,
		range: stats.range,
		speed: stats.speed,
		attackMs: stats.attackMs
	};
}

function islandWith(mine: MineKind): Island {
	return {
		id: 'mined',
		buildings: [
			{ kind: 'hq', x: 9, y: 3 },
			{ kind: mine, x: 5, y: 3 }
		]
	};
}

/** A battle with one landed troop of a kind standing on the mine's cell */
function troopOnMine(mine: MineKind, kind: TroopKind): BattleState {
	const state = createBattle(islandWith(mine), { squads: [[unit(kind)]] });
	deploy(state, 3);
	const troop = state.troops[0];
	troop.x = 5.5;
	troop.y = 3.5;
	stepBattle(state, 16);
	return state;
}

describe('mines', () => {
	it('are one cell, harmless to shoot at and worth no score', () => {
		for (const kind of MINE_KINDS) {
			const stats = BUILDINGS[kind];
			expect(stats.width, kind).toBe(1);
			expect(stats.height, kind).toBe(1);
			expect(stats.damage, kind).toBe(0);
			expect(stats.score, kind).toBe(0);
			expect(isMine(kind)).toBe(true);
		}
		expect(isMine('mortar')).toBe(false);
	});

	it('hurt infantry with a personnel mine, which a passing tank does not set off', () => {
		const rifleman = troopOnMine('mine-personnel', 'assault');
		expect(rifleman.troops[0].hp).toBe(TROOPS.assault.hp - MINES['mine-personnel'].damage);

		const tank = troopOnMine('mine-personnel', 'tank');
		expect(tank.troops[0].hp).toBe(TROOPS.tank.hp);
		expect(tank.buildings.find((building) => building.kind === 'mine-personnel')!.destroyed).toBe(
			false
		);
	});

	it('only scratch a vehicle that happens to stand in the blast of a personnel mine', () => {
		const state = createBattle(islandWith('mine-personnel'), {
			squads: [[unit('assault'), unit('tank')]]
		});
		deploy(state, 3);
		const [rifleman, tank] = state.troops;
		rifleman.x = 5.5;
		rifleman.y = 3.5;
		tank.x = 6.2;
		tank.y = 3.5;
		stepBattle(state, 16);
		const stats = MINES['mine-personnel'];
		expect(TROOPS.tank.hp - tank.hp).toBe(Math.round(stats.damage * stats.otherDamageShare));
	});

	it('wreck vehicles with an anti-tank mine and let infantry walk over it', () => {
		const tank = troopOnMine('mine-at', 'tank');
		expect(TROOPS.tank.hp - tank.troops[0].hp).toBe(MINES['mine-at'].damage);
		// The big guns and carriers feel it too
		for (const kind of VEHICLE_TROOPS) {
			const state = troopOnMine('mine-at', kind);
			const survivor = state.troops[0];
			expect(survivor === undefined || survivor.hp < TROOPS[kind].hp, kind).toBe(true);
		}
		const rifleman = troopOnMine('mine-at', 'assault');
		const mine = rifleman.buildings.find((building) => building.kind === 'mine-at')!;
		expect(mine.destroyed).toBe(false);
		expect(rifleman.troops[0].hp).toBe(TROOPS.assault.hp);
	});

	it('stun everyone in the blast with an EMP mine', () => {
		const state = createBattle(islandWith('mine-emp'), {
			squads: [[unit('assault'), unit('tank')]]
		});
		deploy(state, 3);
		for (const troop of state.troops) {
			troop.x = 5.5;
			troop.y = 3.5;
		}
		stepBattle(state, 16);
		for (const troop of state.troops) {
			expect(troop.stunMs).toBeGreaterThan(MINES['mine-emp'].stunMs - 100);
		}
	});

	it('go off once and leave a crater instead of counting as a destroyed building', () => {
		const state = troopOnMine('mine-personnel', 'assault');
		const mine = state.buildings.find((building) => building.kind === 'mine-personnel')!;
		expect(mine.destroyed).toBe(true);
		const hpAfter = state.troops[0].hp;
		stepBattle(state, 16);
		stepBattle(state, 16);
		expect(state.troops[0].hp).toBe(hpAfter);
		// A mine is not a wrecked structure: no score for it, and the battle goes on
		expect(scoreOf(state)).toBe(Math.round(hpAfter / 10));
		expect(state.status).toBe('playing');
	});

	it('are never chosen as a target and cannot be focused', () => {
		const state = createBattle(islandWith('mine-at'), { squads: [[unit('assault')]] });
		const mine = state.buildings.find((building) => building.kind === 'mine-at')!;
		setFocus(state, mine.id);
		expect(state.focusId).toBeNull();
		deploy(state, 3);
		stepBattle(state, 16);
		expect(state.troops[0].targetId).toBe(0);
	});

	it('do not stop troops walking: they cross the island and win', () => {
		const state = createBattle(
			{
				id: 'field',
				buildings: [
					{ kind: 'hq', x: 9, y: 3 },
					{ kind: 'mine-emp', x: 4, y: 3 },
					{ kind: 'mine-at', x: 6, y: 3 }
				]
			},
			{ squads: [[unit('assault'), unit('assault'), unit('assault'), unit('assault')]] }
		);
		deploy(state, 3);
		for (let time = 0; time < 60_000 && state.status === 'playing'; time += 16) {
			stepBattle(state, 16);
		}
		expect(state.status).toBe('won');
	});

	it('appear on the campaign islands in every kind and stay on the sand', () => {
		const used = new Set<string>();
		for (const island of ISLANDS) {
			for (const building of island.buildings) {
				if (!isMine(building.kind)) continue;
				used.add(building.kind);
				expect(building.x, island.id).toBeGreaterThanOrEqual(2);
			}
		}
		for (const kind of MINE_KINDS) expect(used.has(kind), kind).toBe(true);
	});
});

describe('missiles and shells over mines', () => {
	it('set off every mine they land near, even before a troop steps on it', () => {
		for (const skill of ['flamingo', 'barrage'] as const) {
			const state = createBattle(islandWith('mine-at'));
			castSkill(state, skill, 5.5, 3.5);
			for (let step = 0; step < 40; step++) stepBattle(state, 100);
			const mine = state.buildings.find((building) => building.kind === 'mine-at')!;
			expect(mine.destroyed, skill).toBe(true);
			const events = state.events.filter((event) => event.kind === 'mine-triggered');
			expect(events.length, skill).toBeGreaterThan(0);
			expect(events[0], skill).toMatchObject({ cause: 'skill' });
		}
	});

	it('leave a mine alone that is far from the impact', () => {
		const state = createBattle(islandWith('mine-personnel'));
		castSkill(state, 'flamingo', 2.2, 7.5);
		for (let step = 0; step < 40; step++) stepBattle(state, 100);
		expect(state.buildings.find((building) => building.kind === 'mine-personnel')!.destroyed).toBe(
			false
		);
	});

	it('reports a mine a troop stepped on as stepped', () => {
		const state = troopOnMine('mine-emp', 'assault');
		expect(state.events.find((event) => event.kind === 'mine-triggered')).toMatchObject({
			cause: 'stepped'
		});
	});
});
