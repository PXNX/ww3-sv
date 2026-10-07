/*
 * Radar Slice game store: wraps the pure step logic with the player's swipes, visual effects,
 * sounds and personal bests. The simulation state is a plain object read by the canvas every
 * frame; only what the page chrome shows is reactive, synced after each step.
 */
import { STARTING_LIVES, specOf } from '#lib/game/slice/config.js';
import { drawScenePreview, type Effect, type SceneExtras } from '#lib/game/slice/render.js';
import { createGame, type SliceEvent, type SliceState } from '#lib/game/slice/state.js';
import { sliceWithTrail, stepGame } from '#lib/game/slice/step.js';
import { addTrailPoint, beginSwipe } from '#lib/game/slice/trail.js';
import { createRandom, randomSeed, type Random } from '#lib/game/random.js';
import { highscores, type Highscores } from '#lib/services/highscore.js';
import { soundManager } from '#lib/sound/soundManager.svelte.js';
import type { SoundId } from '#lib/sound/sounds.js';

export type SliceStatus = 'ready' | 'playing' | 'paused' | 'over';

const SCORE_KEY = ['slice', 'score'] as const;
const COMBO_KEY = ['slice', 'combo'] as const;

/** Shortest time between two plays of a frequent sound */
const SOUND_GAP_MS = 90;

export interface SliceOptions {
	reducedMotion?: boolean;
	/** Injected for tests; defaults to the browser's local high scores */
	scores?: () => Highscores;
	/** Fixed seed for tests; a fresh random seed per run otherwise */
	seed?: () => number;
}

export class SliceGame {
	status = $state<SliceStatus>('ready');
	score = $state(0);
	lives = $state(STARTING_LIVES);
	sliced = $state(0);
	missed = $state(0);
	decoysHit = $state(0);
	bestCombo = $state(0);
	/** Counts up whenever a heart is lost, so the field can flash */
	hurtCount = $state(0);
	best = $state<number | null>(null);
	bestComboEver = $state<number | null>(null);
	isNewBest = $state(false);

	/** Simulation state, deliberately not reactive */
	state: SliceState = createGame();
	effects: Effect[] = [];

	readonly reducedMotion: boolean;
	#random: Random = createRandom(1);
	#scores: () => Highscores;
	#seed: () => number;
	#soundClock = 0;
	#lastSound: Partial<Record<SoundId, number>> = {};

	constructor({
		reducedMotion = false,
		scores = highscores,
		seed = randomSeed
	}: SliceOptions = {}) {
		this.reducedMotion = reducedMotion;
		this.#scores = scores;
		this.#seed = seed;
		this.#syncChrome();
	}

	/** Reads the stored bests; call in the browser only */
	loadBest() {
		this.best = this.#scores().get(SCORE_KEY);
		this.bestComboEver = this.#scores().get(COMBO_KEY);
	}

	start() {
		this.#random = createRandom(this.#seed());
		this.state = createGame();
		this.effects = [];
		this.isNewBest = false;
		this.#soundClock = 0;
		this.#lastSound = {};
		this.#syncChrome();
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

	/** A press on the field at a world position starts a new swipe (a tap alone can cut) */
	pointerDown(x: number, y: number) {
		if (this.status !== 'playing') return;
		beginSwipe(this.state.trail, { x, y }, this.state.timeMs);
		this.#cutNow();
	}

	/** The pointer moved: extend the trail and test it right away, before the next frame */
	pointerMove(x: number, y: number) {
		if (this.status !== 'playing' || this.state.trail.points.length === 0) return;
		addTrailPoint(this.state.trail, { x, y }, this.state.timeMs);
		this.#cutNow();
	}

	/** One fixed step: called by the canvas game loop */
	update(dtMs: number) {
		this.#ageEffects(dtMs);
		if (this.status !== 'playing') return;
		this.#soundClock += dtMs;
		for (const event of stepGame(this.state, this.#random, dtMs)) this.#handle(event);
		this.#syncChrome();
	}

	sceneExtras(): SceneExtras {
		return { effects: this.effects, reducedMotion: this.reducedMotion };
	}

	/** Draws the final field onto the shared score card */
	drawBoard = (context: CanvasRenderingContext2D, x: number, y: number, size: number) => {
		drawScenePreview(context, this.state, x, y, size);
	};

	#cutNow() {
		for (const event of sliceWithTrail(this.state)) this.#handle(event);
		this.#syncChrome();
	}

	#handle(event: SliceEvent) {
		const short = this.reducedMotion ? 0.5 : 1;
		switch (event.type) {
			case 'launched':
				this.#play('whoosh', 160);
				break;
			case 'sliced': {
				this.effects.push({
					kind: 'puff',
					x: event.x,
					y: event.y,
					size: specOf(event.kind).radius * 0.9,
					ageMs: 0,
					durationMs: 360 * short + 80
				});
				this.effects.push({
					kind: 'popup',
					x: event.x,
					y: event.y,
					text: `+${event.points}`,
					big: false,
					ageMs: 0,
					durationMs: 650 * short + 150
				});
				if (event.chain >= 2) {
					this.effects.push({
						kind: 'popup',
						x: event.x,
						y: event.y - 22,
						text: `x${event.chain}`,
						big: true,
						ageMs: 0,
						durationMs: 800 * short + 150
					});
					this.#play('chime', 0);
				} else {
					this.#play('pop', SOUND_GAP_MS);
				}
				break;
			}
			case 'decoy-hit':
				this.hurtCount += 1;
				this.effects.push({
					kind: 'puff',
					x: event.x,
					y: event.y,
					size: specOf(event.kind).radius,
					ageMs: 0,
					durationMs: 420 * short + 80
				});
				this.effects.push({
					kind: 'popup',
					x: event.x,
					y: event.y,
					text: '-1 ♥',
					big: true,
					ageMs: 0,
					durationMs: 900 * short + 150
				});
				this.#play('ui-error', 0);
				break;
			case 'missed':
				this.hurtCount += 1;
				this.effects.push({
					kind: 'splash',
					x: event.x,
					y: event.y - 10,
					ageMs: 0,
					durationMs: 600 * short + 100
				});
				this.#play('thud', SOUND_GAP_MS);
				break;
			case 'game-over':
				this.#finish();
				break;
		}
	}

	/** Plays a sound unless the same one played within the gap */
	#play(id: SoundId, gapMs: number) {
		const last = this.#lastSound[id];
		if (last !== undefined && gapMs > 0 && this.#soundClock - last < gapMs) return;
		this.#lastSound[id] = this.#soundClock;
		soundManager().play(id);
	}

	#ageEffects(dtMs: number) {
		if (this.status !== 'playing') return;
		for (const effect of this.effects) effect.ageMs += dtMs;
		this.effects = this.effects.filter((effect) => effect.ageMs < effect.durationMs);
	}

	#syncChrome() {
		this.score = this.state.score;
		this.lives = this.state.lives;
		this.sliced = this.state.sliced;
		this.missed = this.state.missed;
		this.decoysHit = this.state.decoysHit;
		this.bestCombo = this.state.bestCombo;
	}

	#finish() {
		this.#syncChrome();
		const scoreResult = this.#scores().submit(SCORE_KEY, this.state.score);
		const comboResult = this.#scores().submit(COMBO_KEY, this.state.bestCombo);
		this.isNewBest = scoreResult.isNewBest;
		this.best = scoreResult.best;
		this.bestComboEver = comboResult.best;
		this.status = 'over';
	}
}
