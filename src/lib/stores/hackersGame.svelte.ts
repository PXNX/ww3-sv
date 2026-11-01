/*
 * Hermit Hackers game store: wraps the pure rules with the keypad input, the terminal log,
 * sounds and the personal best. The rules live in a plain state object; what the page shows
 * (guesses, keystroke chips, relay panel, trace) is copied into reactive fields after every
 * change. Nothing runs until start(), and the loop is driven by the page, so a run never ticks
 * away unseen (and never on the server).
 */
import { haptic } from '#lib/haptic/haptic.svelte.js';
import { STARTING_LIVES, TRACE_MAX } from '#lib/game/hackers/config.js';
import type { Chip } from '#lib/game/hackers/keylog.js';
import {
	buyUpgrade,
	attemptsLeft,
	createGame,
	flipRelay,
	openingEvent,
	step,
	submitGuess,
	tapChip,
	typeLetter,
	type Guess,
	type HackersEvent,
	type HackersState,
	type Stage
} from '#lib/game/hackers/state.js';
import {
	emptyUpgrades,
	minerIncome,
	siphonShare,
	SIPHON_DAY_MS,
	upgradeCost,
	type ToolId,
	type Upgrades
} from '#lib/game/hackers/software.js';
import { createRandom, randomSeed, type Random } from '#lib/game/random.js';
import { m } from '#lib/paraglide/messages.js';
import { highscores, type Highscores } from '#lib/services/highscore.js';
import { soundManager } from '#lib/sound/soundManager.svelte.js';
import type { SoundId } from '#lib/sound/sounds.js';

export type HackersStatus = 'ready' | 'playing' | 'paused' | 'over';

export const HACKERS_BEST_KEY = ['hackers', 'score'] as const;

const LOG_LINES = 7;

const TOOL_NAMES: Record<ToolId, () => string> = {
	breach: m.hackers_tool_breach,
	keylog: m.hackers_tool_keylog,
	relays: m.hackers_tool_relays,
	miner: m.hackers_tool_miner,
	siphon: m.hackers_tool_siphon
};

export class HackersGame {
	status = $state<HackersStatus>('ready');
	score = $state(0);
	lives = $state(STARTING_LIVES);
	/** 0 to 100 */
	trace = $state(0);
	stage = $state<Stage>('breach');
	contractNumber = $state(1);
	completed = $state(0);
	ip = $state('');
	system = $state('');
	guesses = $state.raw<Guess[]>([]);
	/** The glyphs typed into the current attempt */
	input = $state.raw<number[]>([]);
	codeLength = $state(4);
	symbols = $state(5);
	attemptsLeft = $state(0);
	chips = $state.raw<Chip[]>([]);
	/** The part of the passphrase captured so far, and its full length */
	captured = $state('');
	passphraseLength = $state(4);
	panel = $state.raw<boolean[]>([]);
	panelSize = $state(3);
	moves = $state(0);
	par = $state(3);
	log = $state.raw<string[]>([]);
	/** Counts up on every trace-out, so the page can flash */
	hurtCount = $state(0);
	best = $state<number | null>(null);
	isNewBest = $state(false);
	/** Software bought in this run */
	upgrades = $state.raw<Upgrades>(emptyUpgrades());
	/** DogeLite a second the miner on the player's own machine pays */
	incomePerSecond = $state(0);
	/** Share of the target's wallet the siphon takes per day, 0 when it is not installed */
	siphonRate = $state(0);
	/** Time towards the siphon's next day, 0 to 1 */
	siphonProgress = $state(0);
	wallet = $state(0);
	walletStart = $state(0);
	/** DogeLite the siphon has drained in this run */
	siphoned = $state(0);

	/** Rules state, deliberately not reactive */
	state: HackersState;

	#random: Random = createRandom(1);
	#scores: () => Highscores;
	#seed: () => number;

