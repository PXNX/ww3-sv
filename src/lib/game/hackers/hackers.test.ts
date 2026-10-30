import { describe, expect, it } from 'vitest';
import { createRandom } from '#lib/game/random.js';
import { isDark, makePanel, pressRelay } from './breaker';
import {
	GLYPHS,
	STARTING_LIVES,
	TRACE_AFTER_TRACED,
	TRACE_HONEYPOT,
	TRACE_MAX,
	TRACE_MISSED_KEY,
	TRACE_WRONG_GUESS,
	contractSpec
} from './config';
import { captureLetter, createKeylog, neededLetter, stepKeylog } from './keylog';
import { scoreGuess } from './mastermind';
import {
	attemptsLeft,
	createGame,
	flipRelay,
	step,
	submitGuess,
	tapChip,
	typeLetter,
	type HackersState
} from './state';

const random = createRandom(42);

/** A state already at a stage, with a known code and passphrase */
function atStage(stage: 'breach' | 'keylog' | 'breaker', n = 1): HackersState {
	const state = createGame(createRandom(1));
	if (n > 1) {
		state.number = n;
		state.contract = { ...state.contract, n, spec: contractSpec(n) };
	}
	state.contract.code = [0, 1, 2, 3].concat(contractSpec(n).codeLength === 5 ? [4] : []);
	state.contract.stage = stage;
	state.contract.keylog.passphrase = 'abcd'.padEnd(contractSpec(n).passphraseLength, 'e');
	if (stage === 'breaker')
		state.contract.panel = makePanel(createRandom(3), contractSpec(n).panel, 3);
	return state;
}

describe('scoreGuess', () => {
	it('marks hits, near misses and misses', () => {
		expect(scoreGuess([0, 1, 2, 3], [0, 1, 2, 3])).toEqual(['hit', 'hit', 'hit', 'hit']);
		expect(scoreGuess([3, 2, 1, 0], [0, 1, 2, 3])).toEqual(['near', 'near', 'near', 'near']);
		expect(scoreGuess([4, 5, 6, 7], [0, 1, 2, 3])).toEqual(['miss', 'miss', 'miss', 'miss']);
	});

	it('counts each glyph of the code once', () => {
		// Code has one 1, and the hit in slot 2 already uses it up
		expect(scoreGuess([1, 1, 4, 4], [0, 1, 2, 3])).toEqual(['miss', 'hit', 'miss', 'miss']);
		expect(scoreGuess([1, 0, 1, 4], [0, 1, 2, 3])).toEqual(['near', 'near', 'miss', 'miss']);
		// A hit uses up the glyph before a near miss can
		expect(scoreGuess([2, 2, 0, 0], [0, 2, 2, 3])).toEqual(['near', 'hit', 'near', 'miss']);
	});
});

describe('relay panel', () => {
	it('flips a relay and its neighbours, only inside the panel', () => {
		const dark = Array.from({ length: 9 }, () => false);
		expect(pressRelay(dark, 3, 4).filter(Boolean)).toHaveLength(5);
		expect(pressRelay(dark, 3, 0).filter(Boolean)).toHaveLength(3);
		expect(pressRelay(dark, 3, 8).filter(Boolean)).toHaveLength(3);
		// Pressing twice undoes it
		expect(isDark(pressRelay(pressRelay(dark, 3, 5), 3, 5))).toBe(true);
	});

	it('always scrambles into a solvable, not-yet-dark panel', () => {
		for (let seed = 0; seed < 40; seed++) {
			for (const size of [3, 4, 5]) {
				const presses = size === 3 ? 4 : 6;
				const rng = createRandom(seed);
				const panel = makePanel(rng, size, presses);
				expect(panel).toHaveLength(size * size);
				expect(isDark(panel)).toBe(false);
			}
		}
	});

	it('can be solved by repeating the scrambling presses', () => {
		const rng = createRandom(9);
		const before = createRandom(9);
		// Replay the choice of presses the generator made
		const panel = makePanel(rng, 3, 3);
		const chosen = new Set<number>();
		while (chosen.size < 3) chosen.add(Math.floor(before() * 9));
		let lights = panel;
		for (const index of chosen) lights = pressRelay(lights, 3, index);
		expect(isDark(lights)).toBe(true);
	});
});

describe('contract difficulty', () => {
	it('grows with the contract number and stays in bounds', () => {
		const first = contractSpec(1);
		const late = contractSpec(40);
		expect(first.symbols).toBeLessThan(late.symbols);
		expect(late.symbols).toBeLessThanOrEqual(GLYPHS.length);
		expect(first.codeLength).toBe(4);
		expect(late.codeLength).toBe(5);
		expect(late.chipMs).toBe(2600);
		expect(late.spawnMs).toBe(520);
		expect(first.panel).toBe(3);
		expect(late.panel).toBe(5);
		expect(late.passphraseLength).toBe(8);
		expect(late.creep.breach).toBeGreaterThan(first.creep.breach);
	});
});

