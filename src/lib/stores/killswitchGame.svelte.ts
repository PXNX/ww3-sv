/*
 * Starlink Kill Switch game store: wraps the pure rules with taps, the geofence drag, visual
 * effects, Elon's posts, toasts, sounds and the personal best. The simulation state is a plain
 * object (read by the canvas every frame); only what the page chrome shows is reactive. Nothing
 * runs until start(), and the loop is driven by the canvas, so the game never plays unseen.
 */
import { haptic } from '#lib/haptic/haptic.svelte.js';
import { prefersReducedMotion } from '#lib/game/loop.js';
import {
	FENCE_CHARGE,
	STARTING_LIVES,
	createGame,
	multiplier,
	placeFence,
	step,
	tap,
	type CivilianKind,
	type KillEvent,
	type KillState,
	type PostKind
} from '#lib/game/killswitch/state.js';
import { drawScenePreview, type Effect, type SceneExtras } from '#lib/game/killswitch/render.js';
import { createRandom, randomInt, randomSeed, type Random } from '#lib/game/random.js';
import { highscores, type Highscores } from '#lib/services/highscore.js';
import { soundManager } from '#lib/sound/soundManager.svelte.js';

export type KillswitchStatus = 'ready' | 'playing' | 'paused' | 'over';

export const KILLSWITCH_BEST_KEY = ['killswitch', 'score'] as const;

/** How many alternative lines each kind of post has (killswitch_post_<kind>_1 and so on) */
export const POST_LINES = 2;

const POST_MS = 4200;
const TOAST_MS = 2200;
const SHAKE_MS = 380;
const GOLD = '#f5c83a';
const WHITE = '#ffffff';
const RED = '#e5484d';

export interface PostBanner {
	id: number;
	kind: PostKind;
	/** 1-based index of the line shown */
	line: number;
}

export interface Toast {
	id: number;
	kind: CivilianKind;
	crash: boolean;
}

export class KillswitchGame {
	status = $state<KillswitchStatus>('ready');
	score = $state(0);
	lives = $state(STARTING_LIVES);
	streak = $state(0);
	multiplier = $state(1);
	/** Geofence charge, 0 to 1 */
	charge = $state(0);
	/** The next drag on the field drops a geofence */
	fenceArmed = $state(false);
	fenceStanding = $state(false);
	rush = $state(false);
	boost = $state(false);
	post = $state.raw<PostBanner | null>(null);
	toast = $state.raw<Toast | null>(null);
	cuts = $state(0);
	bestStreak = $state(0);
	best = $state<number | null>(null);
	isNewBest = $state(false);

	/** Simulation state, deliberately not reactive */
	state: KillState = createGame();
	effects: Effect[] = [];
	preview: SceneExtras['preview'] = null;
	timeMs = 0;
	shakeMs = 0;
	readonly reducedMotion: boolean;

	#random: Random = createRandom(1);
	#flavor: Random = createRandom(randomSeed());
	#scores: () => Highscores;
	#postMs = 0;
	#toastMs = 0;
	#bannerId = 0;

	constructor({
		scores = highscores,
		reducedMotion = prefersReducedMotion()
	}: { scores?: () => Highscores; reducedMotion?: boolean } = {}) {
		this.#scores = scores;
		this.reducedMotion = reducedMotion;
	}

	/** Reads the stored best; call in the browser only */
	loadBest() {
		this.best = this.#scores().get(KILLSWITCH_BEST_KEY);
	}

	start() {
		this.state = createGame();
		this.#random = createRandom(randomSeed());
		this.effects = [];
		this.preview = null;
		this.post = null;
		this.toast = null;
		this.fenceArmed = false;
		this.isNewBest = false;
		this.timeMs = 0;
		this.shakeMs = 0;
		this.#postMs = 0;
		this.#toastMs = 0;
		this.#sync();
		this.status = 'playing';
	}

	pause() {
		if (this.status !== 'playing') return;
		this.preview = null;
		this.status = 'paused';
	}

	resume() {
		if (this.status === 'paused') this.status = 'playing';
	}

	togglePause() {
		if (this.status === 'playing') this.pause();
		else this.resume();
	}

	/** Taps the playfield at a world position */
	tap(x: number, y: number) {
		if (this.status !== 'playing') return;
		this.#apply(tap(this.state, x, y));
	}

	armFence() {
		if (this.status !== 'playing') return;
		if (this.state.charge < FENCE_CHARGE || this.state.fence) return;
		this.fenceArmed = !this.fenceArmed;
		soundManager().play('ui-toggle', 0.6);
	}

	dragFence(x1: number, y1: number, x2: number, y2: number) {
		this.preview = { x1, y1, x2, y2 };
	}

	dropFence(x1: number, y1: number, x2: number, y2: number) {
		this.preview = null;
		if (this.status !== 'playing') return;
		const events = placeFence(this.state, x1, y1, x2, y2);
		if (events.length > 0) this.fenceArmed = false;
		this.#apply(events);
	}

	cancelDrag() {
		this.preview = null;
	}

