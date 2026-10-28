import { describe, expect, it } from 'vitest';
import { missingMessages } from '#lib/testing/messages.js';
import type { Random } from '../random.js';
import {
	MAX_DAYS,
	SCORE_WIN_BONUS,
	SCORE_PER_REGION,
	SCORE_DAY_BONUS,
	type RegionId
} from './config.js';
import {
	armisticeDays,
	battlePreview,
	buildFactory,
	canBuild,
	canOrder,
	canTrain,
	createWarRoom,
	demandIn,
	endTurn,
	finalScore,
	heldRegions,
	orderStack,
	slotsUsed,
	stackStrength,
	supplyMap,
	totalDivisions,
	train
} from './state.js';

/** Both dice land on 1, so combat only depends on the stacks */
const steady: Random = () => 0.5;

function game() {
	return createWarRoom();
}

function clearEnemy(state = game()) {
	for (const region of Object.keys(state.divisions) as RegionId[]) {
		if (state.owner[region] === 'enemy') state.divisions[region] = [];
	}
	return state;
}

describe('War Room start', () => {
	it('opens with six regions, five divisions and four resources', () => {
		const state = game();
		expect(heldRegions(state)).toBe(6);
		expect(totalDivisions(state, 'player')).toBe(5);
		expect(totalDivisions(state, 'enemy')).toBe(5);
		expect(state.day).toBe(1);
		expect(state.outcome).toBeNull();
		expect(state.divisions.marsh).toHaveLength(2);
		expect(state.divisions.plains).toHaveLength(1);
	});

	it('starts the armistice clock at the full campaign length', () => {
		const state = game();
		expect(armisticeDays(state)).toBe(MAX_DAYS);
		state.day = MAX_DAYS;
		expect(armisticeDays(state)).toBe(1);
		state.day = MAX_DAYS + 1;
		expect(armisticeDays(state)).toBe(0);
	});

	it('gives the capital full supply and cuts it with distance and crowding', () => {
		const state = game();
		const supply = supplyMap(state);
		expect(supply.capital).toBe(100);
		expect(supply.rustbelt).toBe(90);
		expect(supply.marsh).toBe(80);
		expect(supply.grain).toBe(90);
		expect(supply.ridge).toBe(80);

		state.divisions.ridge.push(
			{ id: 900, template: 'infantry', morale: 70, experience: 1 },
			{ id: 901, template: 'infantry', morale: 70, experience: 1 },
			{ id: 902, template: 'infantry', morale: 70, experience: 1 }
		);
		expect(demandIn(state, 'ridge')).toBe(6);
		expect(supplyMap(state).ridge).toBe(53);
	});
});

describe('War Room orders', () => {
	it('marches a whole stack into a friendly neighbour and uses up the day', () => {
		const state = game();
		const events = orderStack(state, 'marsh', 'rustbelt', steady);
		expect(events[0]).toEqual({ type: 'move', count: 2, to: 'rustbelt' });
		expect(state.divisions.marsh).toHaveLength(0);
		expect(state.divisions.rustbelt).toHaveLength(3);
		expect(state.moved).toContain('marsh');
		expect(state.moved).toContain('rustbelt');
		expect(orderStack(state, 'marsh', 'rustbelt', steady)).toEqual([{ type: 'blocked' }]);
	});

	it('refuses an order to a region that is not a neighbour', () => {
		const state = game();
		expect(canOrder(state, 'capital', 'plains')).toBe(false);
		expect(orderStack(state, 'capital', 'plains', steady)).toEqual([{ type: 'blocked' }]);
	});

	it('takes an undefended region and moves the stack in', () => {
		const state = game();
		state.divisions.plains = [];
		const events = orderStack(state, 'marsh', 'plains', steady);
		expect(events.some((event) => event.type === 'captured' && event.region === 'plains')).toBe(
			true
		);
		expect(state.owner.plains).toBe('player');
		expect(state.divisions.plains).toHaveLength(2);
		expect(state.divisions.marsh).toHaveLength(0);
	});

	it('wins an attack when the attacker is stronger and captures the region', () => {
		const state = game();
		state.divisions.plains[0].morale = 20;
		for (const division of state.divisions.marsh) division.morale = 100;
		expect(battlePreview(state, 'marsh', 'plains').ratio).toBeGreaterThan(1);

		const events = orderStack(state, 'marsh', 'plains', steady);
		const battle = events.find((event) => event.type === 'battle');
		expect(battle).toMatchObject({ type: 'battle', attacker: 'player', won: true });
		expect(state.owner.plains).toBe('player');
		expect(state.kills).toBe(1);
		expect(state.losses).toBe(0);
		expect(state.divisions.plains.length).toBeGreaterThan(0);
	});

	it('loses the stack when an attack fails', () => {
		const state = game();
		for (const division of state.divisions.marsh) division.morale = 10;
		state.divisions.plains[0].morale = 100;
		expect(battlePreview(state, 'marsh', 'plains').ratio).toBeLessThan(1);

		const events = orderStack(state, 'marsh', 'plains', steady);
		const battle = events.find((event) => event.type === 'battle');
		expect(battle).toMatchObject({ type: 'battle', attacker: 'player', won: false });
		expect(state.owner.plains).toBe('enemy');
		expect(state.divisions.marsh).toHaveLength(0);
		expect(state.losses).toBe(2);
		expect(state.kills).toBe(0);
	});

	it('gives the defender a terrain bonus and scales strength with morale and supply', () => {
		const state = game();
		expect(battlePreview(state, 'marsh', 'ridge').terrain).toBe(1.5);
		expect(battlePreview(state, 'marsh', 'plains').terrain).toBe(1);

		state.divisions.ridge.push({ id: 910, template: 'armour', morale: 100, experience: 1 });
		const full = stackStrength(state, 'ridge', 'defence', 100);
		const low = stackStrength(state, 'ridge', 'defence', 50);
		expect(full).toBeGreaterThan(low);
	});
});

