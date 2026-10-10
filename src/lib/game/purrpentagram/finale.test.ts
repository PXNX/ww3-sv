import { describe, expect, it } from 'vitest';
import { CAT_COUNT } from './config';
import { BANNER_DELAY_MS, BREATH_MS, BURST_MS, finaleStage, LINE_MS } from './finale';
import { catHearts, MAX_HEARTS, ritualScore } from './scoring';
import {
	BARS,
	BAR_SECONDS,
	D_MINOR_PITCHES,
	finaleScore,
	LOOP_SECONDS,
	noteFrequency,
	pitchClass
} from './music';

describe('finaleStage', () => {
	it('starts dark', () => {
		const stage = finaleStage(0);
		expect(stage.phase).toBe('igniting');
		expect(stage.litLines).toBe(0);
		expect(stage.igniting).toEqual({ line: 0, progress: 0 });
		expect(stage.burst).toBe(0);
		expect(stage.eyes).toBe(0);
		expect(stage.banner).toBe(0);
	});

	it('ignites the lines one at a time, in order', () => {
		for (let line = 0; line < CAT_COUNT; line++) {
			const stage = finaleStage(line * LINE_MS + LINE_MS / 2);
			expect(stage.litLines).toBe(line);
			expect(stage.igniting?.line).toBe(line);
			expect(stage.igniting?.progress).toBeCloseTo(0.5);
		}
	});

	it('bursts once the last line is lit, then settles into breathing', () => {
		const lit = finaleStage(LINE_MS * CAT_COUNT + 1);
		expect(lit.litLines).toBe(CAT_COUNT);
		expect(lit.igniting).toBeNull();
		expect(lit.phase).toBe('burst');
		expect(lit.burst).toBeGreaterThan(0);

		const peak = finaleStage(LINE_MS * CAT_COUNT + BURST_MS * 0.3);
		expect(peak.burst).toBeCloseTo(1);

		const later = finaleStage(LINE_MS * CAT_COUNT + BURST_MS + 100);
		expect(later.phase).toBe('breathing');
		expect(later.burst).toBeLessThan(peak.burst);
	});

	it('grows the halo, the eyes and the candles as the ritual builds', () => {
		const early = finaleStage(500);
		const late = finaleStage(LINE_MS * CAT_COUNT + BURST_MS);
		expect(late.halo).toBeGreaterThan(early.halo);
		expect(late.halo).toBeCloseTo(1);
		expect(late.eyes).toBeCloseTo(1);
		expect(late.candles).toBe(1);
	});

	it('keeps breathing forever, with a slow pulse between dim and bright', () => {
		const start = LINE_MS * CAT_COUNT + BURST_MS;
		const samples = Array.from(
			{ length: 40 },
			(_, i) => finaleStage(start + 60000 + (i * BREATH_MS) / 40).breath
		);
		expect(Math.min(...samples)).toBeLessThan(0.1);
		expect(Math.max(...samples)).toBeGreaterThan(0.9);
		expect(finaleStage(start + 10 * BREATH_MS).breath).toBeCloseTo(finaleStage(start).breath);
	});

	it('shows a steady glow instead of a pulse when motion is reduced', () => {
		const start = LINE_MS * CAT_COUNT + BURST_MS;
		const breaths = Array.from(
			{ length: 20 },
			(_, i) => finaleStage(start + (i * BREATH_MS) / 20, true).breath
		);
		expect(new Set(breaths).size).toBe(1);
		expect(finaleStage(start + 1000, true).burst).toBeLessThan(1);
	});

	it('shows the banner only after the burst', () => {
		expect(finaleStage(BANNER_DELAY_MS - 1).banner).toBe(0);
		expect(finaleStage(BANNER_DELAY_MS + 10000).banner).toBe(1);
	});

	it('treats a negative time as the start', () => {
		expect(finaleStage(-500)).toEqual(finaleStage(0));
	});
});

