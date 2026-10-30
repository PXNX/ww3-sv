/*
 * The keylogger stage: the admin is typing, and the keystrokes stream across the screen. Tap the
 * green ones (the next key of the passphrase) and leave the red honeypots alone. Every letter on
 * screen is different, so a keyboard works too: type the letter of the green chip.
 */
import { LANES, PASSPHRASE_LETTERS, TRACE_HONEYPOT, TRACE_MISSED_KEY } from './config';
import { randomInt, shuffle, type Random } from '#lib/game/random.js';

export interface Chip {
	id: number;
	letter: string;
	/** A real keystroke (green) or a honeypot (red) */
	real: boolean;
	lane: number;
	/** 0 at the admin's side, 1 when it leaves the stream */
	x: number;
}

export interface Keylog {
	passphrase: string;
	captured: number;
	chips: Chip[];
	spawnMs: number;
	nextId: number;
	/** Honeypots in a row since the last real keystroke, so a real one is never long in coming */
	decoyStreak: number;
	mistakes: number;
}

export type KeylogEvent =
	| { type: 'key'; letter: string; index: number }
	| { type: 'honeypot' }
	| { type: 'missed' }
	| { type: 'done' };

export interface KeylogResult {
	events: KeylogEvent[];
	/** Trace to add */
	trace: number;
}

export function makePassphrase(random: Random, length: number): string {
	return shuffle(random, [...PASSPHRASE_LETTERS])
		.slice(0, length)
		.join('');
}

export function createKeylog(random: Random, passphraseLength: number): Keylog {
	return {
		passphrase: makePassphrase(random, passphraseLength),
		captured: 0,
		chips: [],
		spawnMs: 500,
		nextId: 1,
		decoyStreak: 0,
		mistakes: 0
	};
}

export function neededLetter(keylog: Keylog): string | null {
	return keylog.passphrase[keylog.captured] ?? null;
}

function spawn(keylog: Keylog, random: Random) {
	const needed = neededLetter(keylog);
	if (needed === null) return;
	const realOnScreen = keylog.chips.some((chip) => chip.real);
	const wantReal = !realOnScreen && random() < Math.min(1, 0.4 + keylog.decoyStreak * 0.25);

	const onScreen = new Set(keylog.chips.map((chip) => chip.letter));
	let letter = needed;
	if (!wantReal) {
		// Honeypots may use later letters of the passphrase: typing blind is a gamble
		const pool = [...PASSPHRASE_LETTERS].filter((l) => l !== needed && !onScreen.has(l));
		letter = pool[randomInt(random, 0, pool.length)];
	}

	// Keep the new chip out of the lane of one that has only just entered
	const busy = new Set(keylog.chips.filter((chip) => chip.x < 0.22).map((chip) => chip.lane));
	const free = Array.from({ length: LANES }, (_, lane) => lane).filter((lane) => !busy.has(lane));
	const lanes = free.length > 0 ? free : Array.from({ length: LANES }, (_, lane) => lane);
	keylog.chips.push({
		id: keylog.nextId++,
		letter,
		real: wantReal,
		lane: lanes[randomInt(random, 0, lanes.length)],
		x: 0
	});
	keylog.decoyStreak = wantReal ? 0 : keylog.decoyStreak + 1;
}

/** Moves the chips and adds new ones; a real keystroke that gets away costs trace */
export function stepKeylog(
	keylog: Keylog,
	dtMs: number,
	random: Random,
	chipMs: number,
	spawnMs: number
): KeylogResult {
	const events: KeylogEvent[] = [];
	let trace = 0;
	// Honeypots are a little quicker, so they are gone before they pile up
	for (const chip of keylog.chips) chip.x += (dtMs / chipMs) * (chip.real ? 1 : 1.12);
	const kept: Chip[] = [];
	for (const chip of keylog.chips) {
		if (chip.x < 1) kept.push(chip);
		else if (chip.real) {
			trace += TRACE_MISSED_KEY;
			events.push({ type: 'missed' });
		}
	}
	keylog.chips = kept;

	keylog.spawnMs -= dtMs;
	if (keylog.spawnMs <= 0) {
		spawn(keylog, random);
		keylog.spawnMs += spawnMs * (0.75 + random() * 0.5);
	}
	return { events, trace };
}

/** The player taps (or types) a chip */
export function captureChip(keylog: Keylog, chipId: number): KeylogResult {
	const chip = keylog.chips.find((candidate) => candidate.id === chipId);
	if (!chip) return { events: [], trace: 0 };
	keylog.chips = keylog.chips.filter((candidate) => candidate.id !== chipId);
	if (!chip.real) {
		keylog.mistakes += 1;
		return { events: [{ type: 'honeypot' }], trace: TRACE_HONEYPOT };
	}
	const index = keylog.captured;
	keylog.captured += 1;
	const events: KeylogEvent[] = [{ type: 'key', letter: chip.letter, index }];
	if (keylog.captured >= keylog.passphrase.length) {
		keylog.chips = [];
		events.push({ type: 'done' });
	}
	return { events, trace: 0 };
}

/** The player types a letter: it counts if a chip with that letter is on screen */
export function captureLetter(keylog: Keylog, letter: string): KeylogResult {
	const chip = keylog.chips.find((candidate) => candidate.letter === letter.toLowerCase());
	return chip ? captureChip(keylog, chip.id) : { events: [], trace: 0 };
}
