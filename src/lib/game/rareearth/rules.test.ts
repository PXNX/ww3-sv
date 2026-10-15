import { describe, expect, it } from 'vitest';
import { createRandom } from '../random.js';
import {
	NOTICE_LEAD_MS,
	QUOTA_MAX,
	QUOTA_MIN,
	RULE_EVERY_ROUNDS,
	RULE_LIFE_ROUNDS,
	ROUND_MS
} from './config.js';
import { difficulty } from './difficulty.js';
import { WORLD } from './graph.js';
import {
	activeRules,
	bannedLanes,
	isNoticeRound,
	liveRules,
	needsFor,
	proposeRule,
	quotaFull,
	resetQuotas,
	ruleOnLane,
	ruleStatus,
	stillSolvable,
	type Rule
} from './rules.js';

function rule(partial: Partial<Rule>): Rule {
	return {
		id: 1,
		kind: 'ban',
		noticeMs: 0,
		startMs: NOTICE_LEAD_MS,
		endMs: RULE_LIFE_ROUNDS * ROUND_MS,
		edge: null,
		limit: 0,
		used: 0,
		element: null,
		node: null,
		...partial
	};
}

describe('rule lifecycle', () => {
	it('is announced, then in force, then expired', () => {
		const r = rule({});
		expect(ruleStatus(r, 0)).toBe('announced');
		expect(ruleStatus(r, NOTICE_LEAD_MS - 1)).toBe('announced');
		expect(ruleStatus(r, NOTICE_LEAD_MS)).toBe('active');
		expect(ruleStatus(r, r.endMs - 1)).toBe('active');
		expect(ruleStatus(r, r.endMs)).toBe('expired');
	});

	it('tells live rules (announced or in force) from the ones in force', () => {
		const rules = [rule({ id: 1 }), rule({ id: 2, noticeMs: -9000, startMs: -100, endMs: 500 })];
		expect(liveRules(rules, 1000).map((r) => r.id)).toEqual([1]);
		expect(activeRules(rules, 0).map((r) => r.id)).toEqual([2]);
		expect(activeRules(rules, 1000)).toEqual([]);
		expect(activeRules(rules, NOTICE_LEAD_MS).map((r) => r.id)).toEqual([1]);
	});

	it('issues a notice from round 2 on, every few rounds', () => {
		expect(isNoticeRound(1)).toBe(false);
		expect(isNoticeRound(2)).toBe(true);
		expect(isNoticeRound(3)).toBe(false);
		expect(isNoticeRound(2 + RULE_EVERY_ROUNDS)).toBe(true);
		expect(isNoticeRound(0)).toBe(false);
	});
});

describe('rule queries', () => {
	it('collects banned lanes, with or without the announced ones', () => {
		const rules = [rule({ edge: 'm0>h0' }), rule({ id: 2, kind: 'tariff', edge: 'm0>h1' })];
		expect(bannedLanes(rules, 0)).toEqual(new Set());
		expect(bannedLanes(rules, 0, false)).toEqual(new Set(['m0>h0']));
		expect(bannedLanes(rules, NOTICE_LEAD_MS)).toEqual(new Set(['m0>h0']));
	});

	it('finds the rule of a kind on a lane while it is in force', () => {
		const rules = [rule({ kind: 'tariff', edge: 'h1>p1' })];
		expect(ruleOnLane(rules, 0, 'tariff', 'h1>p1')).toBeUndefined();
		expect(ruleOnLane(rules, NOTICE_LEAD_MS, 'tariff', 'h1>p1')).toBe(rules[0]);
		expect(ruleOnLane(rules, NOTICE_LEAD_MS, 'ban', 'h1>p1')).toBeUndefined();
		expect(ruleOnLane(rules, NOTICE_LEAD_MS, 'tariff', 'h1>p0')).toBeUndefined();
	});

	it('knows when a quota is used up and resets it each round', () => {
		const quota = rule({ kind: 'quota', edge: 'h1>p1', limit: 2 });
		expect(quotaFull(quota)).toBe(false);
		quota.used = 2;
		expect(quotaFull(quota)).toBe(true);
		expect(quotaFull(rule({ kind: 'ban', used: 9 }))).toBe(false);
		resetQuotas([quota]);
		expect(quota.used).toBe(0);
	});

	it('hands licences to crates of the licensed element, announced ones included', () => {
		const rules = [rule({ id: 7, kind: 'licence', element: 'neodymium', node: 'p1' })];
		expect(needsFor(rules, 0, 'neodymium')).toEqual([{ rule: 7, node: 'p1' }]);
		expect(needsFor(rules, 0, 'europium')).toEqual([]);
		expect(needsFor(rules, rules[0].endMs, 'neodymium')).toEqual([]);
	});
});

