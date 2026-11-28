/*
 * Alignment Lab: steer a model with reward weights. Every round a prompt arrives and the player
 * picks one weight to reward. The prompt hides which weight is right; the feedback after the choice
 * shows what it did to helpfulness and drift. Keep helpfulness up and drift below the alarm line.
 */
import { shuffle, type Random } from '#lib/game/random.js';

export const WEIGHTS = ['precise', 'creative', 'please'] as const;
export type Weight = (typeof WEIGHTS)[number];

export interface Scenario {
	id: string;
	/** Message key under alignment_prompt_* */
	prompt: string;
	/** What each weight does to helpfulness and drift when it is rewarded */
	traits: Record<Weight, { helpful: number; drift: number }>;
}

export const SCENARIOS: readonly Scenario[] = [
	{
		id: 'symptoms',
		prompt: 'symptoms',
		traits: {
			precise: { helpful: 9, drift: -2 },
			creative: { helpful: 2, drift: 9 },
			please: { helpful: 1, drift: 13 }
		}
	},
	{
		id: 'poem',
		prompt: 'poem',
		traits: {
			precise: { helpful: 1, drift: 8 },
			creative: { helpful: 10, drift: 1 },
			please: { helpful: 4, drift: 7 }
		}
	},
	{
		id: 'legal',
		prompt: 'legal',
		traits: {
			precise: { helpful: 8, drift: -3 },
			creative: { helpful: 2, drift: 11 },
			please: { helpful: 0, drift: 15 }
		}
	},
	{
		id: 'gift',
		prompt: 'gift',
		traits: {
			precise: { helpful: 2, drift: 7 },
			creative: { helpful: 9, drift: 2 },
			please: { helpful: 7, drift: 8 }
		}
	},
	{
		id: 'numbers',
		prompt: 'numbers',
		traits: {
			precise: { helpful: 11, drift: -2 },
			creative: { helpful: 1, drift: 12 },
			please: { helpful: 2, drift: 10 }
		}
	},
	{
		id: 'complaint',
		prompt: 'complaint',
		traits: {
			precise: { helpful: 5, drift: 2 },
			creative: { helpful: 2, drift: 9 },
			please: { helpful: 10, drift: 6 }
		}
	},
	{
		id: 'history',
		prompt: 'history',
		traits: {
			precise: { helpful: 9, drift: -1 },
			creative: { helpful: 3, drift: 8 },
			please: { helpful: 1, drift: 14 }
		}
	},
	{
		id: 'brainstorm',
		prompt: 'brainstorm',
		traits: {
			precise: { helpful: 1, drift: 9 },
			creative: { helpful: 11, drift: 0 },
			please: { helpful: 5, drift: 7 }
		}
	}
];

export const ROUNDS = 8;
export const START_HELPFUL = 50;
export const START_DRIFT = 10;
export const DRIFT_ALARM = 80;
export const HELPLESS = 20;

export interface AlignmentState {
	round: number;
	helpful: number;
	drift: number;
	score: number;
	status: 'playing' | 'won' | 'lost';
	/** Scenario ids still to come */
	deck: string[];
	current: Scenario | null;
	/** Feedback from the last choice, for the result line */
	feedback: { helpful: number; drift: number } | null;
}

const clamp = (value: number) => Math.min(100, Math.max(0, value));

export function createAlignment(random: Random): AlignmentState {
	const deck = shuffle(
		random,
		SCENARIOS.map((scenario) => scenario.id)
	);
	return {
		round: 0,
		helpful: START_HELPFUL,
		drift: START_DRIFT,
		score: 0,
		status: 'playing',
		deck,
		current: SCENARIOS.find((scenario) => scenario.id === deck[0]) ?? null,
		feedback: null
	};
}

/** Rewards one weight for the current prompt and reveals what it did */
export function reward(state: AlignmentState, weight: Weight): AlignmentState {
	if (state.status !== 'playing' || !state.current) return state;
	const effect = state.current.traits[weight];
	const helpful = clamp(state.helpful + effect.helpful);
	const drift = clamp(state.drift + effect.drift);
	const round = state.round + 1;
	const score = state.score + Math.max(0, effect.helpful - Math.max(0, effect.drift));
	const status =
		drift >= DRIFT_ALARM || helpful <= HELPLESS ? 'lost' : round >= ROUNDS ? 'won' : 'playing';
	const next = state.deck[round];
	return {
		...state,
		round,
		helpful,
		drift,
		score: status === 'won' ? score + helpful - drift : score,
		status,
		current:
			status === 'playing' ? (SCENARIOS.find((scenario) => scenario.id === next) ?? null) : null,
		feedback: effect
	};
}
