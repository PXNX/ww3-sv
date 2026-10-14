/*
 * GPS Liar store: the level select, the running level, pause, results and the locally stored
 * progress. The simulation (GameState) is a plain object the canvas reads every frame; only what
 * the page chrome shows (hearts, score, deliveries, checks left, status) is reactive and copied
 * after each step.
 */
import { cargoName, hitText } from '#lib/components/gpsliarText.js';
import { STARTING_HEARTS } from '#lib/game/gpsliar/config.js';
import { keyVector, pointerVector } from '#lib/game/gpsliar/input.js';
import type { Vec } from '#lib/game/gpsliar/lie.js';
import { LEVEL_IDS, levelAt } from '#lib/game/gpsliar/levels.js';
import {
	EMPTY_PROGRESS,
	PROGRESS_KEY,
	isGpsLiarProgress,
	isUnlocked,
	recordFinish,
	type GpsLiarProgress
} from '#lib/game/gpsliar/progress.js';
import { drawChartPreview, type Effect, type SceneExtras } from '#lib/game/gpsliar/render.js';
import {
	createGame,
	crossCheck,
	nextStop,
	setSteer,
	step,
	type GameState,
	type GpsLiarEvent
} from '#lib/game/gpsliar/state.js';
import { m } from '#lib/paraglide/messages.js';
import { highscores, type Highscores } from '#lib/services/highscore.js';
import { localStore, type Store } from '#lib/services/storage.js';
import { soundManager } from '#lib/sound/soundManager.svelte.js';
import type { SoundId } from '#lib/sound/sounds.js';
import type { Cargo } from '#lib/game/gpsliar/level.js';

export type GpsLiarScreen = 'select' | 'play';
export type GpsLiarStatus = 'ready' | 'playing' | 'paused' | 'won' | 'over';

export { LEVEL_IDS };

export function highscoreParts(levelId: string): string[] {
	return ['gpsliar', levelId, 'score'];
}

/** How long and how hard (in scene pixels) a hit shakes the view */
const HIT_SHAKE_MS = 320;
const HIT_SHAKE_PX = 7;

export interface GpsLiarOptions {
	reducedMotion?: boolean;
	/** Injected for tests; defaults to the browser's local high scores */
	scores?: () => Highscores;
	/** Injected for tests; defaults to the browser's local storage */
	store?: () => Store;
}

export class GpsLiarGame {
	screen = $state<GpsLiarScreen>('select');
	status = $state<GpsLiarStatus>('ready');
	levelIndex = $state(0);
	hearts = $state(STARTING_HEARTS);
	score = $state(0);
	delivered = $state(0);
	stopsTotal = $state(0);
	crossChecksLeft = $state(0);
	/** Whether the chart shows the true position right now */
	revealing = $state(false);
	/** The cargo the next harbour wants, null once everything is unloaded */
	nextCargo = $state<Cargo | null>(null);
	/** Whole seconds on the clock, and the par time of the level */
	seconds = $state(0);
	par = $state(0);
	crossChecksUsed = $state(0);
	stars = $state(0);
	/** Counts up whenever a heart is lost, so the field can flash */
	hurtCount = $state(0);
	isNewBest = $state(false);
	best = $state<number | null>(null);
	progress = $state<GpsLiarProgress>(EMPTY_PROGRESS);

	/** Simulation state, deliberately not reactive */
	state: GameState;
	effects: Effect[] = [];
	readonly reducedMotion: boolean;

	#scores: () => Highscores;
	#store: () => Store;
	// eslint-disable-next-line svelte/prefer-svelte-reactivity -- bookkeeping only, never rendered
	#keys = new Set<string>();
	#pointer: Vec | null = null;
	#shakeMs = 0;

	constructor({
		reducedMotion = false,
		scores = highscores,
		store = localStore
	}: GpsLiarOptions = {}) {
		this.reducedMotion = reducedMotion;
		this.#scores = scores;
		this.#store = store;
		this.state = createGame(levelAt(0));
	}

	get levelCount(): number {
		return LEVEL_IDS.length;
	}

	get hasNextLevel(): boolean {
		return this.levelIndex + 1 < LEVEL_IDS.length;
	}

	/** Reads the stored progress; call in the browser only */
	load() {
		this.progress = this.#store().read(PROGRESS_KEY, EMPTY_PROGRESS, isGpsLiarProgress);
	}

	isUnlocked(index: number): boolean {
		return isUnlocked(this.progress, LEVEL_IDS, index);
	}

	starsFor(levelId: string): number {
		return this.progress.stars[levelId] ?? 0;
	}

	bestFor(levelId: string): number | null {
		return this.#scores().get(highscoreParts(levelId));
	}

	/** Opens a level on its "ready" screen; locked levels stay shut */
	openLevel(index: number) {
		if (!this.isUnlocked(index) || index < 0 || index >= LEVEL_IDS.length) return;
		const level = levelAt(index);
		this.levelIndex = index;
		this.state = createGame(level);
		this.effects = [];
		this.#clearInput();
		this.isNewBest = false;
		this.stars = 0;
		this.hurtCount = 0;
		this.#shakeMs = 0;
		this.best = this.bestFor(level.id);
		this.screen = 'play';
		this.status = 'ready';
		this.#sync();
	}

	/** The "ready" screen was dismissed: the level starts running */
	start() {
		if (this.status === 'ready') this.status = 'playing';
	}

	retry() {
		this.openLevel(this.levelIndex);
		this.start();
	}

	nextLevel() {
		if (this.hasNextLevel) this.openLevel(this.levelIndex + 1);
	}

	backToSelect() {
		this.#clearInput();
		this.screen = 'select';
		this.status = 'ready';
	}

	pause() {
		if (this.status !== 'playing') return;
		this.#clearInput();
		this.status = 'paused';
	}

