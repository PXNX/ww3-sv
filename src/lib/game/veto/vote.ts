/*
 * Vote evaluation. Each of the five seats holds up a card, aye, nay or meh. Three alike decide the
 * round: a majority of ayes means vote yes, of mehs means abstain, of nays means veto. With no
 * majority (two against two and one left over) the tie-break goes to the veto stamp.
 */
import { MAJORITY, MAJORITY_SIZE_WEIGHTS, OUTCOME_WEIGHTS, SEAT_COUNT } from './config.js';
import { pickWeighted, shuffle, type Random } from '../random.js';

export type Stance = 'aye' | 'nay' | 'meh';
export type Action = 'yes' | 'abstain' | 'veto';
export type Outcome = Action | 'tie';

export const STANCES: readonly Stance[] = ['aye', 'nay', 'meh'];
export const ACTIONS: readonly Action[] = ['yes', 'abstain', 'veto'];

const ACTION_OF: Record<Stance, Action> = { aye: 'yes', meh: 'abstain', nay: 'veto' };
const STANCE_OF: Record<Action, Stance> = { yes: 'aye', abstain: 'meh', veto: 'nay' };

export function actionForStance(stance: Stance): Action {
	return ACTION_OF[stance];
}

export function stanceForAction(action: Action): Stance {
	return STANCE_OF[action];
}

export function tally(cards: readonly Stance[]): Record<Stance, number> {
	const counts: Record<Stance, number> = { aye: 0, nay: 0, meh: 0 };
	for (const card of cards) counts[card] += 1;
	return counts;
}

export interface Verdict {
	/** The one action that is right this round */
	expected: Action;
	/** True when no card has a majority and the veto settles it */
	tieBreak: boolean;
}

export function verdict(cards: readonly Stance[]): Verdict {
	const counts = tally(cards);
	const winner = STANCES.find((stance) => counts[stance] >= MAJORITY);
	if (winner) return { expected: ACTION_OF[winner], tieBreak: false };
	return { expected: 'veto', tieBreak: true };
}

export interface Evaluation extends Verdict {
	chosen: Action;
	correct: boolean;
}

export function evaluateVote(cards: readonly Stance[], chosen: Action): Evaluation {
	const result = verdict(cards);
	return { ...result, chosen, correct: result.expected === chosen };
}

/** Deals five cards that make the given kind of round, in a random seat order */
export function dealCards(random: Random, outcome: Outcome): Stance[] {
	if (outcome === 'tie') {
		// Two pairs and one left over: all three stances appear, so nobody has a majority
		const [pairA, pairB, single] = shuffle(random, STANCES);
		return shuffle(random, [pairA, pairA, pairB, pairB, single]);
	}
	const winner = STANCE_OF[outcome];
	const size = pickWeighted(random, MAJORITY_SIZE_WEIGHTS);
	const others = STANCES.filter((stance) => stance !== winner);
	const cards: Stance[] = Array.from({ length: size }, () => winner);
	while (cards.length < SEAT_COUNT) cards.push(others[Math.floor(random() * others.length)]);
	return shuffle(random, cards);
}

const OUTCOMES = Object.keys(OUTCOME_WEIGHTS) as Outcome[];

/** Picks the kind of the next round by the configured odds */
export function pickOutcome(random: Random): Outcome {
	return pickWeighted(
		random,
		OUTCOMES.map((item) => ({ item, weight: OUTCOME_WEIGHTS[item] }))
	);
}

export function dealRound(random: Random): Stance[] {
	return dealCards(random, pickOutcome(random));
}
