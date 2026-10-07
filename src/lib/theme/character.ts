/*
 * Swappable mascot configuration (requirements Section 13). This is the only module that knows the
 * mascot's name and image paths; game logic never references the character.
 */
import type { Random } from '#lib/game/random.js';
import type { Locale } from '#lib/paraglide/runtime.js';

export type MascotPose =
	'idle' | 'smug' | 'sweating' | 'sunk' | 'sulking' | 'crying' | 'rage' | 'shocked' | 'facepalm';

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
	sulking: 'mascot-sulking.svg',
	crying: 'mascot-crying.svg',
	rage: 'mascot-rage.svg',
	shocked: 'mascot-shocked.svg',
	facepalm: 'mascot-facepalm.svg'
};

/** Add a pose here once its artwork is in static/assets/mascot/ */
const SUPPLIED_POSES: readonly MascotPose[] = [
	'idle',
	'smug',
	'sweating',
	'sunk',
	'sulking',
	'crying',
	'rage',
	'shocked',
	'facepalm'
];

/** The poses the game-over screen picks from, one at random per game over */
export const GAME_OVER_POSES: readonly MascotPose[] = [
	'sunk',
	'crying',
	'rage',
	'shocked',
	'facepalm'
];

/** Picks a game-over pose at random, never the same one twice in a row */
export function pickGameOverPose(random: Random, previous?: MascotPose): MascotPose {
	const pool = GAME_OVER_POSES.filter((pose) => pose !== previous);
	return pool[Math.floor(random() * pool.length)];
}

export function mascotImage(pose: MascotPose): string {
	return SUPPLIED_POSES.includes(pose)
		? `${MASCOT_DIRECTORY}/${POSE_FILES[pose]}`
		: MASCOT_PLACEHOLDER;
}