describe('breach', () => {
	it('cracks the code, pays for attempts left and moves on to the keylogger', () => {
		const state = atStage('breach');
		const events = submitGuess(state, [0, 1, 2, 3], random);
		expect(events.map((event) => event.type)).toEqual(['guess', 'cracked']);
		expect(state.contract.stage).toBe('keylog');
		expect(state.score).toBe(50 + 20 * 7);
		expect(state.trace).toBe(0);
	});

	it('adds trace for a wrong guess and keeps count of attempts', () => {
		const state = atStage('breach');
		submitGuess(state, [3, 2, 1, 0], random);
		expect(state.trace).toBe(TRACE_WRONG_GUESS);
		expect(attemptsLeft(state.contract)).toBe(contractSpec(1).maxAttempts - 1);
		expect(state.contract.stage).toBe('breach');
	});

	it('ignores an incomplete or invalid guess', () => {
		const state = atStage('breach');
		expect(submitGuess(state, [0, 1, 2], random)).toEqual([]);
		expect(submitGuess(state, [0, 1, 2, 99], random)).toEqual([]);
		expect(state.contract.guesses).toHaveLength(0);
	});

	it('rotates the code when the attempts run out', () => {
		const state = atStage('breach');
		const max = contractSpec(1).maxAttempts;
		const events = [];
		for (let i = 0; i < max; i++) events.push(...submitGuess(state, [3, 3, 3, 3], random));
		expect(events.some((event) => event.type === 'rotated')).toBe(true);
		expect(state.contract.guesses).toHaveLength(0);
		expect(state.trace).toBeGreaterThan(TRACE_WRONG_GUESS * max);
	});

	it('ignores guesses at the wrong stage', () => {
		const state = atStage('keylog');
		expect(submitGuess(state, [0, 1, 2, 3], random)).toEqual([]);
	});
});

describe('keylogger', () => {
	it('captures the passphrase in order and then opens the relay stage', () => {
		const state = atStage('keylog');
		const events = [];
		for (const letter of 'abcd') {
			const keylog = state.contract.keylog;
			keylog.chips = [{ id: 100, letter, real: true, lane: 0, x: 0.4 }];
			events.push(...tapChip(state, 100, random));
		}
		expect(
			events.filter((event) => event.type === 'key').map((e) => (e as { letter: string }).letter)
		).toEqual(['a', 'b', 'c', 'd']);
		expect(events.at(-1)).toMatchObject({ type: 'keys-done', points: 80 });
		expect(state.contract.stage).toBe('breaker');
		expect(state.contract.panel).toHaveLength(9);
		expect(state.score).toBe(80);
	});

	it('charges trace for tapping a honeypot and docks the payout', () => {
		const state = atStage('keylog');
		state.contract.keylog.chips = [{ id: 1, letter: 'z', real: false, lane: 1, x: 0.3 }];
		const events = tapChip(state, 1, random);
		expect(events[0]).toEqual({ type: 'honeypot' });
		expect(state.trace).toBe(TRACE_HONEYPOT);
		expect(state.contract.keylog.mistakes).toBe(1);
		expect(state.contract.keylog.chips).toHaveLength(0);
	});

	it('takes typed letters and ignores letters that are not on screen', () => {
		const state = atStage('keylog');
		state.contract.keylog.chips = [
			{ id: 1, letter: 'a', real: true, lane: 0, x: 0.3 },
			{ id: 2, letter: 'q', real: false, lane: 2, x: 0.3 }
		];
		expect(typeLetter(state, 'x', random)).toEqual([]);
		expect(typeLetter(state, 'A', random)[0]).toMatchObject({ type: 'key', letter: 'a' });
		expect(typeLetter(state, 'q', random)[0]).toEqual({ type: 'honeypot' });
		expect(state.contract.keylog.captured).toBe(1);
	});

	it('charges trace when a real keystroke gets away', () => {
		const state = atStage('keylog');
		state.contract.keylog.chips = [{ id: 1, letter: 'a', real: true, lane: 0, x: 0.99 }];
		state.contract.keylog.spawnMs = 1e9;
		const before = state.trace;
		const events = step(state, 200, random);
		expect(events.some((event) => event.type === 'missed')).toBe(true);
		expect(state.trace).toBeGreaterThanOrEqual(before + TRACE_MISSED_KEY);
		expect(state.contract.keylog.chips).toHaveLength(0);
	});

	it('streams a real keystroke soon and never shows one letter twice', () => {
		const rng = createRandom(5);
		const keylog = createKeylog(rng, 6);
		let sawReal = false;
		for (let t = 0; t < 20000; t += 20) {
			stepKeylog(keylog, 20, rng, 3000, 700);
			const letters = keylog.chips.map((chip) => chip.letter);
			expect(new Set(letters).size).toBe(letters.length);
			// Only one real chip at a time, and it carries the letter the passphrase needs
			const real = keylog.chips.filter((chip) => chip.real);
			expect(real.length).toBeLessThanOrEqual(1);
			if (real[0]) {
				sawReal = true;
				expect(real[0].letter).toBe(neededLetter(keylog));
			}
		}
		expect(sawReal).toBe(true);
		expect(keylog.chips.every((chip) => chip.lane >= 0 && chip.lane < 4)).toBe(true);
	});

	it('gives a letter nothing when the chip is gone', () => {
		const keylog = createKeylog(random, 4);
		expect(captureLetter(keylog, 'a')).toEqual({ events: [], trace: 0 });
	});
});

