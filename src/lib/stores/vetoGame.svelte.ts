/*
 * Security Council Veto game store: wraps the pure rules with the toast, the veto stamp and screen
 * shake, sounds and personal bests. The rules live in a plain state object; only what the page
 * shows is reactive, and it is synced after every event (the clock bar every step).
 */
import { STARTING_LIVES } from '#lib/game/veto/config.js';
import type { Resolution } from '#lib/game/veto/resolutions.js';
import {
	answer,
	clockLeft,
	createGame,
	step,
	type RoundResult,
	type VetoEvent,
	type VetoPhase,
	type VetoState
} from '#lib/game/veto/state.js';
import { multiplier, paceLevel } from '#lib/game/veto/timing.js';
import type { Action, Stance } from '#lib/game/veto/vote.js';
import { createRandom, randomSeed, type Random } from '#lib/game/random.js';
import { m } from '#lib/paraglide/messages.js';
import { highscores, type Highscores } from '#lib/services/highscore.js';
import { soundManager } from '#lib/sound/soundManager.svelte.js';
import type { SoundId } from '#lib/sound/sounds.js';
import { actionName } from '#lib/components/vetoText.js';

export type VetoStatus = 'ready' | 'playing' | 'paused' | 'over';

export const SCORE_KEY = ['veto', 'score'] as const;
export const STREAK_KEY = ['veto', 'streak'] as const;

const TOAST_MS = 1300;

export interface Toast {
	id: number;
	text: string;
}

export interface VetoStamp {
	id: number;
	/** The veto settled a tie, so the stamp says so */
	tieBreak: boolean;
}

export interface VetoOptions {
	reducedMotion?: boolean;
	/** Injected for tests; defaults to the browser's local high scores */
	scores?: () => Highscores;
	/** Fixed seed for tests; a fresh random seed per run otherwise */
	seed?: () => number;
}

export class VetoGame {
	status = $state<VetoStatus>('ready');
	phase = $state<VetoPhase>('question');
	round = $state(1);
	resolution = $state.raw<Resolution>({ index: 0, number: 1000 });
	cards = $state.raw<Stance[]>([]);
	/** The right action of the round, shown on the buttons once the verdict is up */
	expected = $state<Action>('veto');
	tieBreak = $state(false);
	/** Fraction of the round's time left, 1 to 0 */
	clock = $state(1);
	score = $state(0);
	lives = $state(STARTING_LIVES);
	streak = $state(0);
	bestStreak = $state(0);
	pace = $state(0);
	multiplier = $state(1);
	correct = $state(0);
	tieBreaks = $state(0);
	last = $state.raw<RoundResult | null>(null);
	toast = $state.raw<Toast | null>(null);
	/** The note about a speed-up, shown under the toast */
	paceNote = $state.raw<Toast | null>(null);
	/** The veto stamp on the resolution, set by a correct veto and cleared by the next round */
	stamp = $state.raw<VetoStamp | null>(null);
	/** Counts up on every veto stamp and wrong vote, so the field can shake or flash */
	shakeCount = $state(0);
	shakePower = $state(1);
	hurtCount = $state(0);
	best = $state<number | null>(null);
	bestStreakEver = $state<number | null>(null);
	isNewBest = $state(false);

	/** Rules state, deliberately not reactive */
	state: VetoState;

	readonly reducedMotion: boolean;
	#random: Random = createRandom(1);
	#scores: () => Highscores;
	#seed: () => number;
	#toastMs = 0;
	#paceMs = 0;
	#toastId = 0;
	#stampId = 0;

