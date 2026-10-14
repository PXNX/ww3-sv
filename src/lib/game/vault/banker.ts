/*
 * The banker: an invented, stern, neutral-faced caricature of a private banker (no real person).
 * His face shows the eyebrow count: every mismatch raises one more eyebrow, and the third costs a
 * heart. The two game-over portraits live in static/assets/cameos/vault-banker-<pose>.svg.
 */
import { EYEBROWS_PER_HEART } from './config.js';

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
