/*
 * Hermit Hackers rules, pure and seeded. A run is a string of contracts against made-up banks,
 * each with three stages on a retro terminal:
 *   1. BREACH: crack the access code (Mastermind, marks slot by slot).
 *   2. KEYLOGGER: plant it and capture the admin's passphrase as the keystrokes stream past.
 *   3. RELAYS: with the passphrase in hand, switch off the alarm relays (Lights Out).
 * A trace meter creeps up all the time and jumps on mistakes; full means "Traced!", a heart lost
 * and the contract gone. Three hearts. Everything is fictional and abstract.
 */
import {
	GLYPHS,
	STARTING_LIVES,
	TARGETS,
	TRACE_AFTER_TRACED,
	TRACE_MAX,
	TRACE_RELIEF,
	TRACE_ROTATED,
	type ContractSpec
} from './config';
import {
	emptyUpgrades,
	effectiveSpec,
	minerIncome,
	siphonShare,
	upgradeCost,
	walletFor,
	SIPHON_DAY_MS,
	toolSpec,
	type ToolId,
	type Upgrades,
	wrongGuessTrace
} from './software';
import { isDark, makePanel, pressRelay } from './breaker';
import {
	captureChip,
	captureLetter,
	createKeylog,
	stepKeylog,
	type Keylog,
	type KeylogResult
} from './keylog';
import { makeCode, scoreGuess, type Mark } from './mastermind';
import type { Random } from '#lib/game/random.js';

export type Stage = 'breach' | 'keylog' | 'breaker';

export interface Guess {
	symbols: number[];
	marks: Mark[];
}

export interface Contract {
	n: number;
	ip: string;
	system: string;
	spec: ContractSpec;
	stage: Stage;
	code: number[];
	guesses: Guess[];
	keylog: Keylog;
	panel: boolean[];
	moves: number;
	/** DogeLite still in the target's wallet; the siphon drains a share of it every day */
	wallet: number;
	walletStart: number;
}

export interface HackersState {
	contract: Contract;
	lives: number;
	trace: number;
	score: number;
	/** Contracts finished */
	completed: number;
	/** The number of the contract in play (a trace-out replays the same number) */
	number: number;
	over: boolean;
	timeMs: number;
	/** Software bought in this run */
	upgrades: Upgrades;
	/** Mined DogeLite that has not reached a whole coin yet */
	pendingIncome: number;
	/** Time towards the siphon's next day */
	siphonMs: number;
	/** DogeLite the siphon has drained in this run */
	siphoned: number;
}

export type HackersEvent =
	| { type: 'contract'; n: number; ip: string; system: string }
	| { type: 'guess'; marks: Mark[] }
	| { type: 'cracked'; points: number }
	| { type: 'rotated' }
	| { type: 'key'; letter: string; index: number }
	| { type: 'honeypot' }
	| { type: 'missed' }
	| { type: 'keys-done'; points: number }
	| { type: 'relay' }
	| { type: 'contract-done'; points: number; n: number }
	| { type: 'upgrade'; tool: ToolId; level: number; cost: number }
	| { type: 'siphon'; amount: number; left: number }
	| { type: 'traced' }
	| { type: 'game-over' };

export function newContract(
	n: number,
	random: Random,
	upgrades: Upgrades = emptyUpgrades()
): Contract {
	const spec = effectiveSpec(n, upgrades);
	const target = TARGETS[(n - 1) % TARGETS.length];
	const wallet = walletFor(n);
	return {
		n,
		ip: target.ip,
		system: target.system,
		spec,
		stage: 'breach',
		code: makeCode(random, spec.codeLength, spec.symbols),
		guesses: [],
		keylog: createKeylog(random, spec.passphraseLength),
		panel: [],
		moves: 0,
		wallet,
		walletStart: wallet
	};
}

export function createGame(random: Random): HackersState {
	const upgrades = emptyUpgrades();
	return {
		contract: newContract(1, random, upgrades),
		lives: STARTING_LIVES,
		trace: 0,
		score: 0,
		completed: 0,
		number: 1,
		over: false,
		timeMs: 0,
		upgrades,
		pendingIncome: 0,
		siphonMs: 0,
		siphoned: 0
	};
}

export function attemptsLeft(contract: Contract): number {
	return contract.spec.maxAttempts - contract.guesses.length;
}

/** Adds trace; a full meter ends the contract. Returns the events that follow from it */
function addTrace(state: HackersState, amount: number, random: Random): HackersEvent[] {
	if (state.over || amount <= 0) return [];
	state.trace = Math.min(TRACE_MAX, state.trace + amount);
	if (state.trace < TRACE_MAX) return [];
	state.lives -= 1;
	const events: HackersEvent[] = [{ type: 'traced' }];
	if (state.lives <= 0) {
		state.over = true;
		events.push({ type: 'game-over' });
		return events;
	}
	state.trace = TRACE_AFTER_TRACED;
	state.contract = newContract(state.number, random, state.upgrades);
	events.push(contractEvent(state.contract));
	return events;
}

function contractEvent(contract: Contract): HackersEvent {
	return { type: 'contract', n: contract.n, ip: contract.ip, system: contract.system };
}

/** The first contract's announcement, for the log */
export function openingEvent(state: HackersState): HackersEvent {
	return contractEvent(state.contract);
}