describe('stillSolvable', () => {
	it('is true without rules and with a harmless ban', () => {
		expect(stillSolvable(WORLD, [], 3)).toBe(true);
		expect(stillSolvable(WORLD, [rule({ edge: 'h1>p1' })], 3)).toBe(true);
	});

	it('is false when a ban cuts a mine off or a licence cannot be satisfied', () => {
		const cut = [rule({ edge: 'm0>h0' }), rule({ id: 2, edge: 'm0>h1' })];
		expect(stillSolvable(WORLD, cut, 2)).toBe(false);
		// Port 0 only reaches the two upper factories, so dysprosium (factory 2) never passes it
		const licence = [rule({ kind: 'licence', element: 'dysprosium', node: 'p0' })];
		expect(stillSolvable(WORLD, licence, 3)).toBe(false);
	});
});

describe('proposeRule', () => {
	it('issues a rule that starts after the lead time and ends with its life', () => {
		const proposed = proposeRule(WORLD, [], ROUND_MS, difficulty(2), createRandom(3), 5);
		expect(proposed).not.toBeNull();
		expect(proposed?.id).toBe(5);
		expect(proposed?.noticeMs).toBe(ROUND_MS);
		expect(proposed?.startMs).toBe(ROUND_MS + NOTICE_LEAD_MS);
		expect(proposed?.endMs).toBe(ROUND_MS + RULE_LIFE_ROUNDS * ROUND_MS);
	});

	it('only uses the kinds that are unlocked', () => {
		for (let seed = 1; seed < 60; seed++) {
			const early = proposeRule(WORLD, [], ROUND_MS, difficulty(2), createRandom(seed), 1);
			expect(['ban', 'tariff']).toContain(early?.kind);
		}
		const kinds = new Set<string>();
		for (let seed = 1; seed < 200; seed++) {
			kinds.add(proposeRule(WORLD, [], 6 * ROUND_MS, difficulty(7), createRandom(seed), 1)!.kind);
		}
		expect([...kinds].sort()).toEqual(['ban', 'licence', 'quota', 'tariff']);
	});

	it('keeps quotas within the limits', () => {
		for (let seed = 1; seed < 200; seed++) {
			const proposed = proposeRule(WORLD, [], 4 * ROUND_MS, difficulty(5), createRandom(seed), 1);
			if (proposed?.kind !== 'quota') continue;
			expect(proposed.limit).toBeGreaterThanOrEqual(QUOTA_MIN);
			expect(proposed.limit).toBeLessThanOrEqual(QUOTA_MAX);
			expect(proposed.edge).toBeTruthy();
		}
	});

	it('does not issue a notice when the slots are taken, and frees them on expiry', () => {
		const first = proposeRule(WORLD, [], ROUND_MS, difficulty(2), createRandom(1), 1)!;
		expect(proposeRule(WORLD, [first], 2 * ROUND_MS, difficulty(3), createRandom(2), 2)).toBeNull();
		const second = proposeRule(WORLD, [first], 3 * ROUND_MS, difficulty(4), createRandom(2), 2);
		expect(second).not.toBeNull();
		expect(
			proposeRule(WORLD, [first, second!], 3 * ROUND_MS, difficulty(4), createRandom(5), 3)
		).toBeNull();
		const later = first.endMs;
		expect(proposeRule(WORLD, [first], later, difficulty(5), createRandom(2), 2)).not.toBeNull();
	});

	it('never issues a notice that makes the map unsolvable', () => {
		for (let seed = 1; seed < 300; seed++) {
			const random = createRandom(seed);
			const rules: Rule[] = [];
			for (let round = 2; round <= 14; round += RULE_EVERY_ROUNDS) {
				const proposed = proposeRule(
					WORLD,
					rules,
					round * ROUND_MS,
					difficulty(round),
					random,
					rules.length + 1
				);
				if (proposed) rules.push(proposed);
				const live = liveRules(rules, round * ROUND_MS);
				expect(stillSolvable(WORLD, live, difficulty(round).elements), `seed ${seed}`).toBe(true);
			}
		}
	});

	it('does not repeat a lane or a licensed element among live rules', () => {
		for (let seed = 1; seed < 200; seed++) {
			const random = createRandom(seed);
			const rules: Rule[] = [];
			for (let round = 2; round <= 10; round += 2) {
				const proposed = proposeRule(
					WORLD,
					rules,
					round * ROUND_MS,
					difficulty(round + 4),
					random,
					rules.length + 1
				);
				if (proposed) rules.push(proposed);
				const live = liveRules(rules, round * ROUND_MS);
				const lanes = live.map((r) => r.edge).filter(Boolean);
				expect(new Set(lanes).size).toBe(lanes.length);
				const licensed = live.filter((r) => r.kind === 'licence').map((r) => r.element);
				expect(new Set(licensed).size).toBe(licensed.length);
			}
		}
	});

	it('is deterministic for a seed', () => {
		const run = (seed: number) =>
			proposeRule(WORLD, [], 6 * ROUND_MS, difficulty(7), createRandom(seed), 1);
		expect(run(11)).toEqual(run(11));
		const distinct = new Set(Array.from({ length: 30 }, (_, i) => JSON.stringify(run(i + 1))));
		expect(distinct.size).toBeGreaterThan(5);
	});
});
