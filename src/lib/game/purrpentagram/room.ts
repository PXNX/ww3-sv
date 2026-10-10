/*
 * What the room looks like while an event is going on, as numbers between 0 and 1 that the board
 * turns into SVG. Pure, so it can be tested: in particular, with reduced motion the thunder never
 * flashes (a steady darkening takes its place), which keeps the room safe for people sensitive
 * to flicker.
 */
import { laserPoint } from './reactions';
import type { Point } from './geometry';
import type { RoomEventState } from './state';

export interface RoomLook {
	/** Darkness over the room (0 to 1) */
	dim: number;
	/** A flash of lightning (0 to 1) */
	flash: number;
	/** How far the candles have been blown out (0 lit, 1 out) */
	candlesOut: number;
	/** The candle flames flicker */
	flicker: boolean;
	/** The window is open: 0 closed, 1 wide open */
	window: number;
	/** The door stands ajar: 0 closed, 1 open */
	door: number;
	laser: Point | null;
}

export const CALM_LOOK: RoomLook = {
	dim: 0,
	flash: 0,
	candlesOut: 0,
	flicker: false,
	window: 0,
	door: 0,
	laser: null
};

/** Rises over `rise` ms, holds, and falls over the last `fall` ms: 0 to 1 */
export function envelope(
	elapsedMs: number,
	durationMs: number,
	rise: number,
	fall: number
): number {
	const up = Math.min(1, elapsedMs / rise);
	const down = Math.min(1, (durationMs - elapsedMs) / fall);
	return Math.max(0, Math.min(up, down));
}

/** The look of the room for the running event (or the calm room when none is running) */
export function roomLook(event: RoomEventState | null, reducedMotion = false): RoomLook {
	if (!event) return CALM_LOOK;
	const elapsed = event.durationMs - event.remainingMs;
	const { durationMs } = event;
	switch (event.kind) {
		case 'dim':
			return { ...CALM_LOOK, dim: 0.62 * envelope(elapsed, durationMs, 450, 800) };
		case 'candles':
			return {
				...CALM_LOOK,
				candlesOut: envelope(elapsed, durationMs, 500, 900),
				flicker: !reducedMotion && elapsed < 600
			};
		case 'draft':
			return { ...CALM_LOOK, window: envelope(elapsed, durationMs, 600, 700) };
		case 'creak':
			return { ...CALM_LOOK, door: envelope(elapsed, durationMs, 900, 600) };
		case 'laser':
			return { ...CALM_LOOK, laser: laserPoint(elapsed / durationMs) };
		case 'thunder': {
			// Two quick flashes and a long rumble; a steady dark instead of flashes when motion is reduced
			if (reducedMotion)
				return { ...CALM_LOOK, dim: 0.3 * envelope(elapsed, durationMs, 300, 900) };
			const first = elapsed < 110 ? 1 - elapsed / 110 : 0;
			const second = elapsed >= 280 && elapsed < 420 ? 0.65 * (1 - (elapsed - 280) / 140) : 0;
			return { ...CALM_LOOK, flash: Math.max(first, second) };
		}
	}
}
