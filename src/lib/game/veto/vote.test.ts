import { describe, expect, it } from 'vitest';
import { createRandom } from '../random.js';
import { SEAT_COUNT } from './config.js';
import {
	actionForStance,
	dealCards,
	dealRound,
	evaluateVote,
	pickOutcome,
	stanceForAction,
	tally,
	verdict,
	ACTIONS,
	STANCES,
	type Outcome,
	type Stance
} from './vote.js';

describe('tally', () => {
	it('counts every card once', () => {
		expect(tally(['aye', 'aye', 'nay', 'meh', 'aye'])).toEqual({ aye: 3, nay: 1, meh: 1 });
	});
});

describe('verdict', () => {
	it('follows a majority of three or more', () => {
		expect(verdict(['aye', 'aye', 'aye', 'nay', 'meh'])).toEqual({
			expected: 'yes',
			tieBreak: false
		});
		expect(verdict(['meh', 'meh', 'meh', 'meh', 'nay'])).toEqual({
			expected: 'abstain',
			tieBreak: false
		});
		expect(verdict(['nay', 'nay', 'nay', 'nay', 'nay'])).toEqual({
			expected: 'veto',
			tieBreak: false
		});
	});

	it('does not care where the matching cards sit', () => {
		expect(verdict(['nay', 'aye', 'nay', 'meh', 'nay']).expected).toBe('veto');
		expect(verdict(['meh', 'aye', 'aye', 'meh', 'aye']).expected).toBe('yes');
	});

	it('sends a round without a majority to the veto stamp as a tie-break', () => {
		expect(verdict(['aye', 'aye', 'nay', 'nay', 'meh'])).toEqual({
			expected: 'veto',
			tieBreak: true
		});
		expect(verdict(['meh', 'aye', 'meh', 'aye', 'nay'])).toEqual({
			expected: 'veto',
			tieBreak: true
		});
	});

	it('marks a round won by nay votes as a veto that is not a tie-break', () => {
		expect(verdict(['nay', 'nay', 'nay', 'aye', 'aye']).tieBreak).toBe(false);
	});
});

describe('evaluateVote', () => {
	const cards: Stance[] = ['aye', 'aye', 'aye', 'nay', 'meh'];

	it('accepts the action the majority asks for', () => {
		expect(evaluateVote(cards, 'yes')).toMatchObject({ correct: true, chosen: 'yes' });
	});

	it('rejects every other action and names the right one', () => {
		for (const chosen of ['abstain', 'veto'] as const) {
			expect(evaluateVote(cards, chosen)).toMatchObject({
				correct: false,
				expected: 'yes',
				chosen
			});
		}
	});

	it('accepts only the veto in a tie-break', () => {
		const tie: Stance[] = ['aye', 'aye', 'meh', 'meh', 'nay'];
		expect(evaluateVote(tie, 'veto').correct).toBe(true);
		expect(evaluateVote(tie, 'yes').correct).toBe(false);
		expect(evaluateVote(tie, 'abstain').correct).toBe(false);
	});

	it('has exactly one right action for every possible hand', () => {
		const stances: Stance[] = [...STANCES];
		for (const a of stances)
			for (const b of stances)
				for (const c of stances)
					for (const d of stances)
						for (const e of stances) {
							const hand = [a, b, c, d, e];
							const right = ACTIONS.filter((action) => evaluateVote(hand, action).correct);
							expect(right).toHaveLength(1);
						}
	});
});

describe('stance and action mapping', () => {
	it('is a round trip', () => {
		for (const action of ACTIONS) expect(actionForStance(stanceForAction(action))).toBe(action);
		expect(actionForStance('nay')).toBe('veto');
	});
});

describe('dealing cards', () => {
	it('always deals one card per seat that decides the requested kind of round', () => {
		const random = createRandom(11);
		const outcomes: Outcome[] = ['yes', 'abstain', 'veto', 'tie'];
		for (let i = 0; i < 400; i++) {
			const outcome = outcomes[i % outcomes.length];
			const cards = dealCards(random, outcome);
			expect(cards).toHaveLength(SEAT_COUNT);
			const result = verdict(cards);
			if (outcome === 'tie') {
				expect(result).toEqual({ expected: 'veto', tieBreak: true });
			} else {
				expect(result).toEqual({ expected: outcome, tieBreak: false });
			}
		}
	});

	it('deals ties as two pairs and a single', () => {
		const random = createRandom(3);
		for (let i = 0; i < 50; i++) {
			const counts = Object.values(tally(dealCards(random, 'tie'))).sort();
			expect(counts).toEqual([1, 2, 2]);
		}
	});

	it('is deterministic for a seed', () => {
		const a = createRandom(5);
		const b = createRandom(5);
		for (let i = 0; i < 20; i++) expect(dealRound(a)).toEqual(dealRound(b));
	});

	it('mixes all four kinds of round', () => {
		const random = createRandom(9);
		const seen = new Set<Outcome>();
		for (let i = 0; i < 200; i++) seen.add(pickOutcome(random));
		expect([...seen].sort()).toEqual(['abstain', 'tie', 'veto', 'yes']);
	});
});
