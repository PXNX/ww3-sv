/*
 * Border Shift game store: wraps the pure convoy rules with the toast, the shake on a wrong call,
 * sounds and personal bests. The playfield reads the reactive fields and the fixed-step loop only
 * has to tick the patience clock.
 */
import {
	createGame,
	decide,
	destabilisationShare,
	inspect,
	patienceShare,
	step,
	type BorderShiftEvent,
	type BorderShiftOutcome,
	type BorderShiftPhase,
	type BorderShiftState,
	type BorderShiftStats,
	type Decision,
	type DecisionResult
} from '#lib/game/bordershift/state.js';
import { STARTING_REPUTATION } from '#lib/game/bordershift/config.js';
import type { Hint, Tool } from '#lib/game/bordershift/convoys.js';
import { createRandom, randomSeed, type Random } from '#lib/game/random.js';
import { m } from '#lib/paraglide/messages.js';
import { highscores, type Highscores } from '#lib/services/highscore.js';
import { soundManager } from '#lib/sound/soundManager.svelte.js';
import type { SoundId } from '#lib/sound/sounds.js';

export type BorderShiftStatus = 'ready' | 'playing' | 'paused' | 'over';

export const SCORE_KEY = ['bordershift', 'score'] as const;
export const STREAK_KEY = ['bordershift', 'streak'] as const;

const TOAST_MS = 1300;

export interface Toast {
	id: number;
	text: string;
}

export interface BorderShiftOptions {
	reducedMotion?: boolean;
	/** Injected for tests; defaults to the browser's local high scores */
	scores?: () => Highscores;
	/** Fixed seed for tests; a fresh random seed per run otherwise */
	seed?: () => number;
}

export class BorderShiftGame {
	status = $state<BorderShiftStatus>('ready');
	phase = $state<BorderShiftPhase>('watch');
	wave = $state(1);
	convoyNumber = $state(1);
	vehicle = $state(0);
	/** Share of the patience still left, 0 to 1 */
	patience = $state(1);
	reputation = $state(STARTING_REPUTATION);
	/** The radio's campaign, 0 to 1; the night ends at 1 even with reputation left */
	destabilisation = $state(0);
	outcome = $state<BorderShiftOutcome | null>(null);
	score = $state(0);
	streak = $state(0);
	bestStreak = $state(0);
	correct = $state(0);
	wrong = $state(0);
	revealed = $state.raw<Record<Tool, Hint | null>>({ documents: null, camera: null });
	last = $state.raw<DecisionResult | null>(null);
	stats = $state.raw<BorderShiftStats>({
		admitted: 0,
		caught: 0,
		turnedAway: 0,
		slipped: 0
	});
	toast = $state.raw<Toast | null>(null);
	/** The radio line about the next shift */
	waveNote = $state.raw<Toast | null>(null);
	/** Counts up on every wrong call, so the field can shake or flash */
	shakeCount = $state(0);
	hurtCount = $state(0);
	best = $state<number | null>(null);
	bestStreakEver = $state<number | null>(null);
	isNewBest = $state(false);

