import { describe, expect, it } from 'vitest';
import { SKILLS, SKILL_ENERGY, type Island } from './config';
import {
	canCastSkill,
	castSkill,
	createBattle,
	deploy,
	skillCost,
	stepBattle,
	type BattleState
} from './battle';

const STEP = 1000 / 60;

const OPEN: Island = { id: 'open', buildings: [{ kind: 'hq', x: 9, y: 3 }] };
const GUARDED: Island = {
	id: 'guarded',
	buildings: [
		{ kind: 'mg', x: 3, y: 3 },
		{ kind: 'hq', x: 9, y: 3 }
	]
};
const TARGET: Island = {
	id: 'target',
	buildings: [
		{ kind: 'hq', x: 5, y: 4 },
		{ kind: 'depot', x: 5, y: 6 }
	]
};
const REWARD: Island = {
	id: 'reward',
	buildings: [
		{ kind: 'depot', x: 1, y: 1 },
		{ kind: 'hq', x: 9, y: 3 }
	]
};

function play(state: BattleState, ms: number) {
	for (let elapsed = 0; elapsed < ms && state.status === 'playing'; elapsed += STEP) {
		stepBattle(state, STEP);
	}
}

describe('support skills', () => {
	it('starts with energy and a cheap first call', () => {
		const state = createBattle(OPEN);
		expect(state.energy).toBe(SKILL_ENERGY.start);
		expect(state.skillsUsed).toBe(0);
		expect(skillCost(state)).toBe(SKILL_ENERGY.baseCost);
		expect(canCastSkill(state)).toBe(true);
	});

	it('makes every call more expensive than the one before', () => {
		const state = createBattle(OPEN);
		const first = skillCost(state);
		expect(castSkill(state, 'flare', 3, 3)).toBe(true);
		const second = skillCost(state);
		expect(castSkill(state, 'flare', 3, 3)).toBe(true);
		const third = skillCost(state);
		expect(second).toBe(first + SKILL_ENERGY.costStep);
		expect(third).toBe(second + SKILL_ENERGY.costStep);
		expect(state.energy).toBe(SKILL_ENERGY.start - first - second);
		expect(state.skillsUsed).toBe(2);
	});

	it('refuses a call once the energy is gone', () => {
		const state = createBattle(OPEN);
		state.energy = skillCost(state) - 1;
		expect(canCastSkill(state)).toBe(false);
		expect(castSkill(state, 'heal', 3, 3)).toBe(false);
		expect(state.energy).toBe(skillCost(state) - 1);
		expect(state.skillsUsed).toBe(0);
	});

	it('cannot call skills after the battle has ended', () => {
		const state = createBattle(OPEN);
		state.status = 'won';
		expect(canCastSkill(state)).toBe(false);
		expect(castSkill(state, 'flamingo', 2, 2)).toBe(false);
	});

	it('clamps a skill aimed off the island', () => {
		const state = createBattle(OPEN);
		expect(castSkill(state, 'flare', -20, 40)).toBe(true);
		expect(state.flare?.x).toBe(0);
		expect(state.flare?.y).toBe(8);
	});

	it('reports the cost and the remaining energy when a skill is called', () => {
		const state = createBattle(OPEN);
		expect(castSkill(state, 'smoke', 4, 4)).toBe(true);
		const event = state.events.find((candidate) => candidate.kind === 'skill-cast');
		expect(event).toBeDefined();
		if (event?.kind === 'skill-cast') {
			expect(event.skill).toBe('smoke');
			expect(event.cost).toBe(SKILL_ENERGY.baseCost);
			expect(event.energy).toBe(SKILL_ENERGY.start - SKILL_ENERGY.baseCost);
			expect(event.x).toBe(4);
			expect(event.y).toBe(4);
		}
	});
});

describe('flare', () => {
	it('puts a marker on the island and walks the troops towards it', () => {
		const state = createBattle(OPEN);
		deploy(state, 3);
		const before = { x: state.troops[0].x, y: state.troops[0].y };
		expect(castSkill(state, 'flare', 4, 6)).toBe(true);
		expect(state.flare).not.toBeNull();
		play(state, 300);
		expect(state.troops[0].x).toBeGreaterThan(before.x);
		expect(state.troops[0].y).toBeGreaterThan(before.y);
	});

	it('turns troops away from the headquarters when the flare is behind them', () => {
		const state = createBattle(OPEN);
		deploy(state, 3);
		expect(castSkill(state, 'flare', 1.4, 1)).toBe(true);
		const before = state.troops[0].y;
		play(state, 400);
		expect(state.troops[0].y).toBeLessThan(before);
	});

	it('expires after its duration and leaves the island without a flare', () => {
		const state = createBattle(OPEN);
		expect(castSkill(state, 'flare', 4, 4)).toBe(true);
		play(state, (SKILLS.flare.durationMs ?? 0) + 200);
		expect(state.flare).toBeNull();
	});
});

