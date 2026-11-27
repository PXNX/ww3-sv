/*
 * Tracks whether a game mode's tutorial has already been shown on this device, so it only
 * ever appears once per mode instead of cluttering every replay.
 *
 * The tutorial itself is an interactive step wizard (see InteractiveTutorial.svelte): every step
 * spotlights a real control on the page and, for `action: 'tap'` steps, only advances once the
 * player has actually used that control. Each game describes its steps in its own `tutorial.ts`.
 */

import { localStore } from './storage';

const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';

/**
 * True only the first time this mode is played on this device. Marks it seen immediately, so a
 * reload or a second visit never shows the tutorial again.
 */
export function firstPlay(mode: string): boolean {
	const key = `tutorial:${mode}`;
	const seen = localStore().read(key, false, isBoolean);
	if (!seen) localStore().write(key, true);
	return !seen;
}

export type TutorialStep = {
	/** Short heading. Use an existing translated `<mode>_tutorial_*` message. */
	title: string;
	/** One short tip. Use an existing translated `<mode>_tutorial_*` message. */
	text: string;
	/**
	 * Selector of a real control in the page, e.g. `[data-tutorial="start"]`. Add a
	 * `data-tutorial` attribute to the element if it has no stable selector. Omit for a step that
	 * only explains something.
	 */
	target?: string;
	/**
	 * 'tap' makes the player use the spotlighted control to advance. Without it the step advances
	 * with the Next button (or Enter / arrow right).
	 */
	action?: 'tap';
};
