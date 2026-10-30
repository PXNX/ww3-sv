/*
 * Gold & Cheese Vault game store: wraps the pure rules with the banker's reactions, the phone
 * ringing and shuffle animation, toasts, sounds and personal bests. The rules live in a plain
 * state object; only what the page shows (cards, score, hearts, eyebrows) is reactive, and it is
 * synced after every event, not every frame.
 */
import { STARTING_LIVES } from '#lib/game/vault/config.js';
import type { BankerMood } from '#lib/game/vault/banker.js';
import type { Card } from '#lib/game/vault/deck.js';
import {
	createGame,
	flipCard,
	stepGame,
	type VaultEvent,
	type VaultPhase,
	type VaultState
} from '#lib/game/vault/state.js';
import { createRandom, randomSeed, type Random } from '#lib/game/random.js';
import { m } from '#lib/paraglide/messages.js';
import { highscores, type Highscores } from '#lib/services/highscore.js';
import { soundManager } from '#lib/sound/soundManager.svelte.js';
import type { SoundId } from '#lib/sound/sounds.js';

export type VaultStatus = 'ready' | 'playing' | 'paused' | 'over';

export const SCORE_KEY = ['vault', 'score'] as const;
export const LEVEL_KEY = ['vault', 'level'] as const;

const TOAST_MS = 1500;
const MOOD_MS = 1800;
const SHUFFLE_ANIM_MS = 900;
const WRONG_MS = 600;
/** The phone rings (plays its sound) this often while it is ringing */
const RING_SOUND_MS = 420;

export interface Toast {
	id: number;
	text: string;
}

export interface VaultOptions {
	reducedMotion?: boolean;
	/** Injected for tests; defaults to the browser's local high scores */
	scores?: () => Highscores;
	/** Fixed seed for tests; a fresh random seed per run otherwise */
	seed?: () => number;
}

export class VaultGame {
	status = $state<VaultStatus>('ready');
	phase = $state<VaultPhase>('play');
	score = $state(0);
	lives = $state(STARTING_LIVES);
	level = $state(1);
	cols = $state(4);
	rows = $state(4);
	cards = $state.raw<Card[]>([]);
	/** The banker's raised eyebrows, 0 to 2 (the third one costs a heart and resets this) */
	eyebrows = $state(0);
	/** Whether the phone is ringing right now */
	ringing = $state(false);
	/** Cards that were just shuffled by a phone call and are still wobbling */
	shuffled = $state.raw<number[]>([]);
	/** The pair that just failed to match */
	wrong = $state.raw<number[]>([]);
	/** Counts up whenever a heart is lost, so the field can flash */
	hurtCount = $state(0);
	levelsCleared = $state(0);
	specialPairs = $state(0);
	streak = $state(0);
	toast = $state.raw<Toast | null>(null);
	mood = $state<BankerMood>('neutral');
	best = $state<number | null>(null);
	bestLevel = $state<number | null>(null);
	isNewBest = $state(false);

	/** Rules state, deliberately not reactive */
	state: VaultState;

	readonly reducedMotion: boolean;
	#random: Random = createRandom(1);
	#scores: () => Highscores;
	#seed: () => number;
	#clockMs = 0;
	#toastMs = 0;
	#toastId = 0;
	#moodMs = 0;
	#shuffledMs = 0;
	#wrongMs = 0;
	#ringSoundMs = 0;
	#lastSound: Partial<Record<SoundId, number>> = {};