/** Tries an access code. Needs a full code; anything else is ignored */
export function submitGuess(
	state: HackersState,
	symbols: readonly number[],
	random: Random
): HackersEvent[] {
	const contract = state.contract;
	if (state.over || contract.stage !== 'breach') return [];
	if (symbols.length !== contract.spec.codeLength) return [];
	if (symbols.some((symbol) => !Number.isInteger(symbol) || symbol < 0 || symbol >= GLYPHS.length))
		return [];

	const marks = scoreGuess(symbols, contract.code);
	contract.guesses.push({ symbols: [...symbols], marks });
	const events: HackersEvent[] = [{ type: 'guess', marks }];

	if (marks.every((mark) => mark === 'hit')) {
		const points = 50 + 20 * attemptsLeft(contract);
		state.score += points;
		contract.stage = 'keylog';
		events.push({ type: 'cracked', points });
		return events;
	}

	events.push(...addTrace(state, wrongGuessTrace(state.upgrades), random));
	if (state.over || state.contract !== contract) return events;
	if (attemptsLeft(contract) <= 0) {
		// The firewall changes the locks: new code, fresh attempts, and the trace does not forget
		contract.code = makeCode(random, contract.spec.codeLength, contract.spec.symbols);
		contract.guesses = [];
		events.push({ type: 'rotated' });
		events.push(...addTrace(state, TRACE_ROTATED, random));
	}
	return events;
}

function afterKeylog(state: HackersState, result: KeylogResult, random: Random): HackersEvent[] {
	const events: HackersEvent[] = [];
	const contract = state.contract;
	for (const event of result.events) {
		if (event.type === 'done') {
			const points = Math.max(
				0,
				20 * contract.keylog.passphrase.length - 10 * contract.keylog.mistakes
			);
			state.score += points;
			contract.stage = 'breaker';
			contract.panel = makePanel(random, contract.spec.panel, contract.spec.presses);
			events.push({ type: 'keys-done', points });
		} else {
			events.push(event);
		}
	}
	events.push(...addTrace(state, result.trace, random));
	return events;
}

/** The player taps a chip of the keystroke stream */
export function tapChip(state: HackersState, chipId: number, random: Random): HackersEvent[] {
	if (state.over || state.contract.stage !== 'keylog') return [];
	return afterKeylog(state, captureChip(state.contract.keylog, chipId), random);
}

/** The player types a letter on a keyboard */
export function typeLetter(state: HackersState, letter: string, random: Random): HackersEvent[] {
	if (state.over || state.contract.stage !== 'keylog') return [];
	return afterKeylog(state, captureLetter(state.contract.keylog, letter), random);
}

/** Flips a relay and its neighbours; a dark panel finishes the contract */
export function flipRelay(state: HackersState, index: number, random: Random): HackersEvent[] {
	const contract = state.contract;
	if (state.over || contract.stage !== 'breaker') return [];
	if (!Number.isInteger(index) || index < 0 || index >= contract.panel.length) return [];

	contract.panel = pressRelay(contract.panel, contract.spec.panel, index);
	contract.moves += 1;
	const events: HackersEvent[] = [{ type: 'relay' }];
	if (!isDark(contract.panel)) return events;

	const points =
		100 + 10 * contract.n + 10 * Math.max(0, contract.spec.presses + 4 - contract.moves);
	state.score += points;
	state.completed += 1;
	state.number += 1;
	state.trace = Math.max(0, state.trace - TRACE_RELIEF);
	events.push({ type: 'contract-done', points, n: contract.n });
	state.contract = newContract(state.number, random, state.upgrades);
	events.push(contractEvent(state.contract));
	return events;
}

/** Buys the next level of a tool with the DogeLite in the bank */
export function buyUpgrade(state: HackersState, tool: ToolId): HackersEvent[] {
	if (state.over) return [];
	const level = state.upgrades[tool];
	const cost = upgradeCost(tool, level);
	if (cost === null || state.score < cost) return [];

	state.score -= cost;
	state.upgrades = { ...state.upgrades, [tool]: level + 1 };
	// The three stage tools change the contract in play right away; the miner and the siphon
	// simply keep running
	if (tool !== 'miner' && tool !== 'siphon') {
		state.contract.spec = effectiveSpec(state.contract.n, state.upgrades);
	}
	return [{ type: 'upgrade', tool, level: level + 1, cost }];
}

/**
 * The miner pays every second, the siphon only after access is gained and then once per target
 * day, taking a share of whatever is left in the target's wallet.
 */
function passiveIncome(state: HackersState, dtMs: number): HackersEvent[] {
	const events: HackersEvent[] = [];

	state.pendingIncome += (minerIncome(state.upgrades) * dtMs) / 1000;
	const mined = Math.floor(state.pendingIncome);
	if (mined > 0) {
		state.pendingIncome -= mined;
		state.score += mined;
	}

	const share = siphonShare(state.upgrades);
	const contract = state.contract;
	if (share <= 0 || contract.stage === 'breach' || contract.wallet <= 0) return events;

	state.siphonMs += dtMs;
	while (state.siphonMs >= SIPHON_DAY_MS && contract.wallet > 0) {
		state.siphonMs -= SIPHON_DAY_MS;
		const drained = Math.min(
			contract.wallet,
			Math.max(1, Math.round(contract.wallet * share))
		);
		contract.wallet -= drained;
		state.score += drained;
		state.siphoned += drained;
		events.push({ type: 'siphon', amount: drained, left: contract.wallet });
	}
	return events;
}

/** Advances the clock: the trace creeps up, the software earns, and the keystrokes stream */
export function step(state: HackersState, dtMs: number, random: Random): HackersEvent[] {
	if (state.over) return [];
	state.timeMs += dtMs;
	const events: HackersEvent[] = passiveIncome(state, dtMs);
	const contract = state.contract;
	if (contract.stage === 'keylog') {
		const result = stepKeylog(
			contract.keylog,
			dtMs,
			random,
			contract.spec.chipMs,
			contract.spec.spawnMs
		);
		events.push(...afterKeylog(state, result, random));
	}
	if (state.over || state.contract !== contract) return events;
	events.push(...addTrace(state, (contract.spec.creep[contract.stage] * dtMs) / 1000, random));
	return events;
}
