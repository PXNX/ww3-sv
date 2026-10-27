/*
 * Petrobras game store: wraps the pure two-front rules with the toast, the flash on the front nobody
 * is watching, sounds and personal bests. Only what the page shows is reactive; the rules state
 * stays plain and is synced after every event (the clock every step).
 */
import { START_TRACK } from '#lib/game/petrobras/config.js';
import { choiceName, frontName } from '#lib/components/petrobrasText.js';
import type { Choice, Front } from '#lib/game/petrobras/scenarios.js';
import {
	answer,
	clockLeft,
	createGame,
	step,
	type PetrobrasEvent,
	type PetrobrasPhase,
	type PetrobrasState,
	type RoundResult
} from '#lib/game/petrobras/state.js';
import { createRandom, randomSeed, type Random } from '#lib/game/random.js';
import { m } from '#lib/paraglide/messages.js';
import { highscores, type Highscores } from '#lib/services/highscore.js';
import { soundManager } from '#lib/sound/soundManager.svelte.js';
import type { SoundId } from '#lib/sound/sounds.js';

export type PetrobrasStatus = 'ready' | 'playing' | 'paused' | 'over';

export const SCORE_KEY = ['petrobras', 'score'] as const;
export const STREAK_KEY = ['petrobras', 'streak'] as const;

const TOAST_MS = 1300;

export interface Toast {
	id: number;
	text: string;
}

export interface PetrobrasOptions {
	reducedMotion?: boolean;
	/** Injected for tests; defaults to the browser's local high scores */
	scores?: () => Highscores;
	/** Fixed seed for tests; a fresh random seed per run otherwise */
	seed?: () => number;
}

export class PetrobrasGame {
	status = $state<PetrobrasStatus>('ready');
	phase = $state<PetrobrasPhase>('prompt');
	round = $state(1);
	front = $state<Front>('board');
	scenarioIndex = $state(0);
	boss = $state(false);
	/** Both fronts, level at the start and scored by the lower one */
	board = $state(START_TRACK);
	society = $state(START_TRACK);
	score = $state(START_TRACK);
	/** Fraction of the prompt clock still left, 1 to 0 */
	clock = $state(1);
	streak = $state(0);
	bestStreak = $state(0);
	correct = $state(0);
	wrong = $state(0);
	timeouts = $state(0);
	last = $state.raw<RoundResult | null>(null);
	toast = $state.raw<Toast | null>(null);
	/** The quiet line about the front that is being ignored */
	neglectNote = $state.raw<Toast | null>(null);
	/** Counts up on every wrong call, so the field can shake */
	shakeCount = $state(0);
	hurtCount = $state(0);
	best = $state<number | null>(null);
	bestStreakEver = $state<number | null>(null);
	isNewBest = $state(false);

	/** Rules state, deliberately not reactive */
	state: PetrobrasState;

	readonly reducedMotion: boolean;
	#random: Random = createRandom(1);
	#scores: () => Highscores;
	#seed: () => number;
	#toastMs = 0;
	#neglectMs = 0;
	#toastId = 0;

