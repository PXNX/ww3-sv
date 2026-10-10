/*
 * What a cat's purr sounds like, as plain numbers: the mixer turns them into oscillators. Kept
 * apart from the Web Audio code so it can be tested: the loudness follows the volume the petting
 * produced, the pitch is the cat's own, and the wobble in the pitch goes away as the cat gets happy.
 */
import { purrFrequency } from './cats';
import { PITCH_HAPPINESS } from './config';

export interface PurrVoice {
	/** Hz of the purr's fundamental */
	frequency: number;
	/** Output gain of the voice (0 to MAX_PURR_GAIN) */
	gain: number;
	/** Depth of the slow pitch wobble in cents; 0 for a steady purr */
	wobbleCents: number;
}

export const MAX_PURR_GAIN = 0.34;
export const MAX_WOBBLE_CENTS = 90;

/** Share of the wobble that remains at a given happiness: it is gone once the pitch gauge shows */
export function steadiness(happiness: number): number {
	return Math.min(1, Math.max(0, happiness / PITCH_HAPPINESS));
}

/**
 * The voice for a cat with the given purr rank. `volume` is the purr level (0 to 1) and `happiness`
 * (0 to 1) steadies it. The loudness curve is a little steeper than linear, so a faint purr stays
 * faint and a fully built-up one is clearly louder.
 */
export function purrVoice(rank: number, volume: number, happiness: number): PurrVoice {
	const level = Math.min(1, Math.max(0, volume));
	return {
		frequency: purrFrequency(rank),
		gain: MAX_PURR_GAIN * Math.pow(level, 1.4),
		wobbleCents: MAX_WOBBLE_CENTS * (1 - steadiness(happiness))
	};
}
