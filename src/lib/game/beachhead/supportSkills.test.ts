import { describe, expect, it } from 'vitest';
import { MAX_SUPPORT_SKILL_LEVEL, SKILLS, skillStatsAt } from './config';
import { castSkill, createBattle, deploy, stepBattle } from './battle';
import {
	applySupportSkillUpgrade,
	canUpgradeSupportSkill,
	modifiersFor,
	newSave,
	supportSkillCost,
	supportSkillLevel,
	supportSkillLocked
} from './campaign';

const rich = (save = newSave(0)) => ({
	...save,
	resources: { wood: 99_999, stone: 99_999, iron: 99_999, gold: 9_999 }
});

describe('support skills at the training ground', () => {
	it('start at level one and stay as tuned in the table', () => {
		expect(supportSkillLevel(newSave(0), 'flamingo')).toBe(1);
		expect(skillStatsAt('flamingo', 1)).toEqual(SKILLS.flamingo);
	});

	it('hit harder, reach wider and last longer with every level', () => {
		const one = skillStatsAt('flamingo', 1);
		const four = skillStatsAt('flamingo', 4);
		expect(four.damage).toBeGreaterThan(one.damage);
		expect(four.radius).toBeGreaterThan(one.radius);
		const smoke = skillStatsAt('smoke', 5);
		expect(smoke.durationMs!).toBeGreaterThan(SKILLS.smoke.durationMs!);
		expect(skillStatsAt('heal', 5).healPerSecond!).toBeGreaterThan(SKILLS.heal.healPerSecond!);
		expect(skillStatsAt('flamingo', 99)).toEqual(skillStatsAt('flamingo', MAX_SUPPORT_SKILL_LEVEL));
	});

	it('cost more for every level and cannot outgrow the training ground', () => {
		let save = rich();
		const first = supportSkillCost(save, 'barrage')!;
		expect(supportSkillLocked(save, 'barrage')).toBe(true);
		expect(canUpgradeSupportSkill(save, 'barrage')).toBe(false);
		save = { ...save, levels: { ...save.levels, training: 4 } };
		save = applySupportSkillUpgrade(save, 'barrage');
		expect(supportSkillLevel(save, 'barrage')).toBe(2);
		expect(supportSkillCost(save, 'barrage')!.wood).toBeGreaterThan(first.wood);
		save = applySupportSkillUpgrade(applySupportSkillUpgrade(save, 'barrage'), 'barrage');
		expect(supportSkillLevel(save, 'barrage')).toBe(4);
		expect(applySupportSkillUpgrade(save, 'barrage')).toBe(save);
	});

	it('refuse an upgrade the stock cannot pay for', () => {
		const poor = { ...newSave(0), levels: { ...newSave(0).levels, training: 8 } };
		const broke = { ...poor, resources: { wood: 0, stone: 0, iron: 0, gold: 0 } };
		expect(applySupportSkillUpgrade(broke, 'flare')).toBe(broke);
	});

	it('reach the battle: a trained flamingo missile strikes harder', () => {
		const island = { id: 'x', buildings: [{ kind: 'hq' as const, x: 9, y: 3 }] };
		let save = rich();
		save = { ...save, levels: { ...save.levels, training: 8 } };
		for (let step = 0; step < 4; step++) save = applySupportSkillUpgrade(save, 'flamingo');
		const trained = createBattle(island, modifiersFor(save));
		const plain = createBattle(island, modifiersFor(rich()));
		castSkill(trained, 'flamingo', 6, 4);
		castSkill(plain, 'flamingo', 6, 4);
		expect(trained.strikes[0].damage).toBeGreaterThan(plain.strikes[0].damage);
		expect(trained.strikes[0].radius).toBeGreaterThan(plain.strikes[0].radius);
	});
});

describe('the EMP pulse', () => {
	it('switches off every defence in the circle for longer at higher levels', () => {
		const island = {
			id: 'x',
			buildings: [
				{ kind: 'hq' as const, x: 9, y: 3 },
				{ kind: 'field-cannon' as const, x: 6, y: 3 },
				{ kind: 'mg' as const, x: 6, y: 6 }
			]
		};
		const pulse = (level: number) => {
			const state = createBattle(island, { squads: [], skillLevels: { emp: level } });
			state.energy = 300;
			castSkill(state, 'emp', 6.5, 3.5);
			return state;
		};
		const low = pulse(1);
		expect(low.buildings[1].stunMs).toBeGreaterThan(0);
		// Out of the circle nothing happens, and the headquarters never shoots anyway
		expect(low.buildings[2].stunMs).toBe(0);
		expect(pulse(5).buildings[1].stunMs).toBeGreaterThan(low.buildings[1].stunMs);
		expect(skillStatsAt('emp', 5).radius).toBeGreaterThan(skillStatsAt('emp', 1).radius);
	});

	it('keeps a switched-off gun from firing until the pulse wears off', () => {
		const state = createBattle(
			{
				id: 'x',
				buildings: [
					{ kind: 'hq' as const, x: 9, y: 3 },
					{ kind: 'mg' as const, x: 3, y: 3 }
				]
			},
			{ squads: [[{ kind: 'assault', hp: 100, damage: 0, range: 1, speed: 0, attackMs: 600 }]] }
		);
		deploy(state, 3);
		state.troops[0].x = 3.5;
		state.troops[0].y = 3.5;
		state.energy = 300;
		castSkill(state, 'emp', 3.5, 3.5);
		for (let step = 0; step < 15; step++) stepBattle(state, 100);
		expect(state.troops[0].hp).toBe(100);
		for (let step = 0; step < 30; step++) stepBattle(state, 100);
		expect(state.troops[0].hp).toBeLessThan(100);
	});
});