	constructor({
		reducedMotion = false,
		scores = highscores,
		seed = randomSeed
	}: PetrobrasOptions = {}) {
		this.reducedMotion = reducedMotion;
		this.#scores = scores;
		this.#seed = seed;
		this.state = createGame(this.#random);
		this.#sync();
	}

	/** Reads the stored bests; call in the browser only */
	loadBest() {
		this.best = this.#scores().get(SCORE_KEY);
		this.bestStreakEver = this.#scores().get(STREAK_KEY);
	}

	start() {
		this.#random = createRandom(this.#seed());
		this.state = createGame(this.#random);
		this.toast = null;
		this.neglectNote = null;
		this.isNewBest = false;
		this.shakeCount = 0;
		this.hurtCount = 0;
		this.#toastMs = 0;
		this.#neglectMs = 0;
		this.#sync();
		this.status = 'playing';
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

	/** The player picks one of the two calls */
	choose(choice: Choice) {
		if (this.status !== 'playing') return;
		const events = answer(this.state, choice);
		for (const event of events) this.#handle(event);
		if (events.length > 0) this.#sync();
	}

	/** One fixed step: called by the game loop */
	update(dtMs: number) {
		if (this.status !== 'playing') return;
		if (this.toast && (this.#toastMs -= dtMs) <= 0) this.toast = null;
		if (this.neglectNote && (this.#neglectMs -= dtMs) <= 0) this.neglectNote = null;
		const events = step(this.state, dtMs, this.#random);
		for (const event of events) this.#handle(event);
		if (events.length > 0) this.#sync();
		else if (this.state.phase === 'prompt') this.clock = clockLeft(this.state);
	}

	/** Draws the two tracks on the shared score card: the board as towers, the feed as speech */
	drawBoard = (context: CanvasRenderingContext2D, x: number, y: number, size: number) => {
		const ink = '#111111';
		context.lineWidth = Math.max(2, size * 0.012);
		context.strokeStyle = ink;
		// The two tracks as bars, the lower one deciding the score
		const tracks = [
			{ value: this.state.board, colour: '#5b6f8a', top: y + size * 0.1 },
			{ value: this.state.society, colour: '#6f8d4b', top: y + size * 0.46 }
		];
		for (const track of tracks) {
			const height = size * 0.26;
			context.fillStyle = '#e8e1bc';
			context.fillRect(x + size * 0.06, track.top, size * 0.88, height);
			context.strokeRect(x + size * 0.06, track.top, size * 0.88, height);
			const share = Math.max(0, Math.min(1, track.value / 100));
			context.fillStyle = track.colour;
			context.fillRect(x + size * 0.06 + 2, track.top + 2, (size * 0.88 - 4) * share, height - 4);
		}
		// The oil derrick, small and off to the side
		context.fillStyle = '#111111';
		context.beginPath();
		context.moveTo(x + size * 0.5, y + size * 0.02);
		context.lineTo(x + size * 0.56, y + size * 0.1);
		context.lineTo(x + size * 0.44, y + size * 0.1);
		context.closePath();
		context.fill();
	};

	#handle(event: PetrobrasEvent) {
		switch (event.type) {
			case 'round':
				this.#play(event.boss ? 'alarm' : 'click', event.boss ? 0.6 : 0.5);
				break;
			case 'correct':
				this.#showToast(
					event.boss
						? m.petrobras_toast_boss_won()
						: m.petrobras_toast_correct({ front: frontName(event.front) })
				);
				this.#play(event.boss ? 'chime-big' : 'chime', event.boss ? 1 : 0.8);
				break;
			case 'wrong':
				this.hurtCount += 1;
				this.shakeCount += 1;
				this.#showToast(
					m.petrobras_toast_wrong({
						front: frontName(event.front),
						expected: choiceName(event.front, event.expected)
					})
				);
				this.#play('ui-error', 1);
				break;
			case 'timeout':
				this.hurtCount += 1;
				this.shakeCount += 1;
				this.#showToast(
					m.petrobras_toast_timeout({
						front: frontName(event.front),
						expected: choiceName(event.front, event.expected)
					})
				);
				this.#play('ui-error', 1);
				break;
			case 'neglect':
				this.neglectNote = {
					id: ++this.#toastId,
					text: m.petrobras_toast_neglect({ front: frontName(event.front) })
				};
				this.#neglectMs = TOAST_MS * (this.reducedMotion ? 1.4 : 1);
				break;
			case 'game-over':
				this.#sync();
				this.#finish();
				break;
		}
	}

	#showToast(text: string) {
		this.toast = { id: ++this.#toastId, text };
		this.#toastMs = TOAST_MS * (this.reducedMotion ? 1.4 : 1);
	}

	#play(id: SoundId, intensity: number) {
		soundManager().play(id, intensity);
	}

	#sync() {
		const state = this.state;
		this.phase = state.phase;
		this.round = state.round;
		this.front = state.prompt.front;
		this.scenarioIndex = state.prompt.index;
		this.boss = state.boss;
		this.board = state.board;
		this.society = state.society;
		this.score = state.score;
		this.clock = clockLeft(state);
		this.streak = state.streak;
		this.bestStreak = state.bestStreak;
		this.correct = state.correct;
		this.wrong = state.wrong;
		this.timeouts = state.timeouts;
		this.last = state.last;
	}

	#finish() {
		const scoreResult = this.#scores().submit(SCORE_KEY, this.state.score);
		const streakResult = this.#scores().submit(STREAK_KEY, this.state.bestStreak);
		this.isNewBest = scoreResult.isNewBest;
		this.best = scoreResult.best;
		this.bestStreakEver = streakResult.best;
		this.status = 'over';
	}
}
