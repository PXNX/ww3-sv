/*
 * Turns finger and mouse movement into Run Comrade commands. A swipe changes lane (sideways) or
 * jumps and ducks (up and down); a tap above the runner's feet jumps and a tap on or below them
 * ducks. One press gives one command, so a long drag does not fire over and over.
 */
import type { Command } from './step';

/** How far a press has to travel (in screen pixels) before it counts as a swipe */
export const SWIPE_PX = 24;
/** Where the tap zones meet, as a share of the playfield height from the top */
export const TAP_SPLIT = 0.74;

/** The command for a movement of (dx, dy) pixels, or null while it is still a tap-sized wobble */
export function swipeCommand(dx: number, dy: number, minPx: number = SWIPE_PX): Command | null {
	if (Math.max(Math.abs(dx), Math.abs(dy)) < minPx) return null;
	if (Math.abs(dx) >= Math.abs(dy)) return dx < 0 ? 'left' : 'right';
	return dy < 0 ? 'jump' : 'duck';
}

/** A tap in the upper part of the field jumps, one in the lower part ducks */
export function tapCommand(yShare: number): Command {
	return yShare < TAP_SPLIT ? 'jump' : 'duck';
}

export interface Gesture {
	/** The press moved by (dx, dy) since it started; returns a command once, as soon as it is a swipe */
	move(dx: number, dy: number): Command | null;
	/** The press ended at (dx, dy) from its start and at this height of the field (0 top to 1 bottom) */
	release(dx: number, dy: number, yShare: number): Command | null;
}

export function createGesture(minPx: number = SWIPE_PX): Gesture {
	let fired = false;
	return {
		move(dx, dy) {
			if (fired) return null;
			const found = swipeCommand(dx, dy, minPx);
			if (found) fired = true;
			return found;
		},
		release(dx, dy, yShare) {
			if (fired) return null;
			fired = true;
			return swipeCommand(dx, dy, minPx) ?? tapCommand(yShare);
		}
	};
}