describe('War Room industry and training', () => {
	it('builds a factory only when there is a slot and the resources are there', () => {
		const state = game();
		expect(canBuild(state, 'capital', 'arms')).toBe(true);
		expect(buildFactory(state, 'capital', 'arms')).toBe(true);
		expect(slotsUsed(state, 'capital')).toBe(1);
		expect(state.resources.steel).toBe(15);
		expect(state.resources.rare).toBe(15);
		expect(canBuild(state, 'capital', 'trucks')).toBe(false);
		expect(buildFactory(state, 'capital', 'trucks')).toBe(false);
		expect(buildFactory(state, 'plains', 'trucks')).toBe(false);
	});

	it('runs income and factories at the end of the day', () => {
		const state = game();
		state.resources = { steel: 100, oil: 100, rare: 100, grain: 100 };
		expect(buildFactory(state, 'capital', 'arms')).toBe(true);
		endTurn(state, steady);

		expect(state.day).toBe(2);
		expect(state.resources.steel).toBe(76);
		expect(state.resources.rare).toBe(100);
		expect(state.equipment.rifles).toBe(34);
	});

	it('trains a division when the equipment is spent and the days are done', () => {
		const state = game();
		state.equipment = { ...state.equipment, rifles: 100, trucks: 100 };
		expect(canTrain(state, 'infantry')).toBe(true);
		expect(train(state, 'infantry')).toBe(true);
		expect(state.training).toHaveLength(1);

		const events = endTurn(state, steady);
		expect(state.training).toHaveLength(0);
		expect(state.divisions.capital).toHaveLength(2);
		expect(events.some((event) => event.type === 'trained')).toBe(true);
	});

	it('refuses training without the equipment', () => {
		const state = game();
		state.equipment = { ...state.equipment, rifles: 0, trucks: 0 };
		expect(canTrain(state, 'infantry')).toBe(false);
		expect(train(state, 'infantry')).toBe(false);
		expect(state.training).toHaveLength(0);
	});
});

describe('War Room campaign end', () => {
	it('wins when the Red Capital is taken and scores the win bonus', () => {
		const state = game();
		state.owner.redcapital = 'player';
		const events = endTurn(state, steady);
		expect(state.outcome).toBe('won');
		expect(events.some((event) => event.type === 'over' && event.outcome === 'won')).toBe(true);
		expect(state.score).toBeGreaterThan(SCORE_WIN_BONUS);
	});

	it('loses when the capital falls', () => {
		const state = game();
		state.owner.capital = 'enemy';
		state.divisions.capital = [];
		endTurn(state, steady);
		expect(state.outcome).toBe('lost');
	});

	it('freezes the front into an armistice after the last day', () => {
		const state = clearEnemy();
		state.day = MAX_DAYS;
		endTurn(state, steady);
		expect(state.day).toBe(MAX_DAYS + 1);
		expect(state.outcome).toBe('armistice');
		expect(state.score).toBe(heldRegions(state) * SCORE_PER_REGION);
	});

	it('scores regions, kills and losses, and adds the win bonus only for a win', () => {
		const state = game();
		state.kills = 2;
		state.losses = 1;
		expect(finalScore(state, null)).toBe(6 * SCORE_PER_REGION + 2 * 40 - 1 * 30);
		expect(finalScore(state, 'won')).toBe(
			6 * SCORE_PER_REGION +
				2 * 40 -
				1 * 30 +
				SCORE_WIN_BONUS +
				(MAX_DAYS - state.day) * SCORE_DAY_BONUS
		);
	});

	it('ignores further days once the campaign is over', () => {
		const state = game();
		state.outcome = 'won';
		expect(endTurn(state, steady)).toEqual([]);
	});
});

describe('War Room messages', () => {
	it('has its own and its mode messages in every language', () => {
		expect(missingMessages(['warroom_', 'mode_warroom_'])).toEqual([]);
	});
});
