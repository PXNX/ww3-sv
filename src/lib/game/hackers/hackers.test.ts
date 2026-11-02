import { describe, expect, it } from 'vitest';
import { createRandom } from '#lib/game/random.js';
import { isDark, makePanel, pressRelay } from './breaker';
import {
	GLYPHS,
	STARTING_LIVES,
	TARGETS,
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
	buyUpgrade,
	createGame,
	flipRelay,
	step,
	submitGuess,
	tapChip,
	typeLetter,
	type HackersState
} from './state';
import {
	minerIncome,
	SIPHON_DAY_MS,
	siphonShare,
	toolSpec,
	upgradeCost,
	walletFor,
	emptyUpgrades
} from './software';
import {
	HARDWARE_SPECS,
	emptyHardware,
	hardwareCost,
	hardwareEffects,
	hardwareSpec,
	isHardware
} from './hardware';

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

describe('software shop', () => {
	function rich(stage: 'breach' | 'keylog' | 'breaker' = 'breach'): HackersState {
		const state = atStage(stage);
		state.score = 100_000;
		return state;
	}

	it('charges more for every level and stops at the maximum', () => {
		expect(upgradeCost('breach', 0)).toBe(60);
		expect(upgradeCost('breach', 1)!).toBeGreaterThan(upgradeCost('breach', 0)!);
		expect(upgradeCost('breach', toolSpec('breach').maxLevel)).toBeNull();
		expect(upgradeCost('miner', toolSpec('miner').maxLevel)).toBeNull();
	});

	it('spends DogeLite and raises the level', () => {
		const state = rich();
		const events = buyUpgrade(state, 'breach');
		expect(events).toEqual([{ type: 'upgrade', tool: 'breach', level: 1, cost: 60 }]);
		expect(state.upgrades.breach).toBe(1);
		expect(state.score).toBe(100_000 - 60);
	});

	it('refuses to buy what the bank cannot pay for or what is maxed', () => {
		const poor = createGame(createRandom(1));
		expect(buyUpgrade(poor, 'miner')).toEqual([]);
		expect(poor.upgrades.miner).toBe(0);

		const state = rich();
		for (let level = 0; level < toolSpec('relays').maxLevel; level++) {
			expect(buyUpgrade(state, 'relays')).toHaveLength(1);
		}
		expect(buyUpgrade(state, 'relays')).toEqual([]);
		expect(state.upgrades.relays).toBe(toolSpec('relays').maxLevel);
	});

	it('gives the breach suite an extra attempt and softer wrong guesses', () => {
		const state = rich();
		buyUpgrade(state, 'breach');
		expect(attemptsLeft(state.contract)).toBe(contractSpec(1).maxAttempts + 1);

		submitGuess(state, [7, 7, 7, 7], random);
		expect(state.trace).toBeGreaterThan(0);
		expect(state.trace).toBeLessThan(TRACE_WRONG_GUESS);
	});

	it('slows the keystroke stream and the alarm trace with a keylogger and a relay breaker', () => {
		const state = rich();
		const base = contractSpec(1);
		buyUpgrade(state, 'keylog');
		buyUpgrade(state, 'relays');
		expect(state.contract.spec.chipMs).toBeGreaterThan(base.chipMs);
		expect(state.contract.spec.spawnMs).toBeGreaterThan(base.spawnMs);
		expect(state.contract.spec.creep.breaker).toBeLessThan(base.creep.breaker);
	});

	it('pays the miner on the player\u2019s own machine every second', () => {
		const state = rich();
		buyUpgrade(state, 'miner');
		const before = state.score;
		step(state, 1000, random);
		expect(state.score).toBe(before + minerIncome(state.upgrades));
	});
});

describe('wallet siphon', () => {
	function siphoned(stage: 'breach' | 'keylog' | 'breaker'): HackersState {
		const state = atStage(stage);
		state.score = 100_000;
		// No keystrokes on screen, so a long step cannot fill the trace and end the contract
		state.contract.keylog.chips = [];
		state.contract.keylog.spawnMs = Number.MAX_SAFE_INTEGER;
		buyUpgrade(state, 'siphon');
		return state;
	}

	it('needs access: it drains nothing before the access code is cracked', () => {
		const state = siphoned('breach');
		const before = state.score;
		const wallet = state.contract.wallet;
		step(state, SIPHON_DAY_MS * 2, random);
		expect(state.contract.wallet).toBe(wallet);
		expect(state.score).toBe(before);
	});

	it('drains a share of the target\u2019s wallet once a day', () => {
		const state = siphoned('keylog');
		const before = state.score;
		const wallet = state.contract.wallet;
		step(state, SIPHON_DAY_MS - 1, random);
		expect(state.contract.wallet).toBe(wallet);

		const events = step(state, 1, random);
		const paid = events.find((event) => event.type === 'siphon');
		expect(paid).toBeDefined();
		expect(state.contract.wallet).toBe(wallet - Math.max(1, Math.round(wallet * siphonShare(state.upgrades))));
		expect(state.score).toBeGreaterThan(before);
		expect(state.siphoned).toBeGreaterThan(0);
	});

	it('never takes more than the wallet holds and stops when it is empty', () => {
		const state = siphoned('breaker');
		state.contract.wallet = 1;
		step(state, SIPHON_DAY_MS, random);
		expect(state.contract.wallet).toBe(0);
		const before = state.score;
		step(state, SIPHON_DAY_MS * 2, random);
		expect(state.contract.wallet).toBe(0);
		expect(state.score).toBe(before);
	});

	it('starts the next target with a fresh wallet', () => {
		const state = siphoned('breaker');
		state.contract.panel = pressRelay(
			Array.from({ length: 9 }, () => false),
			3,
			4
		);
		flipRelay(state, 4, random);
		expect(state.contract.wallet).toBe(walletFor(2));
	});
});

