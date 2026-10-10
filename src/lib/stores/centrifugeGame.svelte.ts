/*
 * Centrifuge Spin game store: wraps the pure dial and scare logic with the player's one button,
 * floating notices, sounds and the personal best. The simulation state is a plain object; only
 * what the page shows is reactive, synced after every step.
 */
import { STARTING_LIVES, difficultyAt } from '#lib/game/centrifuge/config.js';
import { isOutOfBand } from '#lib/game/centrifuge/dial.js';
import type { Scare } from '#lib/game/centrifuge/scares.js';
import {
	createGame,
	type CentrifugeEvent,
	type CentrifugeState
} from '#lib/game/centrifuge/state.js';
import { press, stepGame } from '#lib/game/centrifuge/step.js';
import { multiplierFor } from '#lib/game/centrifuge/scoring.js';
import { createRandom, randomSeed, type Random } from '#lib/game/random.js';
import { highscores, type Highscores } from '#lib/services/highscore.js';
import { soundManager } from '#lib/sound/soundManager.svelte.js';
import type { SoundId } from '#lib/sound/sounds.js';

export type CentrifugeStatus = 'ready' | 'playing' | 'paused' | 'over';

export const SCORE_KEY = ['centrifuge', 'score'] as const;

/** How long a floating notice stays on screen, and how long the face stays startled */
const POPUP_MS = 1200;
const STARTLED_MS = 1100;
/** Shortest time between two plays of a frequent sound */
const SOUND_GAP_MS = 120;

export type PopupKind = 'calm' | 'fix' | 'overreact' | 'meltdown';

export interface Popup {
	id: number;
	kind: PopupKind;
	/** Points for the good ones, empty for the bad ones (they carry a heart) */
	points: number;
	ageMs: number;
}

export interface CentrifugeOptions {
	reducedMotion?: boolean;
	/** Injected for tests; defaults to the browser's local high scores */
	scores?: () => Highscores;
	/** Fixed seed for tests; a fresh random seed per run otherwise */
	seed?: () => number;
}

export class CentrifugeGame {
	status = $state<CentrifugeStatus>('ready');
	score = $state(0);
	lives = $state(STARTING_LIVES);
	streak = $state(0);
	bestStreak = $state(0);
	multiplier = $state(1);
	/** Needle position, -1 to 1 */
	dialValue = $state(0);
	/** A real drift has pushed the needle out of the safe band: the one moment to act */
	outOfBand = $state(false);
	/** The scares on screen right now; replaced (not mutated) when one starts or ends */
	scares = $state.raw<readonly Scare[]>([]);
	popups = $state.raw<readonly Popup[]>([]);
	/** Counts up whenever a heart is lost, so the field can flash */
	hurtCount = $state(0);
	/** The face looks startled for a moment after a heart is lost */
	startled = $state(false);
	/** Scares sat through, which also picks the calm line the face says */
	calmScares = $state(0);
	fixes = $state(0);
	overreactions = $state(0);
	meltdowns = $state(0);
	best = $state<number | null>(null);
	isNewBest = $state(false);

	/** Simulation state, deliberately not reactive */
	state: CentrifugeState;

	readonly reducedMotion: boolean;
	#random: Random = createRandom(1);
	#scores: () => Highscores;
	#seed: () => number;
	#clock = 0;
	#lastSound: Partial<Record<SoundId, number>> = {};
	#nextPopup = 1;
	#startledMs = 0;

	constructor({
		reducedMotion = false,
		scores = highscores,
		seed = randomSeed
	}: CentrifugeOptions = {}) {
		this.reducedMotion = reducedMotion;
		this.#scores = scores;
		this.#seed = seed;
		this.state = createGame();
		this.#sync();
	}

	/** Reads the stored best; call in the browser only */
	loadBest() {
		this.best = this.#scores().get(SCORE_KEY);
	}

