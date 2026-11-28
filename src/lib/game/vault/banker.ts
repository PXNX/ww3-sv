/*
 * The banker: an invented, stern, neutral-faced caricature of a private banker (no real person).
 * His face shows the eyebrow count: every mismatch raises one more eyebrow, and the third costs a
 * heart. The two game-over portraits live in static/assets/cameos/vault-banker-<pose>.svg.
 */
import { EYEBROWS_PER_HEART } from './config.js';
import type { Card } from './deck.js';
import { SPECIAL_PAIR } from './symbols.js';

/** neutral: nothing happened, twitch: a special pair made his mouth twitch, glare: a heart was lost */
export type BankerMood = 'neutral' | 'twitch' | 'glare';

export type BankerPortrait = 'neutral' | 'raised';

export function bankerFile(pose: BankerPortrait): string {
	return `vault-banker-${pose}.svg`;
}

/** Eyebrows to draw raised: 0 to EYEBROWS_PER_HEART - 1, junk counts as none */
export function raisedEyebrows(count: number): number {
	if (!Number.isFinite(count)) return 0;
	return Math.min(EYEBROWS_PER_HEART - 1, Math.max(0, Math.floor(count)));
}

/** The game-over portrait: neutral after a run that cleared two vaults or more, otherwise raised */
export function bankerPortrait(levelsCleared: number): BankerPortrait {
	return levelsCleared >= 2 ? 'neutral' : 'raised';
}

export type TellDirection = 'left' | 'right' | 'up' | 'down';

/**
 * A second information channel: while the gold-and-cheese pair is still hidden, the banker's
 * glance leans towards its side of the grid. Once it has been found he looks straight ahead
 * again. It points to a quadrant, never to an exact card, so it guides without solving the level.
 */
export function bankerTell(
	cards: readonly Card[],
	cols: number,
	rows: number
): TellDirection | null {
	const spots = cards.flatMap((card, index) =>
		card.state !== 'matched' && SPECIAL_PAIR.includes(card.symbol) ? [index] : []
	);
	if (spots.length === 0) return null;
	const xs = spots.map((index) => index % cols);
	const ys = spots.map((index) => Math.floor(index / cols));
	const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
	const dx = mean(xs) - (cols - 1) / 2;
	const dy = mean(ys) - (rows - 1) / 2;
	if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? 'left' : 'right';
	return dy < 0 ? 'up' : 'down';
}