describe('own hardware', () => {
	it('charges more for every level and stops at the maximum', () => {
		expect(hardwareCost('cpu', 0)).toBe(150);
		expect(hardwareCost('cpu', 1)!).toBeGreaterThan(hardwareCost('cpu', 0)!);
		expect(hardwareCost('gpu', hardwareSpec('gpu').maxLevel)).toBeNull();
		expect(HARDWARE_SPECS.map((spec) => spec.id)).toEqual(['cpu', 'ram', 'gpu']);
	});

	it('turns levels into mining, trace and siphon multipliers', () => {
		expect(hardwareEffects(emptyHardware())).toEqual({
			minerMultiplier: 1,
			creepMultiplier: 1,
			siphonBonus: 0
		});
		const effects = hardwareEffects({ cpu: 2, ram: 3, gpu: 2 });
		expect(effects.minerMultiplier).toBeCloseTo(1.5);
		expect(effects.creepMultiplier).toBeCloseTo(0.96 ** 3);
		expect(effects.siphonBonus).toBeCloseTo(0.1);
	});

	it('guards what comes out of local storage', () => {
		expect(isHardware({ cpu: 5, ram: 0, gpu: 5 })).toBe(true);
		expect(isHardware({ cpu: 6, ram: 0, gpu: 0 })).toBe(false);
		expect(isHardware({ cpu: 1.5, ram: 0, gpu: 0 })).toBe(false);
		expect(isHardware({ cpu: 1, ram: -1, gpu: 0 })).toBe(false);
		expect(isHardware(null)).toBe(false);
	});

	it('makes the miner pay more with a better CPU', () => {
		const hardware = { cpu: 2, ram: 0, gpu: 0 };
		const state = createGame(createRandom(5), { hardware });
		state.score = 100_000;
		buyUpgrade(state, 'miner');
		expect(minerIncome(state.upgrades, hardware)).toBe(
			minerIncome(state.upgrades, emptyHardware()) * 1.5
		);
		const before = state.score;
		step(state, 2000, random);
		expect(state.score).toBe(before + Math.floor(minerIncome(state.upgrades, hardware) * 2));
	});

	it('leaves more room before the trace fills with more RAM', () => {
		const base = contractSpec(1).creep;
		const state = createGame(createRandom(5), { hardware: { cpu: 0, ram: 2, gpu: 0 } });
		expect(state.contract.spec.creep.breach).toBeCloseTo(base.breach * 0.96 ** 2);
		expect(state.contract.spec.creep.keylog).toBeCloseTo(base.keylog * 0.96 ** 2);
		expect(state.contract.spec.creep.breaker).toBeCloseTo(base.breaker * 0.96 ** 2);
	});

	it('lets a better GPU take a bigger share of the wallet', () => {
		const upgrades = { ...emptyUpgrades(), siphon: 1 };
		const plain = siphonShare(upgrades);
		const boosted = siphonShare(upgrades, { cpu: 0, ram: 0, gpu: 2 });
		expect(boosted).toBeCloseTo(plain + 0.1);
	});
});

describe('target list', () => {
	/** A dark panel that one press on the middle relay can finish */
	function freshPanel(): boolean[] {
		return pressRelay(
			Array.from({ length: 9 }, () => false),
			3,
			4
		);
	}

	it('starts on the target chosen in the terminal', () => {
		const state = createGame(createRandom(7), { targetIndex: 2 });
		expect(state.contract.ip).toBe(TARGETS[2].ip);
		expect(state.contract.system).toBe(TARGETS[2].system);
		expect(state.targetIndex).toBe(2);
	});

	it('moves on to the next listed target when a contract is finished', () => {
		const state = createGame(createRandom(7), { targetIndex: 2 });
		state.contract.stage = 'breaker';
		state.contract.panel = freshPanel();
		flipRelay(state, 4, random);
		expect(state.completed).toBe(1);
		expect(state.targetIndex).toBe(3);
		expect(state.contract.ip).toBe(TARGETS[3].ip);
	});

	it('wraps around the list and keeps the target after a trace-out', () => {
		const last = createGame(createRandom(7), { targetIndex: TARGETS.length - 1 });
		last.contract.stage = 'breaker';
		last.contract.panel = freshPanel();
		flipRelay(last, 4, random);
		expect(last.targetIndex).toBe(0);
		expect(last.contract.ip).toBe(TARGETS[0].ip);

		const traced = createGame(createRandom(7), { targetIndex: 1 });
		step(traced, 500_000, random);
		expect(traced.lives).toBe(STARTING_LIVES - 1);
		expect(traced.targetIndex).toBe(1);
		expect(traced.contract.ip).toBe(TARGETS[1].ip);
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
