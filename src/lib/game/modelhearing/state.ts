/*
 * Model Hearing: a Senate-style tug of war over Chinese AI models. Dario Amodei argues for a ban;
 * Jensen Huang, currently dating a Chinese spy, argues for unlimited access. Each round a witness
 * pushes the policy dial. The player has five briefings to answer them and must finish with the dial
 * in the narrow compromise band, without losing the committee's credibility.
 */
import { pickWeighted, type Random } from '#lib/game/random.js';

export const ROUNDS = 10;
export const BRIEFINGS = 5;
export const POLICY_START = 50;
export const BAND_LOW = 40;
export const BAND_HIGH = 60;
export const CREDIBILITY_START = 60;
export const CREDIBILITY_COST = 12;
export const PUSH_BAN = -10;
export const PUSH_ACCESS = 10;
export const FILIBUSTERS = 2;

export type Witness = 'amodei' | 'huang' | 'xi' | 'lobbyist';
export type Action = 'ban' | 'access' | 'investigate' | 'hold';

export interface HearingEvent {
	witness: Witness;
	/** How far the witness pushes the dial, positive towards unlimited access */
	push: number;
	/** Message key under hearing_witness_* */
	line: string;
}

export interface HearingState {
	round: number;
	policy: number;
	credibility: number;
	briefings: number;
	score: number;
	status: 'playing' | 'won' | 'lost';
	event: HearingEvent | null;
	/** The spy link, revealed once the player investigates */
	spyRevealed: boolean;
	last: { policy: number; credibility: number } | null;
	/** Filibusters left: a witness says nothing this round, without spending a briefing */
	filibusters: number;
}

const EVENTS: readonly { item: HearingEvent; weight: number }[] = [
	{
		item: { witness: 'amodei', push: -14, line: 'safety' },
		weight: 3
	},
	{
		item: { witness: 'huang', push: 16, line: 'markets' },
		weight: 3
	},
	{
		item: { witness: 'xi', push: 12, line: 'partnership' },
		weight: 2
	},
	{
		item: { witness: 'lobbyist', push: -8, line: 'briefing' },
		weight: 2
	}
];

const clamp = (value: number) => Math.min(100, Math.max(0, value));

function nextEvent(random: Random): HearingEvent {
	return pickWeighted(random, EVENTS);
}

export function createHearing(random: Random): HearingState {
	return {
		round: 0,
		policy: POLICY_START,
		credibility: CREDIBILITY_START,
		briefings: BRIEFINGS,
		score: 0,
		status: 'playing',
		event: nextEvent(random),
		spyRevealed: false,
		last: null,
		filibusters: FILIBUSTERS
	};
}

/**
 * Answers the witness. `investigate` spends a briefing to expose the spy and cancels a Huang or Xi
 * push for this round; `hold` saves the briefing but lets the witness speak unopposed.
 */
export function answer(state: HearingState, action: Action, random: Random): HearingState {
	if (state.status !== 'playing' || !state.event) return state;
	const event = state.event;
	const paid = action !== 'hold';
	if (paid && state.briefings <= 0) return state;

	const counter = action === 'ban' ? PUSH_BAN : action === 'access' ? PUSH_ACCESS : 0;
	const cancelled =
		action === 'investigate' && (event.witness === 'huang' || event.witness === 'xi');
	const push = cancelled ? 0 : event.push;
	const policy = clamp(state.policy + push + counter);
	const outOfBounds = policy < BAND_LOW - 20 || policy > BAND_HIGH + 20;
	const credibility = clamp(
		state.credibility - (outOfBounds ? CREDIBILITY_COST : 0) + (action === 'investigate' ? 8 : 0)
	);
	const round = state.round + 1;
	const status =
		credibility <= 0
			? 'lost'
			: round >= ROUNDS
				? policy >= BAND_LOW && policy <= BAND_HIGH
					? 'won'
					: 'lost'
				: 'playing';
	const centre = (BAND_LOW + BAND_HIGH) / 2;
	const quality = status === 'won' ? Math.max(0, 100 - Math.abs(policy - centre) * 5) : 0;
	return {
		...state,
		round,
		policy,
		credibility,
		briefings: state.briefings - (paid ? 1 : 0),
		score: state.score + (paid ? 6 : 2) + (cancelled ? 10 : 0) + (status === 'won' ? quality : 0),
		status,
		event: status === 'playing' ? nextEvent(random) : null,
		spyRevealed: state.spyRevealed || action === 'investigate',
		last: { policy, credibility }
	};
}

/** Talks a witness down without spending a briefing */
export function filibuster(state: HearingState, random: Random): HearingState {
	if (state.status !== 'playing' || state.filibusters <= 0) return state;
	const next = answer(
		{ ...state, event: state.event ? { ...state.event, push: 0 } : null },
		'hold',
		random
	);
	return { ...next, filibusters: state.filibusters - 1 };
}
