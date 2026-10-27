/*
 * The two fronts' problems, and which call is the right one. The jokes live in the messages
 * (petrobras_board_0 ... petrobras_boss_2), the rule lives here: each scenario knows whether the
 * firm call or the loose one keeps the company and the country afloat.
 */
import { randomInt, type Random } from '../random.js';
import { BOARD_SCENARIOS, BOSS_EVERY, BOSS_SCENARIOS, SOCIETY_SCENARIOS } from './config.js';

export type Front = 'board' | 'society' | 'boss';

/** The two answers every prompt offers, named per front by the UI */
export type Choice = 'firm' | 'loose';

/** Right call per board scenario, in message order */
const BOARD_RIGHT: readonly Choice[] = ['firm', 'loose', 'firm', 'firm', 'loose'];

/** Right call per society scenario, in message order */
const SOCIETY_RIGHT: readonly Choice[] = ['firm', 'loose', 'firm', 'loose', 'firm'];

/** The feed algorithm only ever loses to a boring press release */
const BOSS_RIGHT: readonly Choice[] = ['firm', 'firm', 'firm'];

const RIGHT: Record<Front, readonly Choice[]> = {
	board: BOARD_RIGHT,
	society: SOCIETY_RIGHT,
	boss: BOSS_RIGHT
};

const COUNTS: Record<Front, number> = {
	board: BOARD_SCENARIOS,
	society: SOCIETY_SCENARIOS,
	boss: BOSS_SCENARIOS
};

if (
	BOARD_RIGHT.length !== BOARD_SCENARIOS ||
	SOCIETY_RIGHT.length !== SOCIETY_SCENARIOS ||
	BOSS_RIGHT.length !== BOSS_SCENARIOS
) {
	throw new Error('petrobras scenarios and RIGHT disagree about the number of jokes');
}

export function scenarioCount(front: Front): number {
	return COUNTS[front];
}

/** The right answer to a scenario */
export function rightChoice(front: Front, index: number): Choice {
	const choices = RIGHT[front];
	return choices[index] ?? choices[0];
}

/** Picks a scenario the player has not just seen */
export function pickScenario(random: Random, front: Front, recent: readonly number[]): number {
	const count = scenarioCount(front);
	const fresh = Array.from({ length: count }, (_, index) => index).filter(
		(index) => !recent.slice(-2).includes(index)
	);
	const pool = fresh.length > 0 ? fresh : Array.from({ length: count }, (_, index) => index);
	return pool[randomInt(random, 0, pool.length)];
}

/** Which front a round belongs to: the board first, then alternating */
export function frontFor(frontCount: number): Front {
	return frontCount % 2 === 0 ? 'board' : 'society';
}

/** True on every fifth round, when the feed algorithm itself is the opponent */
export function isBossRound(round: number): boolean {
	return round > 0 && round % BOSS_EVERY === 0;
}
