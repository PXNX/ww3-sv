/*
 * Suez Stuck game store: wraps the pure rules with the player's fingers, visual effects, sounds
 * and personal bests. The simulation state is a plain object the canvas reads every frame; only
 * what the page chrome shows (score, hearts, stuck meter, queue, excavator) is reactive, synced
 * after each step.
 */
import {
	DIG_ANIMATION_MS,
	STARTING_LIVES,
	TILE,
	WORLD_HEIGHT,
	WORLD_WIDTH
} from '#lib/game/suez/config.js';
import { endPoint } from '#lib/game/suez/body.js';
import { drawScenePreview, type Effect, type SceneExtras } from '#lib/game/suez/render.js';
import {
	createGame,
	excavatorSeconds,
	movePointer,
	pressAt,
	releasePointer,
	stepGame,
	stuckFraction,
	type PressResult,
	type SuezEvent,
	type SuezState
} from '#lib/game/suez/state.js';
import { createRandom, randomSeed, type Random } from '#lib/game/random.js';
import { m } from '#lib/paraglide/messages.js';
import { highscores, type Highscores } from '#lib/services/highscore.js';
import { soundManager } from '#lib/sound/soundManager.svelte.js';
import type { SoundId } from '#lib/sound/sounds.js';

export type SuezStatus = 'ready' | 'playing' | 'paused' | 'over';

export const SCORE_KEY = ['suez', 'score'] as const;
export const CANALS_KEY = ['suez', 'canals'] as const;

/** Shortest time between two plays of a frequent sound */
const SOUND_GAP_MS = 160;

export interface SuezOptions {
	reducedMotion?: boolean;
	/** Injected for tests; defaults to the browser's local high scores */
	scores?: () => Highscores;
	/** Fixed seed for tests; a fresh random seed per run otherwise */
	seed?: () => number;
}

export class SuezGame {
	status = $state<SuezStatus>('ready');
	score = $state(0);
	lives = $state(STARTING_LIVES);
	level = $state(1);
	/** The stuck meter, 0 to 100 */
	stuckPercent = $state(100);
	waiting = $state(0);
	/** Seconds until the excavator can dig again; 0 when it is ready */
	excavatorWait = $state(0);
	canalsCleared = $state(0);
	shipsReleased = $state(0);
	/** Counts up whenever a heart is lost, so the field can flash */
	hurtCount = $state(0);
	best = $state<number | null>(null);
	bestCanals = $state<number | null>(null);
	isNewBest = $state(false);

	/** Simulation state, deliberately not reactive */
	state: SuezState;
	effects: Effect[] = [];
	/** Real time in milliseconds since the run started, for the water ripples */
	clockMs = 0;

	readonly reducedMotion: boolean;
	#random: Random = createRandom(1);
	#scores: () => Highscores;
	#seed: () => number;
	#lastSound: Partial<Record<SoundId, number>> = {};

