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
import { emptyHardware, hardwareSpec, hardwareEffects, type Hardware } from './hardware';
import { emptyBotnet, botnetIncome, downloadTime, type Botnet } from './botnet';
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
	/** The unit's own machine, bought with banked DogeLite and kept between runs */
	hardware: Hardware;
	/** The botnet: nodes earn data, used by the automatic bruteforcer */
	botnet: Botnet;
	/** Data earned from botnet nodes and downloads — buys extra software */
	data: number;
	/** Which entry of TARGETS the contract in play sits on */
	targetIndex: number;
	/** The contract in play is on this system instead, until it is finished */
	extra?: ExtraTarget;
	/** Bruteforce progress on the current contract (0 to 1), auto-gains access at 1 */
	bruteforceProgress: number;
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

/** A system outside the target list, such as one found on a bank's network */
export interface ExtraTarget {
	ip: string;
	system: string;
	/** Multiplies what the contract pays */
	reward: number;
}

export function newContract(
	n: number,
	random: Random,
	upgrades: Upgrades = emptyUpgrades(),
	hardware: Hardware = emptyHardware(),
	targetIndex = 0,
	extra?: ExtraTarget
): Contract {
	const spec = effectiveSpec(n, upgrades, hardware);
	const target =
		extra ?? TARGETS[((targetIndex % TARGETS.length) + TARGETS.length) % TARGETS.length];
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

export interface GameOptions {
	/** The unit's own machine from the profile */
	hardware?: Hardware;
	/** Target picked in the terminal's target list */
	targetIndex?: number;
	/** Botnet and data from the profile */
	botnet?: Botnet;
	/** Starts on a system outside the target list */
	extra?: ExtraTarget;
	/** The contract the run opens with, for another player's rig: its firewall level */
	level?: number;
}

export function createGame(random: Random, options: GameOptions = {}): HackersState {
	const upgrades = emptyUpgrades();
	const hardware = options.hardware ?? emptyHardware();
	const targetIndex = options.targetIndex ?? 0;
	const botnet = options.botnet ?? emptyBotnet();
	const level = Math.max(1, Math.floor(options.level ?? 1));
	return {
		contract: newContract(level, random, upgrades, hardware, targetIndex, options.extra),
		lives: STARTING_LIVES,
		trace: 0,
		score: 0,
		completed: 0,
		number: level,
		over: false,
		timeMs: 0,
		upgrades,
		hardware: { ...hardware },
		botnet: { ...botnet },
		targetIndex,
		...(options.extra ? { extra: options.extra } : {}),
		data: botnet.data,
		bruteforceProgress: 0,
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
	state.contract = newContract(
		state.number,
		random,
		state.upgrades,
		state.hardware,
		state.targetIndex,
		state.extra
	);
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

	const points = Math.round(
		(100 + 10 * contract.n + 10 * Math.max(0, contract.spec.presses + 4 - contract.moves)) *
			(state.extra?.reward ?? 1)
	);
	state.score += points;
	state.completed += 1;
	state.number += 1;
	state.trace = Math.max(0, state.trace - TRACE_RELIEF);
	events.push({ type: 'contract-done', points, n: contract.n });
	// A system off the list is a one-off; the run goes back to the list where it left it
	if (state.extra) delete state.extra;
	else state.targetIndex = (state.targetIndex + 1) % TARGETS.length;
	state.contract = newContract(
		state.number,
		random,
		state.upgrades,
		state.hardware,
		state.targetIndex
	);
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
		state.contract.spec = effectiveSpec(state.contract.n, state.upgrades, state.hardware);
	}
	return [{ type: 'upgrade', tool, level: level + 1, cost }];
}

/**
 * The miner pays every second, the siphon only after access is gained and then once per target
 * day, taking a share of whatever is left in the target's wallet.
 */
function passiveIncome(state: HackersState, dtMs: number): HackersEvent[] {
	const events: HackersEvent[] = [];

	state.pendingIncome += (minerIncome(state.upgrades, state.hardware) * dtMs) / 1000;
	const mined = Math.floor(state.pendingIncome);
	if (mined > 0) {
		state.pendingIncome -= mined;
		state.score += mined;
	}

	// Botnet nodes earn data continuously
	const dataRate = botnetIncome(state.botnet);
	state.data += (dataRate * dtMs) / 1000;

	// Automatic bruteforcer: progresses toward cracking the breach stage
	if (state.contract.stage === 'breach' && state.upgrades.bruteforce > 0) {
		const cableBonus = downloadSpeed(state.hardware);
		const nodeBonus = 1 + 0.2 * state.botnet.nodes;
		const rate = 0.015 * state.upgrades.bruteforce * cableBonus * nodeBonus; // progress per second
		state.bruteforceProgress = Math.min(1, state.bruteforceProgress + (rate * dtMs) / 1000);
		if (state.bruteforceProgress >= 1) {
			state.contract.stage = 'keylog';
			state.bruteforceProgress = 0;
			// Reset to new keylog state (simplified — keep same contract number)
		}
	}

	const share = siphonShare(state.upgrades, state.hardware);
	const contract = state.contract;
	if (share <= 0 || contract.stage === 'breach' || contract.wallet <= 0) return events;

	state.siphonMs += dtMs;
	while (state.siphonMs >= SIPHON_DAY_MS && contract.wallet > 0) {
		state.siphonMs -= SIPHON_DAY_MS;
		const drained = Math.min(contract.wallet, Math.max(1, Math.round(contract.wallet * share)));
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
