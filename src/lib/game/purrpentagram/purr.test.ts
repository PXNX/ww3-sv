import { describe, expect, it } from 'vitest';
import { purrFrequency } from './cats';
import { PITCH_HAPPINESS } from './config';
import { MAX_PURR_GAIN, MAX_WOBBLE_CENTS, purrVoice, steadiness } from './purr';

describe('purrVoice', () => {
	it('gives each purr rank its own, rising pitch', () => {
		const pitches = [0, 1, 2, 3, 4].map((rank) => purrVoice(rank, 1, 0).frequency);
		for (let i = 1; i < pitches.length; i++) expect(pitches[i]).toBeGreaterThan(pitches[i - 1]);
		expect(pitches[2]).toBeCloseTo(purrFrequency(2));
		// Low enough to rumble, and the ranks are far enough apart to tell by ear
		expect(pitches[0]).toBeLessThan(80);
		expect(pitches[1] / pitches[0]).toBeGreaterThan(1.2);
	});

	it('is silent when the volume is zero and loudest at full volume', () => {
		expect(purrVoice(2, 0, 0).gain).toBe(0);
		expect(purrVoice(2, 1, 0).gain).toBeCloseTo(MAX_PURR_GAIN);
		expect(purrVoice(2, 5, 0).gain).toBeCloseTo(MAX_PURR_GAIN);
		expect(purrVoice(2, -1, 0).gain).toBe(0);
	});

	it('gets louder as the volume rises, a faint purr staying faint', () => {
		const gains = [0.2, 0.4, 0.6, 0.8, 1].map((volume) => purrVoice(2, volume, 0).gain);
		for (let i = 1; i < gains.length; i++) expect(gains[i]).toBeGreaterThan(gains[i - 1]);
		expect(gains[0]).toBeLessThan(MAX_PURR_GAIN * 0.2);
	});

	it('wobbles for an unsettled cat and holds steady once it is happy', () => {
		expect(purrVoice(1, 1, 0).wobbleCents).toBe(MAX_WOBBLE_CENTS);
		expect(purrVoice(1, 1, PITCH_HAPPINESS / 2).wobbleCents).toBeCloseTo(MAX_WOBBLE_CENTS / 2);
		expect(purrVoice(1, 1, PITCH_HAPPINESS).wobbleCents).toBe(0);
		expect(purrVoice(1, 1, 1).wobbleCents).toBe(0);
	});
});

describe('steadiness', () => {
	it('runs from 0 to 1 across the happiness that reveals the pitch', () => {
		expect(steadiness(0)).toBe(0);
		expect(steadiness(PITCH_HAPPINESS)).toBe(1);
		expect(steadiness(2)).toBe(1);
		expect(steadiness(-1)).toBe(0);
	});
});
