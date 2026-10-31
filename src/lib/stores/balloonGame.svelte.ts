/*
 * Wandering Balloon game store: wraps the pure rules with the burner input, popups, sounds and
 * personal bests. The simulation state is a plain object the canvas reads every frame; only what
 * the page chrome shows (score, hearts, fuel, progress, photos) is reactive, synced after each step.
 */
import { BALLOON_X, FLOOR_Y, STARTING_LIVES, TRACK_LENGTH } from '#lib/game/balloon/config.js';
import { drawScenePreview, type Effect, type SceneExtras } from '#lib/game/balloon/render.js';
import {
	createGame,
	setBurner,
	step,
	type BalloonEvent,
	type BalloonState
} from '#lib/game/balloon/state.js';
import { createRandom, randomSeed, type Random } from '#lib/game/random.js';
import { m } from '#lib/paraglide/messages.js';
import { highscores, type Highscores } from '#lib/services/highscore.js';
import { soundManager } from '#lib/sound/soundManager.svelte.js';
import type { SoundId } from '#lib/sound/sounds.js';
import { hitText } from '#lib/components/balloonText.js';

export type BalloonStatus = 'ready' | 'playing' | 'paused' | 'over';

export const SCORE_KEY = ['balloon', 'score'] as const;
export const DISTANCE_KEY = ['balloon', 'distance'] as const;

export interface BalloonOptions {
	reducedMotion?: boolean;
	/** Injected for tests; defaults to the browser's local high scores */
	scores?: () => Highscores;
	/** Fixed seed for tests; a fresh random seed per run otherwise */
	seed?: () => number;
}

export class BalloonGame {
	status = $state<BalloonStatus>('ready');
	score = $state(0);
	lives = $state(STARTING_LIVES);
	/** Burner fuel, 0 to 100 */
	fuelPercent = $state(100);
	/** Share of the track flown, 0 to 100 */
	progressPercent = $state(0);
	photos = $state(0);
	/** Whether the burner is firing right now (held and fuel left) */
	burning = $state(false);
	/** Counts up whenever a heart is lost, so the field can flash */
	hurtCount = $state(0);
	best = $state<number | null>(null);
	bestDistance = $state<number | null>(null);
	isNewBest = $state(false);
	/** Whether the run ended at the east coast rather than in the sky */
	finished = $state(false);
	finishBonus = $state(0);

	/** Simulation state, deliberately not reactive */
	state: BalloonState;
	effects: Effect[] = [];

	readonly reducedMotion: boolean;
	#random: Random = createRandom(1);
	#scores: () => Highscores;
	#seed: () => number;
	#held = false;

