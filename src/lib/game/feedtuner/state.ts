/*
 * Feed Tuner: Meta's ranking console. Every turn a post arrives with an engagement pull and an
 * outrage risk. Promote, hold or demote it; keep reach above the floor and outrage below the ceiling.
 */
import { pickWeighted, type Random } from '#lib/game/random.js';

export const ACTIONS = ['promote', 'hold', 'demote'] as const;
export type Action = (typeof ACTIONS)[number];

export const TURNS = 10;
export const START_REACH = 55;
export const START_OUTRAGE = 20;
export const MIN_REACH = 30;
export const MAX_OUTRAGE = 70;
export const FACT_CHECKS = 2;
export const FACT_OUTRAGE_DROP = 25;
export const FACT_REACH_COST = 10;

export interface Post {
	label: 'deal' | 'outrage' | 'cat' | 'ad';
	engagement: number;
	risk: number;
}

export interface FeedState {
	turn: number;
	reach: number;
	outrage: number;
	score: number;
	status: 'playing' | 'won' | 'lost';
	post: Post | null;
	last: { reach: number; outrage: number } | null;
	/** Fact-checks left: costly in reach, but they pull outrage down */
	factChecks: number;
}

const POSTS: readonly { item: Post['label']; weight: number; engagement: number; risk: number }[] =
	[
		{ item: 'deal', weight: 3, engagement: 9, risk: 4 },
		{ item: 'outrage', weight: 3, engagement: 13, risk: 14 },
		{ item: 'cat', weight: 3, engagement: 6, risk: 1 },
		{ item: 'ad', weight: 2, engagement: 8, risk: 7 }
	];

const clamp = (value: number) => Math.min(100, Math.max(0, value));

function nextPost(random: Random): Post {
	const label = pickWeighted(random, POSTS);
	const spec = POSTS.find((entry) => entry.item === label)!;
	return { label, engagement: spec.engagement, risk: spec.risk };
}

export function createFeed(random: Random): FeedState {
	return {
		turn: 0,
		reach: START_REACH,
		outrage: START_OUTRAGE,
		score: 0,
		status: 'playing',
		post: nextPost(random),
		last: null,
		factChecks: FACT_CHECKS
	};
}

/** Applies a ranking action to the current post and moves the two meters */
export function rank(state: FeedState, action: Action, random: Random): FeedState {
	if (state.status !== 'playing' || !state.post) return state;
	const post = state.post;
	const share = action === 'promote' ? 1 : action === 'hold' ? 0.5 : 0.15;
	const reach = clamp(state.reach + post.engagement * share - (action === 'demote' ? 3 : 0));
	const outrage = clamp(state.outrage + post.risk * share - (action === 'demote' ? 4 : 1));
	const status =
		reach <= MIN_REACH || outrage >= MAX_OUTRAGE
			? 'lost'
			: state.turn + 1 >= TURNS
				? 'won'
				: 'playing';
	return {
		...state,
		turn: state.turn + 1,
		reach,
		outrage,
		score: status === 'lost' ? state.score : state.score + Math.round(post.engagement * share),
		status,
		post: status === 'playing' ? nextPost(random) : null,
		last: { reach, outrage }
	};
}

/** Publishes a correction: less reach now, much less outrage */
export function factCheck(state: FeedState): FeedState {
	if (state.status !== 'playing' || state.factChecks <= 0) return state;
	return {
		...state,
		factChecks: state.factChecks - 1,
		reach: clamp(state.reach - FACT_REACH_COST),
		outrage: clamp(state.outrage - FACT_OUTRAGE_DROP),
		last: {
			reach: clamp(state.reach - FACT_REACH_COST),
			outrage: clamp(state.outrage - FACT_OUTRAGE_DROP)
		}
	};
}