	constructor({
		scores = highscores,
		seed = randomSeed
	}: { scores?: () => Highscores; seed?: () => number } = {}) {
		this.#scores = scores;
		this.#seed = seed;
		this.state = createGame(this.#random);
		this.#sync();
	}

	/** Reads the stored best; call in the browser only */
	loadBest() {
		this.best = this.#scores().get(HACKERS_BEST_KEY);
	}

	start() {
		this.#random = createRandom(this.#seed());
		this.state = createGame(this.#random);
		this.log = [];
		this.input = [];
		this.isNewBest = false;
		this.hurtCount = 0;
		this.#sync();
		this.status = 'playing';
		this.#apply([openingEvent(this.state)]);
	}

	pause() {
		if (this.status === 'playing') this.status = 'paused';
	}

	resume() {
		if (this.status === 'paused') this.status = 'playing';
	}

	togglePause() {
		if (this.status === 'playing') this.pause();
		else this.resume();
	}

	/** A glyph on the keypad goes into the current attempt */
	pushSymbol(symbol: number) {
		if (this.status !== 'playing' || this.state.contract.stage !== 'breach') return;
		const spec = this.state.contract.spec;
		if (this.input.length >= spec.codeLength || symbol < 0 || symbol >= spec.symbols) return;
		this.input = [...this.input, symbol];
		this.#play('ui-tap', 0.5);
	}

	popSymbol() {
		if (this.status !== 'playing' || this.input.length === 0) return;
		this.input = this.input.slice(0, -1);
		this.#play('ui-tap', 0.4);
	}

	/** Tries the typed code; it needs every slot filled */
	submit() {
		if (this.status !== 'playing') return;
		if (this.input.length !== this.state.contract.spec.codeLength) return;
		const events = submitGuess(this.state, this.input, this.#random);
		this.input = [];
		this.#apply(events);
	}

	tapChip(chipId: number) {
		if (this.status !== 'playing') return;
		this.#apply(tapChip(this.state, chipId, this.#random));
	}

	typeLetter(letter: string) {
		if (this.status !== 'playing') return;
		this.#apply(typeLetter(this.state, letter, this.#random));
	}

	flipRelay(index: number) {
		if (this.status !== 'playing') return;
		this.#apply(flipRelay(this.state, index, this.#random));
	}

	/** What the next level of a tool costs, or null once it is maxed */
	cost(tool: ToolId): number | null {
		return upgradeCost(tool, this.state.upgrades[tool]);
	}

	/** Buys the next level of a tool with the DogeLite in the bank */
	buy(tool: ToolId) {
		if (this.status !== 'playing' && this.status !== 'paused') return;
		const events = buyUpgrade(this.state, tool);
		if (events.length === 0) {
			this.#play('ui-error', 0.4);
			return;
		}
		this.#apply(events);
	}

	/** One fixed step: called by the page's game loop */
	update(dtMs: number) {
		if (this.status !== 'playing') return;
		this.#apply(step(this.state, dtMs, this.#random));
	}

	/** Draws a little terminal onto the shared score card */
	drawBoard = (context: CanvasRenderingContext2D, x: number, y: number, size: number) => {
		context.fillStyle = '#021208';
		context.fillRect(x, y, size, size);
		context.strokeStyle = '#111111';
		context.lineWidth = Math.max(2, size * 0.012);
		context.strokeRect(x, y, size, size);
		context.fillStyle = '#39ff6a';
		context.font = `${Math.round(size * 0.07)}px monospace`;
		const lines = [
			`> ${this.state.contract.ip}`,
			`> ${this.state.contract.system}`,
			`> contracts: ${this.state.completed}`,
			`> dogelite: ${this.state.score}`,
			'> TRACED_'
		];
		lines.forEach((line, i) =>
			context.fillText(line, x + size * 0.06, y + size * (0.16 + i * 0.14))
		);
		const barWidth = size * 0.88;
		context.strokeRect(x + size * 0.06, y + size * 0.88, barWidth, size * 0.05);
		context.fillStyle = '#e5484d';
		context.fillRect(
			x + size * 0.06,
			y + size * 0.88,
			barWidth * (this.state.trace / TRACE_MAX),
			size * 0.05
		);
	};

	#apply(events: HackersEvent[]) {
		for (const event of events) this.#handle(event);
		this.#sync();
		if (this.state.over && this.status === 'playing') this.#finish();
	}

	#handle(event: HackersEvent) {
		switch (event.type) {
			case 'contract':
				this.input = [];
				this.#say(m.hackers_log_connect({ ip: event.ip, system: event.system }));
				break;
			case 'guess': {
				const hits = event.marks.filter((mark) => mark === 'hit').length;
				this.#say(m.hackers_log_guess({ hits, total: event.marks.length }));
				this.#play(hits > 0 ? 'click' : 'ui-error', 0.6);
				break;
			}
			case 'cracked':
				this.#say(m.hackers_log_cracked());
				this.#play('chime', 0.9);
				haptic().play(0.3);
				break;
			case 'rotated':
				this.#say(m.hackers_log_rotated());
				this.#play('alarm', 0.6);
				break;
			case 'key':
				this.#say(m.hackers_log_key({ letter: event.letter.toUpperCase() }));
				this.#play('pickup', 0.8);
				haptic().play(0.15);
				break;
			case 'honeypot':
				this.#say(m.hackers_log_wrong());
				this.#play('ui-error', 0.9);
				haptic().play(0.4);
				break;
			case 'missed':
				this.#say(m.hackers_log_missed());
				this.#play('thud', 0.5);
				break;
			case 'keys-done':
				this.#say(m.hackers_log_keys());
				this.#play('chime-big', 0.8);
				break;
			case 'relay':
				this.#play('ui-toggle', 0.6);
				break;
			case 'contract-done':
				this.#say(m.hackers_log_done({ coins: event.points }));
				this.#play('sparkle', 0.9);
				haptic().play(0.4);
				break;
			case 'upgrade':
				this.#say(
					m.hackers_log_upgrade({
						tool: TOOL_NAMES[event.tool](),
						level: event.level,
						cost: event.cost
					})
				);
				this.#play('click', 0.7);
				haptic().play(0.2);
				break;
			case 'siphon':
				this.#say(m.hackers_log_siphon({ amount: event.amount, left: event.left }));
				this.#play('pickup', 0.5);
				break;
			case 'traced':
				this.hurtCount += 1;
				this.#say(m.hackers_log_traced());
				this.#play('alarm', 1);
				haptic().play(0.7);
				break;
			case 'game-over':
				break;
		}
	}