	constructor({
		reducedMotion = false,
		scores = highscores,
		seed = randomSeed
	}: VaultOptions = {}) {
		this.reducedMotion = reducedMotion;
		this.#scores = scores;
		this.#seed = seed;
		this.state = createGame(this.#random);
		this.#sync();
	}

	/** Reads the stored bests; call in the browser only */
	loadBest() {
		this.best = this.#scores().get(SCORE_KEY);
		this.bestLevel = this.#scores().get(LEVEL_KEY);
	}

	start() {
		this.#random = createRandom(this.#seed());
		this.state = createGame(this.#random);
		this.toast = null;
		this.mood = 'neutral';
		this.shuffled = [];
		this.wrong = [];
		this.isNewBest = false;
		this.hurtCount = 0;
		this.#clockMs = 0;
		this.#toastMs = 0;
		this.#moodMs = 0;
		this.#shuffledMs = 0;
		this.#wrongMs = 0;
		this.#ringSoundMs = 0;
		this.#lastSound = {};
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

	/** The player taps the card at an index */
	flip(index: number) {
		if (this.status !== 'playing') return;
		const events = flipCard(this.state, index);
		for (const event of events) this.#handle(event);
		if (events.length > 0) this.#sync();
	}

	/** One fixed step: called by the game loop */
	update(dtMs: number) {
		if (this.status !== 'playing') return;
		this.#clockMs += dtMs;
		this.#age(dtMs);
		const events = stepGame(this.state, dtMs, this.#random);
		for (const event of events) this.#handle(event);
		if (this.state.ringMs > 0 && (this.#ringSoundMs -= dtMs) <= 0) {
			this.#ringSoundMs = RING_SOUND_MS;
			this.#play('ding', 0);
		}
		if (events.length > 0) this.#sync();
	}

	/** Draws the vault onto the shared score card: matched cards gold, the others slate */
	drawBoard = (context: CanvasRenderingContext2D, x: number, y: number, size: number) => {
		const { cols, rows, cards } = this.state;
		const gap = size * 0.03;
		const cell = Math.min((size - gap * (cols + 1)) / cols, (size - gap * (rows + 1)) / rows);
		const left = x + (size - (cell * cols + gap * (cols - 1))) / 2;
		const top = y + (size - (cell * rows + gap * (rows - 1))) / 2;
		context.lineWidth = Math.max(2, size * 0.012);
		context.strokeStyle = '#111111';
		cards.forEach((card, i) => {
			const cx = left + (i % cols) * (cell + gap);
			const cy = top + Math.floor(i / cols) * (cell + gap);
			context.fillStyle =
				card.state === 'matched' ? '#f5c83a' : card.state === 'up' ? '#ffffff' : '#6a7c9b';
			context.beginPath();
			context.roundRect(cx, cy, cell, cell, cell * 0.18);
			context.fill();
			context.stroke();
		});
	};

	#handle(event: VaultEvent) {
		switch (event.type) {
			case 'flip':
				this.#play('click', 0);
				break;
			case 'match':
				if (event.special) {
					this.#showToast(m.vault_popup_special({ points: event.points }));
					this.#setMood('twitch');
					this.#play('chime-big', 0);
				} else {
					this.#showToast(
						event.streak > 1
							? m.vault_popup_streak({ count: event.streak, points: event.points })
							: m.vault_popup_match({ points: event.points })
					);
					this.#play('pop', 0);
				}
				break;
			case 'mismatch':
				this.wrong = [...event.indices];
				this.#wrongMs = WRONG_MS * (this.reducedMotion ? 0.5 : 1);
				if (event.heartLost) {
					this.hurtCount += 1;
					this.#showToast(m.vault_popup_heart());
					this.#setMood('glare');
					this.#play('alarm', 0);
				} else {
					this.#showToast(m.vault_popup_eyebrow({ count: event.eyebrows }));
					this.#play('ui-error', 0);
				}
				break;
			case 'calm':
				this.#showToast(m.vault_popup_calm());
				break;
			case 'ring':
				this.#ringSoundMs = 0;
				this.#showToast(m.vault_popup_ring());
				break;
			case 'shuffle':
				if (event.indices.length > 0) {
					this.shuffled = event.indices;
					this.#shuffledMs = SHUFFLE_ANIM_MS * (this.reducedMotion ? 0.5 : 1);
					this.#showToast(m.vault_popup_shuffle({ count: event.indices.length }));
					this.#play('whoosh', 0);
				}
				break;
			case 'level-clear':
				this.#showToast(
					event.flawless
						? m.vault_popup_clear_flawless({ level: event.level, bonus: event.bonus })
						: m.vault_popup_clear({ level: event.level, bonus: event.bonus })
				);
				this.#play('sparkle', 0);
				break;
			case 'unflip':
				this.wrong = [];
				break;
			case 'level':
				this.shuffled = [];
				this.wrong = [];
				break;
			case 'game-over':
				this.#sync();
				this.#finish();
				break;
		}
	}

	#setMood(mood: BankerMood) {
		this.mood = mood;
		this.#moodMs = MOOD_MS;
	}

	#showToast(text: string) {
		this.toast = { id: ++this.#toastId, text };
		this.#toastMs = TOAST_MS * (this.reducedMotion ? 0.7 : 1);
	}

	#play(id: SoundId, gapMs: number) {
		const last = this.#lastSound[id];
		if (last !== undefined && gapMs > 0 && this.#clockMs - last < gapMs) return;
		this.#lastSound[id] = this.#clockMs;
		soundManager().play(id);
	}

	/** Ages the toast, the banker's mood and the card animations */
	#age(dtMs: number) {
		if (this.toast && (this.#toastMs -= dtMs) <= 0) this.toast = null;
		if (this.mood !== 'neutral' && (this.#moodMs -= dtMs) <= 0) this.mood = 'neutral';
		if (this.shuffled.length > 0 && (this.#shuffledMs -= dtMs) <= 0) this.shuffled = [];
		if (this.wrong.length > 0 && (this.#wrongMs -= dtMs) <= 0) this.wrong = [];
	}

	#sync() {
		const state = this.state;
		this.phase = state.phase;
		this.score = state.score;
		this.lives = state.lives;
		this.level = state.level;
		this.cols = state.cols;
		this.rows = state.rows;
		this.cards = state.cards.map((card) => ({ ...card }));
		this.eyebrows = state.eyebrows;
		this.ringing = state.ringMs > 0;
		this.levelsCleared = state.levelsCleared;
		this.specialPairs = state.specialPairs;
		this.streak = state.streak;
	}

	#finish() {
		const scoreResult = this.#scores().submit(SCORE_KEY, this.state.score);
		const levelResult = this.#scores().submit(LEVEL_KEY, this.state.level);
		this.isNewBest = scoreResult.isNewBest;
		this.best = scoreResult.best;
		this.bestLevel = levelResult.best;
		this.ringing = false;
		this.status = 'over';
	}
}
