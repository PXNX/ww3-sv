/*
 * The finale music as data: a dark loop of organ, choir and a low drone in D minor, written as a
 * list of notes so it can be tested and played by any synth. 8 bars of 3 seconds, 24 seconds in
 * all, and it loops without a seam because the last bar resolves onto the chord the first one
 * starts on.
 */

export type MusicVoice = 'drone' | 'organ' | 'lead' | 'choir';

export interface MusicNote {
	voice: MusicVoice;
	/** Seconds from the start of the loop */
	time: number;
	/** Seconds the note is held */
	duration: number;
	/** Hz */
	frequency: number;
	/** 0 to 1 */
	level: number;
}

export const BAR_SECONDS = 3;
export const BARS = 8;
export const LOOP_SECONDS = BAR_SECONDS * BARS;

/** The pitches the whole piece stays inside: D natural minor, plus the raised seventh (C#) that the A chord borrows */
export const D_MINOR_PITCHES = [2, 4, 5, 7, 9, 10, 0, 1] as const;

const NOTE_OFFSET: Record<string, number> = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };

/** Frequency of a note such as 'D3' or 'C#4' (A4 = 440 Hz) */
export function noteFrequency(name: string): number {
	const [, letter, accidental, octave] = /^([A-G])([#b]?)(\d)$/.exec(name) ?? [];
	if (!letter) throw new Error(`not a note: ${name}`);
	const semitones =
		NOTE_OFFSET[letter] +
		(accidental === '#' ? 1 : accidental === 'b' ? -1 : 0) +
		(Number(octave) - 4) * 12;
	return 440 * Math.pow(2, semitones / 12);
}

/** Pitch class (0 to 11) of a frequency, to check which scale a note belongs to */
export function pitchClass(frequency: number): number {
	const semitones = Math.round(12 * Math.log2(frequency / 440));
	return (((semitones + 9) % 12) + 12) % 12;
}

interface Chord {
	root: string;
	/** Organ and choir chord tones, low to high */
	tones: readonly string[];
	/** Notes the organ lead plays over the bar, one per beat pair */
	melody: readonly string[];
}

const PROGRESSION: readonly Chord[] = [
	{ root: 'D2', tones: ['D3', 'F3', 'A3', 'D4'], melody: ['A4', 'F4', 'E4', 'D4'] },
	{ root: 'D2', tones: ['D3', 'F3', 'A3', 'D4'], melody: ['F4', 'A4', 'G4', 'F4'] },
	{ root: 'Bb1', tones: ['Bb2', 'D3', 'F3', 'Bb3'], melody: ['D5', 'C5', 'Bb4', 'A4'] },
	{ root: 'A1', tones: ['A2', 'C#3', 'E3', 'A3'], melody: ['E5', 'D5', 'C#5', 'A4'] },
	{ root: 'G1', tones: ['G2', 'Bb2', 'D3', 'G3'], melody: ['D5', 'Bb4', 'A4', 'G4'] },
	{ root: 'D2', tones: ['D3', 'F3', 'A3', 'D4'], melody: ['F4', 'G4', 'A4', 'F4'] },
	{ root: 'A1', tones: ['A2', 'C#3', 'E3', 'A3'], melody: ['E5', 'F5', 'E5', 'C#5'] },
	{ root: 'D2', tones: ['D3', 'F3', 'A3', 'D4'], melody: ['D5', 'A4', 'F4', 'D4'] }
];

/** The whole loop, sorted by time */
export function finaleScore(): MusicNote[] {
	const notes: MusicNote[] = [];
	PROGRESSION.forEach((chord, bar) => {
		const start = bar * BAR_SECONDS;
		// The drone never stops: the root of each bar, held a little into the next
		notes.push({
			voice: 'drone',
			time: start,
			duration: BAR_SECONDS + 0.4,
			frequency: noteFrequency(chord.root),
			level: 0.9
		});
		// The organ holds the chord, a little under the full bar so the notes breathe
		chord.tones.forEach((tone) => {
			notes.push({
				voice: 'organ',
				time: start,
				duration: BAR_SECONDS - 0.15,
				frequency: noteFrequency(tone),
				level: 0.5
			});
		});
		// The minor-key organ line: four notes a bar, each held for most of its beat pair
		chord.melody.forEach((tone, step) => {
			notes.push({
				voice: 'lead',
				time: start + step * (BAR_SECONDS / 4),
				duration: BAR_SECONDS / 4 - 0.08,
				frequency: noteFrequency(tone),
				level: 0.55
			});
		});
		// The choir swells over the second half of the loop, so the piece builds towards the end
		const swell = bar < BARS / 2 ? 0.35 : 0.6 + 0.4 * ((bar - BARS / 2) / (BARS / 2 - 1));
		[chord.tones[1], chord.tones[2], chord.tones[3]].forEach((tone) => {
			notes.push({
				voice: 'choir',
				time: start,
				duration: BAR_SECONDS + 0.5,
				frequency: noteFrequency(tone) * 2,
				level: swell
			});
		});
	});
	return notes.sort((a, b) => a.time - b.time);
}
