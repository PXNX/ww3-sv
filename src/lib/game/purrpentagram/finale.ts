/*
 * The finale as a pure function of time: the pentagram ignites one line at a time in the order it
 * was drawn, ends in a burst and then breathes until the player leaves the screen. The renderer
 * only reads the numbers; nothing here knows about SVG or CSS.
 */
import { CAT_COUNT } from './config';

/** Time each line takes to ignite */
export const LINE_MS = 650;
/** The burst after the last line */
export const BURST_MS = 900;
/** One slow breath of the halo and the candles */
export const BREATH_MS = 4200;
/** The banner and the score panel wait until the burst has landed */
export const BANNER_DELAY_MS = LINE_MS * CAT_COUNT + 500;

export type FinalePhase = 'igniting' | 'burst' | 'breathing';

export interface FinaleStage {
	phase: FinalePhase;
	/** Lines that are fully lit */
	litLines: number;
	/** The line that is igniting now, if any, and how far along it is (0 to 1) */
	igniting: { line: number; progress: number } | null;
	/** Strength of the burst flash: 0 before it, 1 at its peak, fading back as the breathing starts */
	burst: number;
	/** The red-violet halo on the floor (0 to 1) */
	halo: number;
	/** How brightly the cats' eyes glow (0 to 1) */
	eyes: number;
	/** How far the candles have flared (0 to 1) */
	candles: number;
	/** The slow breathing pulse (0 to 1); a steady glow when motion is reduced */
	breath: number;
	/** Opacity of the "Ritual Complete" banner (0 to 1) */
	banner: number;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** The finale `elapsedMs` after the last cat was joined correctly */
export function finaleStage(elapsedMs: number, reducedMotion = false): FinaleStage {
	const t = Math.max(0, elapsedMs);
	const lineEnd = LINE_MS * CAT_COUNT;
	const burstEnd = lineEnd + BURST_MS;

	const litLines = Math.min(CAT_COUNT, Math.floor(t / LINE_MS));
	const igniting =
		litLines < CAT_COUNT ? { line: litLines, progress: (t % LINE_MS) / LINE_MS } : null;
	const phase: FinalePhase = t < lineEnd ? 'igniting' : t < burstEnd ? 'burst' : 'breathing';

	// 0 to 1 over the whole run-up, so the halo and the eyes grow with the lines
	const buildUp = clamp01(t / burstEnd);
	// A flash that rises over the first part of the burst and then falls away
	const sinceLines = t - lineEnd;
	const burst =
		sinceLines <= 0
			? 0
			: sinceLines < BURST_MS * 0.3
				? sinceLines / (BURST_MS * 0.3)
				: reducedMotion
					? 0.6
					: clamp01(1 - (sinceLines - BURST_MS * 0.3) / (BURST_MS * 1.7));

	const breathing = Math.max(0, t - burstEnd);
	const breath = reducedMotion
		? 0.7
		: 0.5 + 0.5 * Math.sin((2 * Math.PI * breathing) / BREATH_MS - Math.PI / 2);

	return {
		phase,
		litLines,
		igniting,
		burst,
		halo: clamp01(0.15 + 0.85 * buildUp),
		eyes: clamp01((t - lineEnd) / BURST_MS),
		candles: clamp01(buildUp * 1.2),
		breath,
		banner: clamp01((t - BANNER_DELAY_MS) / 700)
	};
}