	constructor({
		reducedMotion = false,
		scores = highscores,
		seed = randomSeed
	}: BalloonOptions = {}) {
		this.reducedMotion = reducedMotion;
		this.#scores = scores;
		this.#seed = seed;
		this.state = createGame(this.#random);
		this.#syncChrome();
	}

	/** Reads the stored bests; call in the browser only */
	loadBest() {
		this.best = this.#scores().get(SCORE_KEY);
		this.bestDistance = this.#scores().get(DISTANCE_KEY);
	}

	start() {
		this.#random = createRandom(this.#seed());
		this.state = createGame(this.#random);
		this.effects = [];
		this.isNewBest = false;
		this.hurtCount = 0;
		this.#held = false;
		this.#syncChrome();
		this.status = 'playing';
	}

	pause() {
		if (this.status !== 'playing') return;
		// Letting go is safest: the burner never keeps firing behind the pause screen
		this.#held = false;
		setBurner(this.state, false);
		this.status = 'paused';
	}

	resume() {
		if (this.status === 'paused') this.status = 'playing';
	}

	togglePause() {
		if (this.status === 'playing') this.pause();
		else this.resume();
	}

	/** The back link during a run: ends it as a loss */
	forfeit() {
		if (this.status !== 'playing' && this.status !== 'paused') return;
		this.#finish(false);
	}

	/** The burner button: held down climbs, released sinks */
	burner(on: boolean) {
		if (this.status !== 'playing') on = false;
		this.#held = on;
		setBurner(this.state, on);
		this.burning = this.state.burning && this.state.fuel > 0;
	}

	/** One fixed step: called by the canvas game loop */
	update(dtMs: number) {
		this.#ageEffects(dtMs);
		if (this.status !== 'playing') return;
		for (const event of step(this.state, dtMs, this.#random)) this.#handle(event);
		this.#syncChrome();
	}

	sceneExtras(): SceneExtras {
		return { effects: this.effects, reducedMotion: this.reducedMotion };
	}

	/** Draws the final scene onto the shared score card */
	drawBoard = (context: CanvasRenderingContext2D, x: number, y: number, size: number) => {
		drawScenePreview(context, this.state, x, y, size);
	};

	#handle(event: BalloonEvent) {
		switch (event.type) {
			case 'hit':
				this.hurtCount += 1;
				this.#popup(hitText(event.kind), false);
				this.#play(event.kind === 'cloud' ? 'thunder' : 'hit');
				break;
			case 'puff':
				this.#popup(m.balloon_popup_puff(), false);
				this.#play('pickup');
				break;
			case 'photo':
				this.#popup(m.balloon_popup_photo({ points: event.points }), true);
				this.#bubble(m.balloon_caption());
				this.#play('sparkle');
				break;
			case 'jet-warning':
				this.#popup(m.balloon_popup_jet_warning(), false);
				this.#play('alarm');
				break;
			case 'finish':
				this.#popup(m.balloon_popup_finish(), true);
				this.#play('whoosh');
				break;
			case 'popped':
				this.finishBonus = event.bonus;
				this.#popup(m.balloon_popup_popped({ bonus: event.bonus }), true);
				this.#play('explosion-tiny');
				break;
			case 'game-over':
				this.#finish(event.finished);
				break;
		}
	}

	#popup(text: string, big: boolean) {
		const short = this.reducedMotion ? 0.5 : 1;
		this.effects.push({
			kind: 'popup',
			x: BALLOON_X,
			y: Math.max(40, Math.min(FLOOR_Y, this.state.y - 36)),
			text,
			big,
			ageMs: 0,
			durationMs: 1300 * short + 200
		});
	}

	#bubble(text: string) {
		this.effects.push({
			kind: 'bubble',
			x: BALLOON_X + 40,
			y: Math.max(24, this.state.y - 70),
			text,
			ageMs: 0,
			durationMs: 1800 * (this.reducedMotion ? 0.7 : 1) + 200
		});
	}

	#play(id: SoundId) {
		soundManager().play(id);
	}

	#ageEffects(dtMs: number) {
		if (this.status !== 'playing') return;
		for (const effect of this.effects) effect.ageMs += dtMs;
		this.effects = this.effects.filter((effect) => effect.ageMs < effect.durationMs);
	}

	#syncChrome() {
		const state = this.state;
		this.score = state.score;
		this.lives = state.lives;
		this.fuelPercent = Math.round(state.fuel * 100);
		this.progressPercent = Math.min(100, Math.floor((state.distance / TRACK_LENGTH) * 100));
		this.photos = state.photos;
		this.burning = this.#held && state.burning && state.fuel > 0;
		this.finished = state.finished;
	}

	#finish(finished: boolean) {
		this.finished = finished;
		this.#held = false;
		this.#syncChrome();
		const scoreResult = this.#scores().submit(SCORE_KEY, this.state.score);
		const distanceResult = this.#scores().submit(DISTANCE_KEY, Math.round(this.state.distance));
		this.isNewBest = scoreResult.isNewBest;
		this.best = scoreResult.best;
		this.bestDistance = distanceResult.best;
		this.status = 'over';
	}
}