describe('ritualScore', () => {
	it('is worth more for hearts and speed, and less for mistakes', () => {
		const base = { mistakes: 0, hearts: 5, elapsedMs: 60000 };
		expect(ritualScore({ ...base, hearts: 15 })).toBeGreaterThan(ritualScore(base));
		expect(ritualScore({ ...base, elapsedMs: 20000 })).toBeGreaterThan(ritualScore(base));
		expect(ritualScore({ ...base, mistakes: 2 })).toBeLessThan(ritualScore(base));
	});

	it('never falls to zero, so a finished ritual always scores', () => {
		expect(ritualScore({ mistakes: 9, hearts: 0, elapsedMs: 9_999_000 })).toBeGreaterThan(0);
	});

	it('turns happiness into zero to three hearts', () => {
		expect(catHearts(0)).toBe(0);
		expect(catHearts(0.33)).toBe(0);
		expect(catHearts(0.34)).toBe(1);
		expect(catHearts(0.67)).toBe(2);
		expect(catHearts(1)).toBe(MAX_HEARTS);
		expect(catHearts(5)).toBe(MAX_HEARTS);
		expect(catHearts(-1)).toBe(0);
	});
});

describe('finaleScore', () => {
	const notes = finaleScore();

	it('is a loop of 20 to 30 seconds', () => {
		expect(LOOP_SECONDS).toBe(BAR_SECONDS * BARS);
		expect(LOOP_SECONDS).toBeGreaterThanOrEqual(20);
		expect(LOOP_SECONDS).toBeLessThanOrEqual(30);
	});

	it('has a low drone, an organ, a lead line and a choir', () => {
		for (const voice of ['drone', 'organ', 'lead', 'choir'] as const) {
			expect(
				notes.some((note) => note.voice === voice),
				voice
			).toBe(true);
		}
		expect(
			Math.min(...notes.filter((n) => n.voice === 'drone').map((n) => n.frequency))
		).toBeLessThan(60);
	});

	it('starts every note inside the loop, in time order', () => {
		for (const note of notes) {
			expect(note.time).toBeGreaterThanOrEqual(0);
			expect(note.time).toBeLessThan(LOOP_SECONDS);
			expect(note.level).toBeGreaterThan(0);
			expect(note.level).toBeLessThanOrEqual(1);
		}
		expect(notes.map((n) => n.time)).toEqual([...notes.map((n) => n.time)].sort((a, b) => a - b));
	});

	it('stays in D minor, borrowing the raised seventh for the A chord', () => {
		for (const note of notes) {
			expect(D_MINOR_PITCHES, `${note.voice} ${note.frequency}`).toContain(
				pitchClass(note.frequency)
			);
		}
		expect(notes.some((n) => pitchClass(n.frequency) === 1)).toBe(true);
	});

	it('swells the choir towards the end of the loop', () => {
		const choir = notes.filter((n) => n.voice === 'choir');
		const first = choir.filter((n) => n.time < LOOP_SECONDS / 2);
		const last = choir.filter((n) => n.time >= LOOP_SECONDS - BAR_SECONDS);
		expect(Math.max(...last.map((n) => n.level))).toBeGreaterThan(
			Math.max(...first.map((n) => n.level))
		);
	});

	it('ends on the chord it begins with, so the loop has no seam', () => {
		const at = (time: number) =>
			notes
				.filter((n) => n.voice === 'organ' && n.time === time)
				.map((n) => n.frequency)
				.sort();
		expect(at(LOOP_SECONDS - BAR_SECONDS)).toEqual(at(0));
	});
});

describe('noteFrequency', () => {
	it('knows concert pitch and the octaves around it', () => {
		expect(noteFrequency('A4')).toBeCloseTo(440);
		expect(noteFrequency('A3')).toBeCloseTo(220);
		expect(noteFrequency('D2')).toBeCloseTo(73.42, 1);
		expect(noteFrequency('Bb1')).toBeCloseTo(58.27, 1);
		expect(noteFrequency('C#4')).toBeCloseTo(277.18, 1);
	});

	it('rejects something that is not a note', () => {
		expect(() => noteFrequency('H4')).toThrow();
	});
});