describe('smoke screen', () => {
	it('hides every soldier inside it from the defenders', () => {
		const state = createBattle(GUARDED);
		deploy(state, 3);
		for (const troop of state.troops) troop.stunMs = 10_000;
		expect(castSkill(state, 'smoke', 1.15, 3.5)).toBe(true);
		play(state, 1000);
		expect(state.events.some((event) => event.kind === 'defense-shot')).toBe(false);
		expect(state.troops.every((troop) => troop.hp === troop.maxHp)).toBe(true);
	});

	it('lets the guns fire again once the smoke has gone', () => {
		const state = createBattle(GUARDED);
		deploy(state, 3);
		for (const troop of state.troops) troop.stunMs = 12_000;
		expect(castSkill(state, 'smoke', 1.15, 3.5)).toBe(true);
		play(state, (SKILLS.smoke.durationMs ?? 0) + 500);
		expect(state.smoke).toBeNull();
		expect(state.events.some((event) => event.kind === 'defense-shot')).toBe(true);
	});
});

describe('healing circle', () => {
	it('heals the troops standing inside it but not the ones outside', () => {
		const state = createBattle(OPEN);
		deploy(state, 2);
		deploy(state, 6);
		for (const troop of state.troops) {
			troop.hp = 40;
			troop.stunMs = 10_000;
		}
		const inside = state.troops.filter((troop) => troop.y < 4);
		const outside = state.troops.filter((troop) => troop.y > 4);
		expect(inside.length).toBeGreaterThan(0);
		expect(outside.length).toBeGreaterThan(0);
		expect(castSkill(state, 'heal', inside[0].x, inside[0].y)).toBe(true);
		play(state, 1000);
		expect(inside.every((troop) => troop.hp > 40)).toBe(true);
		expect(outside.every((troop) => troop.hp === 40)).toBe(true);
	});

	it('never heals a soldier above their maximum health', () => {
		const state = createBattle(OPEN);
		deploy(state, 3);
		const troop = state.troops[0];
		troop.hp = troop.maxHp - 5;
		troop.stunMs = 10_000;
		expect(castSkill(state, 'heal', troop.x, troop.y)).toBe(true);
		play(state, 2000);
		expect(troop.hp).toBe(troop.maxHp);
	});
});

describe('missile and barrage', () => {
	it('waits for the missile to arrive, then damages every building in the blast', () => {
		const state = createBattle(TARGET);
		expect(castSkill(state, 'flamingo', 6, 5)).toBe(true);
		expect(state.strikes).toHaveLength(1);
		play(state, 700);
		const hq = state.buildings.find((building) => building.kind === 'hq')!;
		expect(hq.hp).toBe(hq.maxHp);
		play(state, 300);
		expect(hq.hp).toBeLessThan(hq.maxHp);
		expect(state.strikes).toHaveLength(0);
		expect(state.events.some((event) => event.kind === 'skill-impact')).toBe(true);
	});

	it('reports the number of buildings the missile hit', () => {
		const state = createBattle(TARGET);
		expect(castSkill(state, 'flamingo', 6, 6)).toBe(true);
		play(state, 1000);
		const impact = state.events.find((event) => event.kind === 'skill-impact');
		expect(impact).toBeDefined();
		if (impact?.kind === 'skill-impact') {
			expect(impact.skill).toBe('flamingo');
			expect(impact.radius).toBe(SKILLS.flamingo.radius);
			expect(impact.hits).toBeGreaterThan(0);
		}
	});

	it('schedules several shells for a barrage and lands them one after another', () => {
		const state = createBattle(TARGET);
		expect(castSkill(state, 'barrage', 6, 5)).toBe(true);
		expect(state.strikes).toHaveLength(SKILLS.barrage.shells ?? 0);
		play(state, 700);
		const early = state.events.filter((event) => event.kind === 'skill-impact').length;
		play(state, 700);
		const later = state.events.filter((event) => event.kind === 'skill-impact').length;
		expect(early).toBeGreaterThan(0);
		expect(later).toBeGreaterThan(early);
	});

	it('leaves no strike behind after the whole barrage has landed', () => {
		const state = createBattle(TARGET);
		expect(castSkill(state, 'barrage', 6, 5)).toBe(true);
		play(state, 2000);
		expect(state.strikes).toHaveLength(0);
	});
});

describe('energy rewards', () => {
	it('gives a little energy back when a structure is destroyed', () => {
		const state = createBattle(REWARD);
		const depot = state.buildings.find((building) => building.kind === 'depot')!;
		depot.hp = 0;
		stepBattle(state, STEP);
		expect(state.energy).toBe(SKILL_ENERGY.start + SKILL_ENERGY.rewardPerBuilding);
		expect(depot.destroyed).toBe(true);
	});

	it('does not exceed the energy cap when many buildings fall at once', () => {
		const state = createBattle(REWARD);
		state.energy = SKILL_ENERGY.max - 1;
		for (const building of state.buildings) building.hp = 0;
		stepBattle(state, STEP);
		expect(state.energy).toBe(SKILL_ENERGY.max);
	});
});