	resume() {
		if (this.status === 'paused') this.status = 'playing';
	}

	togglePause() {
		if (this.status === 'playing') this.pause();
		else this.resume();
	}

	/** A steering key goes down or up */
	setKey(code: string, down: boolean) {
		if (down && this.status !== 'playing') return;
		if (down) this.#keys.add(code);
		else this.#keys.delete(code);
		this.#steer();
	}

	/** A finger or the mouse steers toward a point at an offset (sea units) from the boat; null lets go */
	setPointer(offset: Vec | null) {
		this.#pointer = this.status === 'playing' ? offset : null;
		this.#steer();
	}

	/** The cross-check button: shows the true position on the chart for a few seconds */
	crossCheck() {
		if (this.status !== 'playing') return;
		for (const event of crossCheck(this.state)) this.#handle(event);
		this.#sync();
	}

	/** One fixed step: called by the canvas game loop */
	update(dtMs: number) {
		for (const effect of this.effects) effect.ageMs += dtMs;
		this.effects = this.effects.filter((effect) => effect.ageMs < effect.durationMs);
		if (this.status !== 'playing') return;

		const dt = dtMs / 1000;
		this.#steer();
		for (const event of step(this.state, dt)) this.#handle(event);
		this.#shakeMs = Math.max(0, this.#shakeMs - dtMs);
		this.#sync();

		if (this.state.phase === 'won') this.#win();
		else if (this.state.phase === 'over') this.#lose();
	}

	sceneExtras(): SceneExtras {
		return {
			effects: this.effects,
			reducedMotion: this.reducedMotion,
			shake: this.reducedMotion ? 0 : (this.#shakeMs / HIT_SHAKE_MS) * HIT_SHAKE_PX
		};
	}

	/** Draws the final chart onto the shared score card */
	drawBoard = (context: CanvasRenderingContext2D, x: number, y: number, size: number) => {
		drawChartPreview(context, this.state, x, y, size);
	};

	#play(id: SoundId, intensity = 1, pan = 0) {
		soundManager().play(id, intensity, pan);
	}

	#popup(x: number, y: number, text: string, big: boolean) {
		const short = this.reducedMotion ? 0.5 : 1;
		this.effects.push({
			kind: 'popup',
			x,
			y: y - 0.5,
			text,
			big,
			ageMs: 0,
			durationMs: 1000 * short + 200
		});
	}

	#steer() {
		const keys = keyVector(this.#keys);
		const pointer = this.#pointer ? pointerVector(this.#pointer.x, this.#pointer.y) : null;
		// Keys win while any is held: a thumb resting on the glass must not fight the arrows
		const steer = keys.x !== 0 || keys.y !== 0 || !pointer ? keys : pointer;
		setSteer(this.state, steer.x, steer.y);
	}

	#clearInput() {
		this.#keys.clear();
		this.#pointer = null;
		setSteer(this.state, 0, 0);
	}

	#handle(event: GpsLiarEvent) {
		const short = this.reducedMotion ? 0.5 : 1;
		const { pos } = this.state;
		switch (event.type) {
			case 'hit':
				this.hurtCount += 1;
				this.#shakeMs = HIT_SHAKE_MS;
				this.#popup(pos.x, pos.y, hitText(event.cause), true);
				this.effects.push({
					kind: 'ring',
					x: event.x,
					y: event.y,
					ageMs: 0,
					durationMs: 450 * short + 60
				});
				this.#play(event.cause === 'rock' || event.cause === 'lighthouse' ? 'impact-stone' : 'hit');
				this.#play('alarm', 0.6);
				break;
			case 'bump':
				this.#play('thud', 0.5);
				break;
			case 'deliver':
				this.#popup(
					event.x,
					event.y,
					m.gpsliar_popup_deliver({ cargo: cargoName(event.cargo), points: event.points }),
					true
				);
				this.#play('pickup');
				this.#play('chime', 0.8);
				break;
			case 'cross-check':
				this.#popup(pos.x, pos.y, m.gpsliar_popup_cross_check(), false);
				this.#play('sparkle');
				break;
			case 'cross-check-empty':
				this.#popup(pos.x, pos.y, m.gpsliar_popup_no_checks(), false);
				this.#play('ui-error');
				break;
			case 'lie-jump':
				this.#popup(pos.x, pos.y, m.gpsliar_popup_jump(), false);
				this.#play('zap', 0.6);
				break;
			case 'win':
				this.#play('chime-big');
				break;
			case 'game-over':
				break;
		}
	}

	#win() {
		const state = this.state;
		const level = levelAt(this.levelIndex);
		this.stars = state.stars;
		this.progress = recordFinish(this.progress, level.id, this.stars);
		this.#store().write(PROGRESS_KEY, this.progress);
		const result = this.#scores().submit(highscoreParts(level.id), state.score);
		this.isNewBest = result.isNewBest;
		this.best = result.best;
		this.#clearInput();
		this.status = 'won';
	}

	#lose() {
		const level = levelAt(this.levelIndex);
		const result = this.#scores().submit(highscoreParts(level.id), this.state.score);
		this.isNewBest = result.isNewBest;
		this.best = result.best;
		this.#clearInput();
		this.status = 'over';
	}

	#sync() {
		const state = this.state;
		this.hearts = state.hearts;
		this.score = state.score;
		this.delivered = state.delivered;
		this.stopsTotal = state.level.stops.length;
		this.crossChecksLeft = state.crossChecksLeft;
		this.crossChecksUsed = state.crossChecksUsed;
		this.revealing = state.reveal > 0;
		this.nextCargo = nextStop(state)?.cargo ?? null;
		this.seconds = Math.floor(state.time);
		this.par = state.level.par;
	}
}
