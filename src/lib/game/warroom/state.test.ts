import { describe, expect, it } from 'vitest';
import { missingMessages } from '#lib/testing/messages.js';
import type { Random } from '../random.js';
import {
	MAX_DAYS,
	SCORE_WIN_BONUS,
	SCORE_PER_REGION,
	SCORE_DAY_BONUS,
	SCORE_PER_STABILITY,
	STABILITY_START,
	escalationTier,
	EXERCISE_MORALE_LOSS,
	EXERCISE_SUPPLY_COST,
	templateDef,
	type RegionId
} from './config.js';
import {
	armisticeDays,
	battlePreview,
	buildFactory,
	canBuild,
	canResolveCrisis,
	canUseDirective,
	resolveCrisis,
	useDirective,
	canExercise,
	canOrder,
	canTrain,
	createWarRoom,
	demandIn,
	endTurn,
	exerciseDivision,
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

describe('War Room experience', () => {
	it('starts every division at level one and grows experienced units over time', () => {
		const state = game();
		expect(state.divisions.capital[0].experience).toBe(1);
		state.resources = { steel: 100, oil: 100, rare: 100, grain: 100 };
		endTurn(state, steady);
		expect(state.divisions.capital[0].experience).toBe(2);
	});

	it('exercises a stack: spends grain, drains morale and raises experience', () => {
		const state = game();
		const division = state.divisions.capital[0];
		const grain = state.resources.grain;
		expect(canExercise(state, 'capital')).toBe(true);
		expect(exerciseDivision(state, 'capital')).toBe(true);
		expect(state.resources.grain).toBe(grain - EXERCISE_SUPPLY_COST);
		expect(division.morale).toBe(templateDef('infantry').morale - EXERCISE_MORALE_LOSS);
		expect(division.experience).toBe(2);
	});

	it('refuses exercise without supplies or on an enemy region', () => {
		const state = game();
		state.resources.grain = EXERCISE_SUPPLY_COST - 1;
		expect(canExercise(state, 'capital')).toBe(false);
		expect(exerciseDivision(state, 'capital')).toBe(false);
		expect(canExercise(state, 'plains')).toBe(false);
	});

	it('makes experienced divisions stronger in combat', () => {
		const state = game();
		state.divisions.ridge.push({ id: 911, template: 'armour', morale: 100, experience: 1 });
		const green = stackStrength(state, 'ridge', 'defence', 100);
		state.divisions.ridge[state.divisions.ridge.length - 1].experience = 5;
		const veteran = stackStrength(state, 'ridge', 'defence', 100);
		expect(veteran).toBeGreaterThan(green);
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
		expect(state.score).toBe(
			heldRegions(state) * SCORE_PER_REGION + Math.round(state.stability) * SCORE_PER_STABILITY
		);
	});

	it('scores regions, kills and losses, and adds the win bonus only for a win', () => {
		const state = game();
		state.kills = 2;
		state.losses = 1;
		const calm = state.stability * SCORE_PER_STABILITY;
		expect(finalScore(state, null)).toBe(6 * SCORE_PER_REGION + 2 * 40 - 1 * 30 + calm);
		expect(finalScore(state, 'won')).toBe(
			calm +
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

describe('War Room home front', () => {
	it('starts calm and rises when ground is taken, falls when it is lost', () => {
		const state = clearEnemy();
		expect(state.stability).toBe(STABILITY_START);
		state.divisions.marsh = [state.divisions.marsh[0], state.divisions.marsh[1]];
		orderStack(state, 'marsh', 'plains', steady);
		expect(state.stability).toBe(STABILITY_START + 4);
	});

	it('pays less income when the home front is restless and more when it is firm', () => {
		const low = game();
		low.stability = 10;
		const firm = game();
		firm.stability = 90;
		const baseline = game();
		endTurn(low, steady);
		endTurn(firm, steady);
		endTurn(baseline, steady);
		expect(low.resources.steel).toBeLessThan(baseline.resources.steel);
		expect(firm.resources.steel).toBeGreaterThan(baseline.resources.steel);
	});

	it('ends in a coup when stability reaches zero', () => {
		const state = clearEnemy();
		state.stability = 1;
		for (const region of ['rustbelt', 'grain', 'tar'] as const) state.owner[region] = 'enemy';
		const events = endTurn(state, steady);
		expect(state.outcome).toBe('coup');
		expect(events.some((event) => event.type === 'over')).toBe(true);
	});

	it('escalates the Pact in tiers', () => {
		expect(escalationTier(9)).toBe(0);
		expect(escalationTier(10)).toBe(1);
		expect(escalationTier(20)).toBe(2);
		const state = game();
		state.day = 9;
		const events = endTurn(state, steady);
		expect(events).toContainEqual({ type: 'escalation', tier: 1 });
	});
});

describe('War Room council', () => {
	it('draws a crisis on day 3 and blocks nothing until the day ends', () => {
		const state = game();
		state.day = 2;
		const events = endTurn(state, steady);
		expect(state.day).toBe(3);
		expect(state.crisis).not.toBeNull();
		expect(events.some((event) => event.type === 'crisis')).toBe(true);
		expect(state.history.length).toBeGreaterThan(1);
	});

	it('applies the effects and cost of a chosen option and clears the crisis', () => {
		const state = game();
		state.crisis = 'sabotage';
		const oil = state.resources.oil;
		const events = resolveCrisis(state, 0);
		expect(state.crisis).toBeNull();
		expect(state.resources.oil).toBe(oil - 8);
		expect(state.flags).toContain('vigilant');
		expect(state.crisesHandled).toBe(1);
		expect(events[0]).toMatchObject({
			type: 'crisisResolved',
			option: 'counter',
			neglected: false
		});
	});

	it('refuses an option that is not affordable', () => {
		const state = game();
		state.crisis = 'sabotage';
		state.resources.oil = 2;
		expect(canResolveCrisis(state, 0)).toBe(false);
		expect(resolveCrisis(state, 0)).toEqual([{ type: 'blocked' }]);
		expect(state.crisis).toBe('sabotage');
	});

	it('punishes a crisis left unanswered when the day ends', () => {
		const state = clearEnemy();
		state.crisis = 'strike';
		state.day = 4;
		const events = endTurn(state, steady);
		expect(events).toContainEqual({
			type: 'crisisResolved',
			id: 'strike',
			option: 'neglect',
			neglected: true
		});
		expect(state.stability).toBeLessThan(STABILITY_START);
	});

	it('chains a harsh crackdown into a later scandal', () => {
		const state = game();
		state.crisis = 'strike';
		resolveCrisis(state, 1);
		expect(state.flags).toContain('harsh');
		state.crisis = null;
		state.crisesSeen = ['strike'];
		state.day = 5;
		endTurn(state, steady);
		expect(state.crisis).toBe('scandal');
	});

	it('allows one directive a day and resets it with the day', () => {
		const state = clearEnemy();
		expect(canUseDirective(state, 'propaganda')).toBe(true);
		const events = useDirective(state, 'propaganda');
		expect(events[0]).toEqual({ type: 'directive', id: 'propaganda' });
		expect(state.stability).toBe(STABILITY_START + 10);
		expect(state.resources.rare).toBe(15);
		expect(canUseDirective(state, 'austerity')).toBe(false);
		endTurn(state, steady);
		expect(canUseDirective(state, 'austerity')).toBe(true);
	});

	it('makes counter-intelligence hold the Pact back for a while', () => {
		const state = game();
		useDirective(state, 'counterintel');
		expect(state.intelDays).toBe(2);
		endTurn(state, steady);
		expect(state.intelDays).toBe(1);
	});
});

describe('War Room messages', () => {
	it('has its own and its mode messages in every language', () => {
		expect(missingMessages(['warroom_', 'mode_warroom_'])).toEqual([]);
	});
});