	/** One fixed step: called by the canvas game loop */
	update(dtMs: number) {
		if (this.status !== 'playing') return;
		this.timeMs += dtMs;
		this.shakeMs = Math.max(0, this.shakeMs - dtMs);
		for (const effect of this.effects) effect.ageMs += dtMs;
		this.effects = this.effects.filter((effect) => effect.ageMs < effect.durationMs);
		if (this.post && (this.#postMs -= dtMs) <= 0) this.post = null;
		if (this.toast && (this.#toastMs -= dtMs) <= 0) this.toast = null;
		this.#apply(step(this.state, dtMs, this.#random));
	}

	sceneExtras(): SceneExtras {
		const shaking = this.shakeMs > 0 && !this.reducedMotion;
		const amplitude = shaking ? (this.shakeMs / SHAKE_MS) * 5 : 0;
		return {
			effects: this.effects,
			timeMs: this.timeMs,
			shakeX: Math.sin(this.timeMs / 17) * amplitude,
			shakeY: Math.cos(this.timeMs / 23) * amplitude,
			preview: this.preview
		};
	}

	/** Draws the final scene onto the shared score card */
	drawBoard = (context: CanvasRenderingContext2D, x: number, y: number, size: number) => {
		drawScenePreview(
			context,
			this.state,
			{ ...this.sceneExtras(), effects: [], preview: null },
			x,
			y,
			size
		);
	};

	#apply(events: KillEvent[]) {
		for (const event of events) this.#handle(event);
		this.#sync();
	}

	#handle(event: KillEvent) {
		const durationMs = this.reducedMotion ? 450 : 800;
		switch (event.type) {
			case 'cut': {
				const text =
					event.multiplier > 1 ? `+${event.points} ×${event.multiplier}` : `+${event.points}`;
				this.#popup(event.x, event.y, text, event.multiplier > 1 ? GOLD : WHITE, durationMs);
				soundManager().play(event.fenced ? 'zap' : 'pop', 0.8);
				haptic().play(0.15);
				break;
			}
			case 'splash':
				this.effects.push({ kind: 'splash', x: event.x, ageMs: 0, durationMs: 650 });
				soundManager().play('splash', 0.6);
				break;
			case 'refinery-hit':
				this.effects.push({
					kind: 'burst',
					x: event.x,
					y: event.y,
					size: 46,
					ageMs: 0,
					durationMs: 500
				});
				this.shakeMs = SHAKE_MS;
				soundManager().play('explosion-big', 0.9);
				soundManager().play('alarm', 0.6);
				haptic().play(0.7);
				break;
			case 'civilian-cut':
				this.#popup(event.x, event.y, '✖', RED, durationMs);
				this.#showToast(event.kind, false);
				soundManager().play('ui-error', 0.9);
				haptic().play(0.5);
				break;
			case 'civilian-crash':
				this.effects.push({
					kind: 'burst',
					x: event.x,
					y: event.y,
					size: 34,
					ageMs: 0,
					durationMs: 450
				});
				this.#showToast(event.kind, true);
				this.shakeMs = SHAKE_MS;
				soundManager().play('thud', 0.9);
				haptic().play(0.5);
				break;
			case 'restored':
				this.#popup(event.x, event.y, `+${event.points}`, GOLD, durationMs);
				soundManager().play('chime', 0.8);
				haptic().play(0.2);
				break;
			case 'miss':
				this.effects.push({ kind: 'ping', x: event.x, y: event.y, ageMs: 0, durationMs: 350 });
				break;
			case 'post':
				this.post = {
					id: ++this.#bannerId,
					kind: event.kind,
					line: randomInt(this.#flavor, 1, POST_LINES + 1)
				};
				this.#postMs = POST_MS;
				soundManager().play('ding', 0.9);
				break;
			case 'fence-ready':
				soundManager().play('ding', 0.9);
				break;
			case 'fence-placed':
				soundManager().play('whoosh', 0.8);
				break;
			case 'fence-expired':
				break;
			case 'game-over':
				this.#finish();
				break;
		}
	}

	#popup(x: number, y: number, text: string, color: string, durationMs: number) {
		this.effects.push({ kind: 'popup', x, y, text, color, ageMs: 0, durationMs });
	}

	#showToast(kind: CivilianKind, crash: boolean) {
		this.toast = { id: ++this.#bannerId, kind, crash };
		this.#toastMs = TOAST_MS;
	}

	#sync() {
		const state = this.state;
		this.score = state.score;
		this.lives = state.lives;
		this.streak = state.streak;
		this.multiplier = multiplier(state.streak);
		this.charge = state.fence ? 0 : state.charge / FENCE_CHARGE;
		this.fenceStanding = state.fence !== null;
		this.rush = state.rushMs > 0;
		this.boost = state.boostMs > 0;
		this.cuts = state.cuts;
		this.bestStreak = state.bestStreak;
		if (this.charge < 1) this.fenceArmed = false;
	}

	#finish() {
		this.#sync();
		const result = this.#scores().submit(KILLSWITCH_BEST_KEY, this.state.score);
		this.isNewBest = result.isNewBest;
		this.best = result.best;
		this.fenceArmed = false;
		this.preview = null;
		this.post = null;
		this.status = 'over';
	}
}
