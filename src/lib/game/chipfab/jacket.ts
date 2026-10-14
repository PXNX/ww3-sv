/*
 * "The Jacket": an invented tech-CEO archetype in a black leather jacket. It is a caricature of
 * a type, not of any real person, and has no real name. It reacts to the run with three poses
 * (static/assets/cameos/chipfab-jacket-<pose>.svg): it cheers on big merges and perfect stacks,
 * and sulks when the shortage is high or a heart was lost.
 */

export type JacketPose = 'cheers' | 'neutral' | 'sulks';

export const JACKET_POSES: readonly JacketPose[] = ['cheers', 'neutral', 'sulks'];

/** From this shortage percentage on, The Jacket sulks even without a fresh bad event */
export const SULK_SHORTAGE = 75;
/** A merge to this tier or higher (128 GB) makes The Jacket cheer */
export const CHEER_TIER = 6;
/** A streak of this many perfect drops makes The Jacket cheer */
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
