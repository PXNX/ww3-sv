/*
 * Red Square game store: wraps the pure timing rules with the toast, the shake on a missed slot,
 * sounds and personal bests. Only what the page shows is reactive; the rules state stays plain and
 * is synced after every event (the marker every step).
 */
import {
	createGame,
	cue,
	interceptors,
	markerOf,
	step,
	type CueMissReason,
	type CueResult,
	type RedSquareEvent,
	type RedSquarePhase,
	type RedSquareState
} from '#lib/game/redsquare/state.js';
import { INTERCEPTORS_BASE, STARTING_MOOD } from '#lib/game/redsquare/config.js';
import { createRandom, randomSeed, type Random } from '#lib/game/random.js';
import { m } from '#lib/paraglide/messages.js';
import { highscores, type Highscores } from '#lib/services/highscore.js';
import { soundManager } from '#lib/sound/soundManager.svelte.js';
import type { SoundId } from '#lib/sound/sounds.js';

export type RedSquareStatus = 'ready' | 'playing' | 'paused' | 'over';

export const SCORE_KEY = ['redsquare', 'score'] as const;
export const STREAK_KEY = ['redsquare', 'streak'] as const;

const TOAST_MS = 1200;

export interface Toast {
	id: number;
	text: string;
}

export interface RedSquareOptions {
	reducedMotion?: boolean;
	/** Injected for tests; defaults to the browser's local high scores */
	scores?: () => Highscores;
	/** Fixed seed for tests; a fresh random seed per run otherwise */
	seed?: () => number;
}

export class RedSquareGame {
	status = $state<RedSquareStatus>('ready');
	phase = $state<RedSquarePhase>('march');
	round = $state(1);
	column = $state(0);
	wave = $state(1);
	/** Where the column is on the square, 0 to 1 */
	marker = $state(0);
	mood = $state(STARTING_MOOD);
	score = $state(0);
	streak = $state(0);
	bestStreak = $state(0);
	hits = $state(0);
	misses = $state(0);
	interceptors = $state(INTERCEPTORS_BASE);
	last = $state.raw<CueResult | null>(null);
	toast = $state.raw<Toast | null>(null);
	/** The radio line about the next wave */
	waveNote = $state.raw<Toast | null>(null);
	/** Counts up on every lost mood point, so the field can shake or flash */
	shakeCount = $state(0);
	hurtCount = $state(0);
	best = $state<number | null>(null);
	bestStreakEver = $state<number | null>(null);
	isNewBest = $state(false);

	/** Rules state, deliberately not reactive */
	state: RedSquareState;

	readonly reducedMotion: boolean;
	#random: Random = createRandom(1);
	#scores: () => Highscores;
	#seed: () => number;
	#toastMs = 0;
	#waveMs = 0;
	#toastId = 0;

	constructor({
		reducedMotion = false,
		scores = highscores,
		seed = randomSeed
	}: RedSquareOptions = {}) {
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
		this.waveNote = null;
		this.isNewBest = false;
		this.shakeCount = 0;
		this.hurtCount = 0;
		this.#toastMs = 0;
		this.#waveMs = 0;
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

	/** The player cues the column as it passes the tribune */
	cue() {
		if (this.status !== 'playing') return;
		const events = cue(this.state);
		for (const event of events) this.#handle(event);
		if (events.length > 0) this.#sync();
	}

	/** One fixed step: called by the game loop */
	update(dtMs: number) {
		if (this.status !== 'playing') return;
		if (this.toast && (this.#toastMs -= dtMs) <= 0) this.toast = null;
		if (this.waveNote && (this.#waveMs -= dtMs) <= 0) this.waveNote = null;
		const events = step(this.state, dtMs, this.#random);
		for (const event of events) this.#handle(event);
		this.marker = markerOf(this.state);
		if (events.length > 0) this.#sync();
	}

	/** Draws the parade onto the shared score card: three columns, a tribune and the firework */
	drawBoard = (context: CanvasRenderingContext2D, x: number, y: number, size: number) => {
		const ink = '#111111';
		context.lineWidth = Math.max(2, size * 0.012);
		context.strokeStyle = ink;
		// The square
		context.fillStyle = '#b8ac8f';
		context.fillRect(x, y + size * 0.45, size, size * 0.55);
		context.strokeRect(x, y + size * 0.45, size, size * 0.55);
		// Three blocks of the parade, the middle one already past the tribune
		const colours = ['#6f8d4b', '#5b6f8a', '#8a5b5b'];
		colours.forEach((colour, i) => {
			const left = x + size * (0.1 + i * 0.28);
			context.fillStyle = colour;
			context.fillRect(left, y + size * 0.58, size * 0.2, size * 0.24);
			context.strokeRect(left, y + size * 0.58, size * 0.2, size * 0.24);
		});
		// The tribune
		context.fillStyle = '#7a2f2f';
		context.fillRect(x + size * 0.52, y + size * 0.32, size * 0.44, size * 0.14);
		context.strokeRect(x + size * 0.52, y + size * 0.32, size * 0.44, size * 0.14);
		// The one very large firework
		context.save();
		context.translate(x + size * 0.26, y + size * 0.2);
		context.strokeStyle = '#e1a53c';
		context.lineWidth = Math.max(2, size * 0.014);
		for (let i = 0; i < 8; i++) {
			const angle = (i / 8) * Math.PI * 2;
			context.beginPath();
			context.moveTo(Math.cos(angle) * size * 0.04, Math.sin(angle) * size * 0.04);
			context.lineTo(Math.cos(angle) * size * 0.14, Math.sin(angle) * size * 0.14);
			context.stroke();
		}
		context.restore();
	};

	#handle(event: RedSquareEvent) {
		switch (event.type) {
			case 'round':
				this.#play('click', 0.5);
				break;
			case 'hit':
				this.#showToast(
					event.perfect
						? m.redsquare_popup_perfect({ points: event.points })
						: m.redsquare_popup_hit({ points: event.points })
				);
				this.#play(event.perfect ? 'chime' : 'pop', event.perfect ? 0.9 : 0.7);
				break;
			case 'miss':
				this.hurtCount += 1;
				this.shakeCount += 1;
				this.#showToast(missText(event.reason));
				this.#play('ui-error', 1);
				break;
			case 'wave':
				this.waveNote = {
					id: ++this.#toastId,
					text: m.redsquare_popup_wave({ wave: event.wave, interceptors: event.interceptors })
				};
				this.#waveMs = TOAST_MS * (this.reducedMotion ? 1.4 : 1);
				this.#play('alarm', 0.5);
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
		this.column = state.column;
		this.wave = state.wave;
		this.marker = markerOf(state);
		this.mood = state.mood;
		this.score = state.score;
		this.streak = state.streak;
		this.bestStreak = state.bestStreak;
		this.hits = state.hits;
		this.misses = state.misses;
		this.interceptors = interceptors(state);
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

function missText(reason: CueMissReason): string {
	return reason === 'early'
		? m.redsquare_popup_early()
		: reason === 'late'
			? m.redsquare_popup_late()
			: m.redsquare_popup_missed();
}