describe('relays and contracts', () => {
	it('finishes the contract when the panel goes dark and starts the next, harder one', () => {
		const state = atStage('breaker');
		state.trace = 60;
		// Pressing the scrambling presses again is not known here, so force a one-press panel
		state.contract.panel = pressRelay(
			Array.from({ length: 9 }, () => false),
			3,
			4
		);
		const events = flipRelay(state, 4, random);
		expect(events.map((event) => event.type)).toEqual(['relay', 'contract-done', 'contract']);
		expect(state.completed).toBe(1);
		expect(state.number).toBe(2);
		expect(state.contract.n).toBe(2);
		expect(state.contract.stage).toBe('breach');
		expect(state.trace).toBe(35);
		// 100 + 10 * n + 10 * (par + 4 - moves): par 3, one move
		expect(state.score).toBe(100 + 10 + 10 * (contractSpec(1).presses + 4 - 1));
	});

	it('keeps playing while relays are still lit', () => {
		const state = atStage('breaker');
		state.contract.panel = makePanel(createRandom(8), 3, 4);
		const events = flipRelay(state, 0, random);
		expect(events.map((event) => event.type)).toEqual(['relay']);
		expect(state.contract.moves).toBe(1);
	});

	it('ignores relays outside the relay stage or the panel', () => {
		const breach = atStage('breach');
		expect(flipRelay(breach, 0, random)).toEqual([]);
		const state = atStage('breaker');
		expect(flipRelay(state, 99, random)).toEqual([]);
		expect(flipRelay(state, -1, random)).toEqual([]);
	});
});

describe('trace', () => {
	it('creeps up on its own, faster in the breach and relay stages than in the keylogger', () => {
		const breach = atStage('breach');
		for (let t = 0; t < 10000; t += 100) step(breach, 100, random);
		const breaker = atStage('breaker');
		for (let t = 0; t < 10000; t += 100) step(breaker, 100, random);
		expect(breach.trace).toBeGreaterThan(5);
		expect(breaker.trace).toBeGreaterThan(breach.trace);
	});

	it('costs a heart and the contract when it fills, then starts the same number again', () => {
		const state = atStage('breach');
		state.trace = TRACE_MAX - 0.01;
		const code = state.contract.code;
		const events = step(state, 1000, random);
		expect(events.map((event) => event.type)).toEqual(['traced', 'contract']);
		expect(state.lives).toBe(STARTING_LIVES - 1);
		expect(state.trace).toBe(TRACE_AFTER_TRACED);
		expect(state.number).toBe(1);
		expect(state.contract.code).not.toBe(code);
		expect(state.contract.stage).toBe('breach');
	});

	it('ends the run on the third trace-out and then stops', () => {
		const state = atStage('breach');
		const all = [];
		for (let i = 0; i < STARTING_LIVES; i++) {
			state.trace = TRACE_MAX - 0.01;
			all.push(...step(state, 1000, random));
		}
		expect(state.over).toBe(true);
		expect(state.lives).toBe(0);
		expect(all.filter((event) => event.type === 'game-over')).toHaveLength(1);
		expect(step(state, 1000, random)).toEqual([]);
		expect(submitGuess(state, [0, 1, 2, 3], random)).toEqual([]);
	});

	it('a mistake that fills the meter also costs the heart', () => {
		const state = atStage('breach');
		state.trace = TRACE_MAX - 1;
		const events = submitGuess(state, [3, 3, 3, 3], random);
		expect(events.map((event) => event.type)).toContain('traced');
		expect(state.lives).toBe(STARTING_LIVES - 1);
	});
});