	constructor({ reducedMotion = false, scores = highscores, seed = randomSeed }: SuezOptions = {}) {
		this.reducedMotion = reducedMotion;
		this.#scores = scores;
		this.#seed = seed;
		this.state = createGame(this.#random);
		this.#syncChrome();
	}

	/** Reads the stored bests; call in the browser only */
	loadBest() {
		this.best = this.#scores().get(SCORE_KEY);
		this.bestCanals = this.#scores().get(CANALS_KEY);
	}

	start() {
		this.#random = createRandom(this.#seed());
		this.state = createGame(this.#random);
		this.effects = [];
		this.isNewBest = false;
		this.clockMs = 0;
		this.#lastSound = {};
		this.#syncChrome();
		this.status = 'playing';
	}

	pause() {
		if (this.status !== 'playing') return;
		// Fingers that were holding the ship let go: nothing is dragged while the game is stopped
		this.state.holds = [];
		this.status = 'paused';
	}

	resume() {
		if (this.status === 'paused') this.status = 'playing';
	}

	togglePause() {
		if (this.status === 'playing') this.pause();
		else this.resume();
	}

	/** A press on the field at a world position: grabs an end or calls the excavator */
	press(pointerId: number, x: number, y: number, pointerType: string): PressResult {
		if (this.status !== 'playing') return { kind: 'none' };
		const result = pressAt(this.state, pointerId, { x, y }, pointerType);
		switch (result.kind) {
			case 'grab':
				this.#play('ui-tap', SOUND_GAP_MS / 2);
				break;
			case 'dig': {
				this.#play('break-stone', 0);
				for (const tile of result.tiles) {
					this.#dust((tile.col + 0.5) * TILE, (tile.row + 0.5) * TILE, 7);
				}
				break;
			}
			case 'cooldown':
				this.#play('ui-error', SOUND_GAP_MS);
				break;
			default:
				break;
		}
		this.#syncChrome();
		return result;
	}

	move(pointerId: number, x: number, y: number) {
		if (this.status !== 'playing') return;
		movePointer(this.state, pointerId, { x, y });
	}

	release(pointerId: number) {
		releasePointer(this.state, pointerId);
	}

	/** One fixed step: called by the canvas game loop */
	update(dtMs: number) {
		this.#ageEffects(dtMs);
		if (this.status !== 'playing') return;
		this.clockMs += dtMs;
		for (const event of stepGame(this.state, this.#random, dtMs)) this.#handle(event);
		this.#syncChrome();
	}

	sceneExtras(): SceneExtras {
		return { effects: this.effects, reducedMotion: this.reducedMotion, timeMs: this.clockMs };
	}

	/** Draws the final field onto the shared score card */
	drawBoard = (context: CanvasRenderingContext2D, x: number, y: number, size: number) => {
		drawScenePreview(context, this.state, x, y, size);
	};

	#handle(event: SuezEvent) {
		const short = this.reducedMotion ? 0.5 : 1;
		switch (event.type) {
			case 'bump': {
				const at = this.#contactPoint();
				this.#dust(at.x, at.y, Math.min(9, 3 + event.impact));
				this.#play('thud', SOUND_GAP_MS);
				break;
			}
			case 'arrived':
				this.#play('ding', 0);
				break;
			case 'overflow':
				this.hurtCount += 1;
				this.effects.push({
					kind: 'ring',
					x: WORLD_WIDTH / 2,
					y: WORLD_HEIGHT - 60,
					ageMs: 0,
					durationMs: 500 * short + 100
				});
				this.effects.push({
					kind: 'popup',
					x: WORLD_WIDTH / 2,
					y: WORLD_HEIGHT - 100,
					text: m.suez_popup_overflow(),
					big: false,
					ageMs: 0,
					durationMs: 1400 * short + 200
				});
				this.#play('ui-error', 0);
				break;
			case 'freed':
				this.effects.push({
					kind: 'popup',
					x: this.state.body.x,
					y: this.state.body.y,
					text: m.suez_popup_free(),
					big: true,
					ageMs: 0,
					durationMs: 1300 * short + 200
				});
				this.effects.push({
					kind: 'popup',
					x: this.state.body.x,
					y: this.state.body.y + 28,
					text: `+${event.points}`,
					big: false,
					ageMs: 0,
					durationMs: 1200 * short + 200
				});
				this.#play('chime-big', 0);
				break;
			case 'level-start':
				this.effects.push({
					kind: 'popup',
					x: WORLD_WIDTH / 2,
					y: 90,
					text: m.suez_popup_canal({ level: event.level }),
					big: true,
					ageMs: 0,
					durationMs: 1400 * short + 200
				});
				this.#play('sparkle', 0);
				break;
			case 'game-over':
				this.#finish();
				break;
		}
	}

	/** Where the hull is touching a bank, roughly: the nearer end */
	#contactPoint() {
		const bow = endPoint(this.state.body, 'bow');
		const stern = endPoint(this.state.body, 'stern');
		const edge = (end: { x: number }) => Math.abs(end.x - WORLD_WIDTH / 2);
		return edge(bow) >= edge(stern) ? bow : stern;
	}

	#dust(x: number, y: number, size: number) {
		const count = this.reducedMotion ? 1 : 3;
		for (let i = 0; i < count; i++) {
			this.effects.push({
				kind: 'dust',
				x: x + (i - 1) * 6,
				y: y + (i % 2) * 4,
				size,
				ageMs: 0,
				durationMs: DIG_ANIMATION_MS * (this.reducedMotion ? 0.5 : 1)
			});
		}
	}

	/** Plays a sound unless the same one played within the gap */
	#play(id: SoundId, gapMs: number) {
		const last = this.#lastSound[id];
		if (last !== undefined && gapMs > 0 && this.clockMs - last < gapMs) return;
		this.#lastSound[id] = this.clockMs;
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
		this.level = state.level;
		this.stuckPercent = Math.round(stuckFraction(state) * 100);
		this.waiting = state.queue.waiting;
		this.excavatorWait = excavatorSeconds(state);
		this.canalsCleared = state.canalsCleared;
		this.shipsReleased = state.shipsReleased;
	}

	#finish() {
		this.#syncChrome();
		const scoreResult = this.#scores().submit(SCORE_KEY, this.state.score);
		const canalsResult = this.#scores().submit(CANALS_KEY, this.state.canalsCleared);
		this.isNewBest = scoreResult.isNewBest;
		this.best = scoreResult.best;
		this.bestCanals = canalsResult.best;
		this.status = 'over';
	}
}
