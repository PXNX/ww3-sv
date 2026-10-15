import { describe, expect, it } from 'vitest';
import {
	BASE_MAX_CRATES,
	BASE_SLACK,
	BASE_SPAWN_MS,
	BASE_SPEED,
	LICENCE_ROUND,
	MAX_CRATES_CAP,
	MAX_SPEED,
	MIN_SLACK,
	MIN_SPAWN_MS,
	QUOTA_ROUND,
	ROUND_MS,
	SECOND_RULE_ROUND,
	THIRD_ELEMENT_ROUND
} from './config.js';
import { difficulty, roundAt } from './difficulty.js';

describe('roundAt', () => {
	it('counts rounds of ROUND_MS from 1', () => {
		expect(roundAt(0)).toBe(1);
		expect(roundAt(ROUND_MS - 1)).toBe(1);
		expect(roundAt(ROUND_MS)).toBe(2);
		expect(roundAt(ROUND_MS * 5.5)).toBe(6);
		expect(roundAt(-100)).toBe(1);
	});
});

describe('difficulty', () => {
	it('starts gently', () => {
		const first = difficulty(1);
		expect(first.speed).toBe(BASE_SPEED);
		expect(first.spawnEveryMs).toBe(BASE_SPAWN_MS);
		expect(first.slack).toBe(BASE_SLACK);
		expect(first.maxCrates).toBe(BASE_MAX_CRATES);
		expect(first.elements).toBe(2);
		expect(first.maxRules).toBe(1);
		expect(first.ruleKinds).toEqual(['ban', 'tariff']);
	});

	it('gets faster, denser and tighter every round, never easier', () => {
		for (let round = 1; round < 40; round++) {
			const now = difficulty(round);
			const next = difficulty(round + 1);
			expect(next.speed).toBeGreaterThanOrEqual(now.speed);
			expect(next.spawnEveryMs).toBeLessThanOrEqual(now.spawnEveryMs);
			expect(next.slack).toBeLessThanOrEqual(now.slack);
			expect(next.maxCrates).toBeGreaterThanOrEqual(now.maxCrates);
			expect(next.elements).toBeGreaterThanOrEqual(now.elements);
			expect(next.maxRules).toBeGreaterThanOrEqual(now.maxRules);
			expect(next.ruleKinds.length).toBeGreaterThanOrEqual(now.ruleKinds.length);
		}
		expect(difficulty(2).speed).toBeGreaterThan(difficulty(1).speed);
		expect(difficulty(2).spawnEveryMs).toBeLessThan(difficulty(1).spawnEveryMs);
	});

	it('is capped', () => {
		const late = difficulty(500);
		expect(late.speed).toBe(MAX_SPEED);
		expect(late.spawnEveryMs).toBe(MIN_SPAWN_MS);
		expect(late.slack).toBe(MIN_SLACK);
		expect(late.maxCrates).toBe(MAX_CRATES_CAP);
	});

	it('unlocks the third element, the second rule and the harder notices in order', () => {
		expect(difficulty(THIRD_ELEMENT_ROUND - 1).elements).toBe(2);
		expect(difficulty(THIRD_ELEMENT_ROUND).elements).toBe(3);
		expect(difficulty(SECOND_RULE_ROUND - 1).maxRules).toBe(1);
		expect(difficulty(SECOND_RULE_ROUND).maxRules).toBe(2);
		expect(difficulty(QUOTA_ROUND - 1).ruleKinds).not.toContain('quota');
		expect(difficulty(QUOTA_ROUND).ruleKinds).toContain('quota');
		expect(difficulty(LICENCE_ROUND - 1).ruleKinds).not.toContain('licence');
		expect(difficulty(LICENCE_ROUND).ruleKinds).toContain('licence');
	});

	it('rounds down fractions and clamps nonsense to round 1', () => {
		expect(difficulty(2.9).round).toBe(2);
		expect(difficulty(0).round).toBe(1);
		expect(difficulty(-3).speed).toBe(BASE_SPEED);
	});
});