	/** Rules state, deliberately not reactive */
	state: BorderShiftState;

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
	}: BorderShiftOptions = {}) {
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

	/** Look at the papers or take a photo; each tool works once per convoy */
	inspect(tool: Tool) {
		if (this.status !== 'playing') return;
		const events = inspect(this.state, tool);
		for (const event of events) this.#handle(event);
		if (events.length > 0) this.#sync();
	}

	/** Wave the convoy through or turn it back */
	decide(decision: Decision) {
		if (this.status !== 'playing') return;
		const events = decide(this.state, decision);
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
		if (events.length > 0) this.#sync();
		this.patience = patienceShare(this.state);
	}

	/** Draws the checkpoint onto the shared score card: night sky, barrier, lamp and a van */
	drawBoard = (context: CanvasRenderingContext2D, x: number, y: number, size: number) => {
		const ink = '#111111';
		context.lineWidth = Math.max(2, size * 0.012);
		context.strokeStyle = ink;
		// Night above and the road below
		context.fillStyle = '#2f3a4a';
		context.fillRect(x, y, size, size * 0.55);
		context.strokeRect(x, y, size, size * 0.55);
		context.fillStyle = '#55604a';
		context.fillRect(x, y + size * 0.55, size, size * 0.45);
		context.strokeRect(x, y + size * 0.55, size, size * 0.45);
		context.fillStyle = '#6b6b6b';
		context.fillRect(x + size * 0.28, y + size * 0.55, size * 0.44, size * 0.45);
		// The lamp over the barrier
		context.strokeStyle = ink;
		context.beginPath();
		context.moveTo(x + size * 0.78, y + size * 0.6);
		context.lineTo(x + size * 0.78, y + size * 0.18);
		context.lineTo(x + size * 0.56, y + size * 0.18);
		context.stroke();
		context.fillStyle = '#e1a53c';
		context.fillRect(x + size * 0.46, y + size * 0.13, size * 0.1, size * 0.1);
		context.strokeRect(x + size * 0.46, y + size * 0.13, size * 0.1, size * 0.1);
		// The barrier, red and white
		for (let i = 0; i < 4; i++) {
			context.fillStyle = i % 2 === 0 ? '#c1442e' : '#f2f2f2';
			context.fillRect(x + size * (0.5 + i * 0.1), y + size * 0.34, size * 0.1, size * 0.07);
		}
		context.strokeRect(x + size * 0.5, y + size * 0.34, size * 0.4, size * 0.07);
		// A van waiting with its headlights on
		context.fillStyle = '#4b5563';
		context.fillRect(x + size * 0.06, y + size * 0.62, size * 0.24, size * 0.2);
		context.strokeRect(x + size * 0.06, y + size * 0.62, size * 0.24, size * 0.2);
		context.fillStyle = '#f5c83a';
		context.fillRect(x + size * 0.27, y + size * 0.7, size * 0.04, size * 0.04);
		context.fillStyle = ink;
		context.beginPath();
		context.arc(x + size * 0.12, y + size * 0.84, size * 0.032, 0, Math.PI * 2);
		context.arc(x + size * 0.24, y + size * 0.84, size * 0.032, 0, Math.PI * 2);
		context.fill();
		// Two more pairs of headlights behind it
		context.fillStyle = '#e1a53c';
		context.fillRect(x + size * 0.06, y + size * 0.9, size * 0.05, size * 0.03);
		context.fillRect(x + size * 0.2, y + size * 0.9, size * 0.05, size * 0.03);
	};

	#handle(event: BorderShiftEvent) {
		switch (event.type) {
			case 'convoy':
				this.#play('click', 0.5);
				break;
			case 'hint':
				this.#play('ui-tap', 0.6);
				break;
			case 'correct':
				this.#showToast(
					event.truth === 'family'
						? event.reason === 'timeout'
							? m.bordershift_popup_timeout_admitted({ points: event.points })
							: m.bordershift_popup_admitted({ points: event.points })
						: m.bordershift_popup_caught({ points: event.points })
				);
				this.#play(event.points >= 130 ? 'chime' : 'pop', 0.8);
				break;
			case 'wrong':
				this.hurtCount += 1;
				this.shakeCount += 1;
				this.#showToast(
					event.truth === 'family'
						? m.bordershift_popup_turned_away()
						: event.reason === 'timeout'
							? m.bordershift_popup_timeout_slipped()
							: m.bordershift_popup_slipped()
				);
				this.#play('ui-error', 1);
				break;
			case 'wave':
				this.waveNote = {
					id: ++this.#toastId,
					text: m.bordershift_popup_wave({ wave: event.wave })
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
		this.wave = state.wave;
		this.convoyNumber = state.convoyNumber;
		this.vehicle = state.convoy.vehicle;
		this.patience = patienceShare(state);
		this.reputation = state.reputation;
		this.destabilisation = destabilisationShare(state);
		this.outcome = state.outcome;
		this.score = state.score;
		this.streak = state.streak;
		this.bestStreak = state.bestStreak;
		this.correct = state.correct;
		this.wrong = state.wrong;
		this.revealed = state.revealed;
		this.last = state.last;
		this.stats = state.stats;
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