	constructor({ reducedMotion = false, scores = highscores, seed = randomSeed }: VetoOptions = {}) {
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
		this.paceNote = null;
		this.stamp = null;
		this.isNewBest = false;
		this.shakeCount = 0;
		this.hurtCount = 0;
		this.#toastMs = 0;
		this.#paceMs = 0;
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

	/** The player taps vote yes, abstain or veto */
	vote(action: Action) {
		if (this.status !== 'playing') return;
		const events = answer(this.state, action);
		for (const event of events) this.#handle(event);
		if (events.length > 0) this.#sync();
	}

	/** One fixed step: called by the game loop */
	update(dtMs: number) {
		if (this.status !== 'playing') return;
		if (this.toast && (this.#toastMs -= dtMs) <= 0) this.toast = null;
		if (this.paceNote && (this.#paceMs -= dtMs) <= 0) this.paceNote = null;
		const events = step(this.state, dtMs, this.#random);
		for (const event of events) this.#handle(event);
		if (events.length > 0) this.#sync();
		else if (this.state.phase === 'question') this.clock = clockLeft(this.state);
	}

	/** Draws the council table onto the shared score card: the last five cards and the stamp */
	drawBoard = (context: CanvasRenderingContext2D, x: number, y: number, size: number) => {
		const colours = { aye: '#6fbf73', nay: '#e5484d', meh: '#f5c83a' } as const;
		const cards = this.state.cards;
		const gap = size * 0.04;
		const width = (size - gap * (cards.length + 1)) / Math.max(1, cards.length);
		context.lineWidth = Math.max(2, size * 0.012);
		context.strokeStyle = '#111111';
		cards.forEach((card, i) => {
			const left = x + gap + i * (width + gap);
			context.fillStyle = '#6a7c9b';
			context.fillRect(left, y + size * 0.55, width, size * 0.35);
			context.strokeRect(left, y + size * 0.55, width, size * 0.35);
			context.fillStyle = colours[card];
			context.beginPath();
			context.roundRect(left, y + size * 0.22, width, size * 0.28, width * 0.14);
			context.fill();
			context.stroke();
		});
		context.save();
		context.translate(x + size / 2, y + size * 0.12);
		context.rotate(-0.12);
		context.fillStyle = '#e5484d';
		context.strokeStyle = '#e5484d';
		context.lineWidth = Math.max(3, size * 0.02);
		context.strokeRect(-size * 0.22, -size * 0.07, size * 0.44, size * 0.14);
		context.font = `bold ${Math.round(size * 0.11)}px sans-serif`;
		context.textAlign = 'center';
		context.textBaseline = 'middle';
		context.fillText('VETO', 0, 0);
		context.restore();
	};

	#handle(event: VetoEvent) {
		switch (event.type) {
			case 'round':
				this.stamp = null;
				this.#play('click', 0.6);
				break;
			case 'correct': {
				const text = event.tieBreak
					? m.veto_popup_tie({ points: event.points })
					: event.tier === 'swift'
						? m.veto_popup_swift({ points: event.points })
						: event.tier === 'steady'
							? m.veto_popup_steady({ points: event.points })
							: m.veto_popup_late({ points: event.points });
				this.#showToast(text);
				if (event.chosen === 'veto') {
					this.stamp = { id: ++this.#stampId, tieBreak: event.tieBreak };
					this.shakePower = event.tieBreak ? 2 : 1;
					this.shakeCount += 1;
					this.#play('thud', event.tieBreak ? 1 : 0.7);
				} else {
					this.#play(event.tier === 'swift' ? 'chime' : 'pop', 0.8);
				}
				break;
			}
			case 'wrong':
				this.hurtCount += 1;
				this.#showToast(m.veto_popup_wrong({ action: actionName(event.expected) }));
				this.#play('ui-error', 1);
				break;
			case 'timeout':
				this.hurtCount += 1;
				this.#showToast(m.veto_popup_timeout({ action: actionName(event.expected) }));
				this.#play('ui-error', 1);
				break;
			case 'pace':
				this.paceNote = { id: ++this.#toastId, text: m.veto_popup_pace({ level: event.level }) };
				this.#paceMs = TOAST_MS * (this.reducedMotion ? 1.4 : 1);
				this.#play('whoosh', 0.8);
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
		this.resolution = state.resolution;
		this.cards = [...state.cards];
		this.expected = state.expected;
		this.tieBreak = state.tieBreak;
		this.clock = clockLeft(state);
		this.score = state.score;
		this.lives = state.lives;
		this.streak = state.streak;
		this.bestStreak = state.bestStreak;
		this.pace = paceLevel(state.streak);
		this.multiplier = multiplier(state.streak);
		this.correct = state.correct;
		this.tieBreaks = state.tieBreaks;
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