	start() {
		this.#random = createRandom(this.#seed());
		this.state = createGame();
		this.scares = [];
		this.popups = [];
		this.startled = false;
		this.#startledMs = 0;
		this.#clock = 0;
		this.#lastSound = {};
		this.isNewBest = false;
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

	/** The one button: stabilize the dial (right only once the needle has left the safe band) */
	press() {
		if (this.status !== 'playing') return;
		this.#apply(press(this.state, this.#random));
	}

	/** One fixed step: called by the page loop */
	update(dtMs: number) {
		if (this.status !== 'playing') return;
		this.#clock += dtMs;
		this.#age(dtMs);
		this.#apply(stepGame(this.state, this.#random, dtMs));
	}

	/** How far into the run the difficulty is, 0 to 1 (for tests and the HUD) */
	get difficulty(): number {
		return difficultyAt(this.state.timeMs);
	}

	#apply(events: readonly CentrifugeEvent[]) {
		for (const event of events) this.#handle(event);
		this.#sync();
	}

	#handle(event: CentrifugeEvent) {
		switch (event.type) {
			case 'scare-start':
				this.scares = [...this.scares, event.scare];
				this.#play(
					event.scare.kind === 'siren'
						? 'alarm'
						: event.scare.kind === 'banner'
							? 'fake-news'
							: 'thud',
					0
				);
				break;
			case 'scare-end':
				this.scares = this.scares.filter((scare) => scare.id !== event.scare.id);
				if (event.points > 0) {
					this.#popup('calm', event.points);
					this.#play('chime', SOUND_GAP_MS);
				}
				break;
			case 'band-exit':
				this.#play('ding', 0);
				break;
			case 'fix':
				this.#popup('fix', event.points);
				this.#play('pickup', 0);
				break;
			case 'overreact':
				this.#hurt();
				this.#popup('overreact', 0);
				this.#play('ui-error', 0);
				break;
			case 'meltdown':
				this.#hurt();
				this.#popup('meltdown', 0);
				this.#play('explosion-small', 0);
				break;
			case 'game-over':
				this.#finish();
				break;
			case 'drift-start':
				break;
		}
	}

	#hurt() {
		this.hurtCount += 1;
		this.#startledMs = STARTLED_MS;
		this.startled = true;
	}

	#popup(kind: PopupKind, points: number) {
		const popup: Popup = { id: this.#nextPopup++, kind, points, ageMs: 0 };
		this.popups = [...this.popups.slice(-3), popup];
	}

	/** Plays a sound unless the same one played within the gap */
	#play(id: SoundId, gapMs: number) {
		const last = this.#lastSound[id];
		if (last !== undefined && gapMs > 0 && this.#clock - last < gapMs) return;
		this.#lastSound[id] = this.#clock;
		soundManager().play(id);
	}

	#age(dtMs: number) {
		if (this.#startledMs > 0) {
			this.#startledMs = Math.max(0, this.#startledMs - dtMs);
			if (this.#startledMs === 0) this.startled = false;
		}
		if (this.popups.length === 0) return;
		for (const popup of this.popups) popup.ageMs += dtMs;
		const alive = this.popups.filter((popup) => popup.ageMs < POPUP_MS);
		// Only replace the list when something left, so the page is not redrawn for nothing
		if (alive.length !== this.popups.length) this.popups = alive;
	}

	#sync() {
		const { state } = this;
		this.score = state.score;
		this.lives = state.lives;
		this.streak = state.streak;
		this.bestStreak = state.bestStreak;
		this.multiplier = multiplierFor(state.streak);
		this.dialValue = state.dial.value;
		this.outOfBand = isOutOfBand(state.dial);
		this.calmScares = state.calmScares;
		this.fixes = state.fixes;
		this.overreactions = state.overreactions;
		this.meltdowns = state.meltdowns;
	}

	#finish() {
		this.#sync();
		this.scares = [];
		const result = this.#scores().submit(SCORE_KEY, this.state.score);
		this.isNewBest = result.isNewBest;
		this.best = result.best;
		this.status = 'over';
	}
}
