/*
 * Swappable mascot configuration (requirements Section 13). This is the only module that knows the
 * mascot's name and image paths; game logic never references the character.
 */
import type { Locale } from '$lib/paraglide/runtime';

export type MascotPose = 'idle' | 'smug' | 'sweating' | 'sunk' | 'sulking';

const MASCOT_DIRECTORY = '/assets/mascot';

export const MASCOT_PLACEHOLDER = `${MASCOT_DIRECTORY}/_placeholder-mascot.svg`;

/** Passed to character-facing messages as the {characterName} parameter */
export const CHARACTER_NAME: Record<Locale, string> = {
	en: 'Trump',
	de: 'Trump',
	fa: 'ترامپ',
	ar: 'ترامب',
	uk: 'Трамп',
	ru: 'Трамп'
};

const POSE_FILES: Record<MascotPose, string> = {
	idle: 'mascot-idle.svg',
	smug: 'mascot-smug.svg',
	sweating: 'mascot-sweating.svg',
	sunk: 'mascot-sunk.svg',
	sulking: 'mascot-sulking.svg'
};

/** Add a pose here once its artwork is in static/assets/mascot/ */
const SUPPLIED_POSES: readonly MascotPose[] = ['idle', 'smug', 'sweating', 'sunk', 'sulking'];

export function mascotImage(pose: MascotPose): string {
	return SUPPLIED_POSES.includes(pose)
		? `${MASCOT_DIRECTORY}/${POSE_FILES[pose]}`
		: MASCOT_PLACEHOLDER;
}
