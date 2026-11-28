import { describe, expect, it } from 'vitest';
import type { SquadTroop } from './battle.js';
import { SYNERGIES, boostLandingPlan, boostSquad, squadSynergies } from './synergies.js';

const troop = (kind: SquadTroop['kind'], extra: Partial<SquadTroop> = {}): SquadTroop => ({
	kind,
	hp: 100,
	damage: 20,
	range: 1,
	speed: 3,
	attackMs: 500,
	...extra
});

describe('beachhead squad synergies', () => {
	it('needs every unit of a combination in the same squad', () => {
		expect(squadSynergies([troop('assault'), troop('tank')]).map((s) => s.id)).toContain(
			'combined-arms'
		);
		expect(squadSynergies([troop('assault')]).map((s) => s.id)).not.toContain('combined-arms');
		expect(squadSynergies([troop('assault'), troop('demo')]).map((s) => s.id)).toContain(
			'breach-and-clear'
		);
	});

	it('boosts only the listed kinds and never mutates the input', () => {
		const squad = [troop('assault'), troop('tank'), troop('medic')];
		const original = squad.map((unit) => ({ ...unit }));
		const boosted = boostSquad(squad);
		expect(boosted.find((unit) => unit.kind === 'tank')!.damage).toBe(24);
		expect(boosted.find((unit) => unit.kind === 'assault')!.damage).toBe(24);
		expect(boosted.find((unit) => unit.kind === 'assault')!.hp).toBe(110);
		expect(boosted.find((unit) => unit.kind === 'medic')!.damage).toBe(20);
		expect(squad).toEqual(original);
	});

	it('scales splash, speed and healing for the right combinations', () => {
		const boosted = boostSquad([
			troop('demo', { splash: 2 }),
			troop('assault'),
			troop('medic', { healAmount: 10, healEveryMs: 1000 }),
			troop('apc')
		]);
		expect(boosted.find((unit) => unit.kind === 'demo')!.splash).toBe(2.5);
		expect(boosted.find((unit) => unit.kind === 'demo')!.speed).toBe(3.3);
		expect(boosted.find((unit) => unit.kind === 'medic')!.healAmount).toBe(13);
	});

	it('cuts artillery scatter when a drone spots for it', () => {
		const boosted = boostSquad([
			troop('drone'),
			troop('artillery', { scatter: 2 }),
			troop('mortar', { scatter: 1 })
		]);
		expect(boosted.find((unit) => unit.kind === 'artillery')!.scatter).toBe(1);
		expect(boosted.find((unit) => unit.kind === 'artillery')!.damage).toBe(23);
		expect(boosted.find((unit) => unit.kind === 'drone')!.damage).toBe(20);
	});

	it('applies to every boat independently', () => {
		const plans = boostLandingPlan([[troop('assault'), troop('tank')], [troop('medic')]]);
		expect(plans[0]!.find((unit) => unit.kind === 'tank')!.damage).toBe(24);
		expect(plans[1]![0]!.damage).toBe(20);
	});

	it('has a translated name for every synergy', () => {
		for (const synergy of SYNERGIES) expect(synergy.name).toMatch(/^[a-z_]+$/u);
	});
});