	#say(line: string) {
		this.log = [...this.log, line].slice(-LOG_LINES);
	}

	#play(id: SoundId, intensity: number) {
		soundManager().play(id, intensity);
	}

	#sync() {
		const state = this.state;
		const contract = state.contract;
		this.score = state.score;
		this.lives = state.lives;
		this.trace = Math.min(TRACE_MAX, state.trace);
		this.stage = contract.stage;
		this.contractNumber = contract.n;
		this.completed = state.completed;
		this.ip = contract.ip;
		this.system = contract.system;
		this.guesses = [...contract.guesses];
		this.codeLength = contract.spec.codeLength;
		this.symbols = contract.spec.symbols;
		this.attemptsLeft = attemptsLeft(contract);
		this.captured = contract.keylog.passphrase.slice(0, contract.keylog.captured);
		this.passphraseLength = contract.keylog.passphrase.length;
		this.chips =
			contract.stage === 'keylog' ? contract.keylog.chips.map((chip) => ({ ...chip })) : [];
		this.panel = contract.panel;
		this.panelSize = contract.spec.panel;
		this.moves = contract.moves;
		this.par = contract.spec.presses;
		this.upgrades = { ...state.upgrades };
		this.incomePerSecond = minerIncome(state.upgrades);
		this.siphonRate = siphonShare(state.upgrades);
		this.siphonProgress = Math.min(1, state.siphonMs / SIPHON_DAY_MS);
		this.wallet = contract.wallet;
		this.walletStart = contract.walletStart;
		this.siphoned = state.siphoned;
		if (contract.stage !== 'breach' && this.input.length > 0) this.input = [];
	}

	#finish() {
		const result = this.#scores().submit(HACKERS_BEST_KEY, this.state.score);
		this.isNewBest = result.isNewBest;
		this.best = result.best;
		this.input = [];
		this.status = 'over';
	}
}
