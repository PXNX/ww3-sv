/*
 * Jason Huang of Novideo: a satirical tech-boss cartoon in a black leather jacket. He reacts to
 * the run with three poses (static/assets/cameos/chipfab-jacket-<pose>.svg): he cheers on big
 * merges and perfect stacks, and sulks when the shortage is high or a heart was lost.
 */

export type JacketPose = 'cheers' | 'neutral' | 'sulks';

export const JACKET_POSES: readonly JacketPose[] = ['cheers', 'neutral', 'sulks'];

/** From this shortage percentage on, Jason Huang sulks even without a fresh bad event */
export const SULK_SHORTAGE = 75;
/** A merge to this tier or higher (128 GB) makes Jason Huang cheer */
export const CHEER_TIER = 6;
/** A streak of this many perfect drops makes Jason Huang cheer */
export const CHEER_STREAK = 3;

export function jacketFile(pose: JacketPose): string {
	return `chipfab-jacket-${pose}.svg`;
}

/**
 * The pose to show: a fresh reaction wins, otherwise a high shortage makes him sulk and he is
 * neutral the rest of the time.
 */
export function jacketPose(shortage: number, reaction: JacketPose | null): JacketPose {
	if (reaction) return reaction;
	return shortage >= SULK_SHORTAGE ? 'sulks' : 'neutral';
}
