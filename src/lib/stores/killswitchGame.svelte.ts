/*
 * Starlink Kill Switch game store: wraps the pure rules with taps, the geofence drag, visual
 * effects, Elon's posts, wave banners, toasts, sounds, haptics and the personal best. The
 * simulation state is a plain object (read by the canvas every frame); only what the page chrome
 * shows is reactive. Nothing runs until start(), and the loop is driven by the canvas, so the game
 * never plays unseen. Shake, sparks and screen flashes stay off with reduced motion.
 */
import { haptic } from '#lib/haptic/haptic.svelte.js';
import { prefersReducedMotion } from '#lib/game/loop.js';
import {
	ENERGY_MAX,
	FENCE_CHARGE,
	STARTING_LIVES,
	WAVE_COUNT,
	accuracy,
	createGame,
	multiplier,
	placeFence,
	starsFor,
	step,
	tap,
	type CivilianKind,
	type KillEvent,
	type KillState,
	type PostKind,
	type TargetKind
} from '#lib/game/killswitch/state.js';
import {
	badgeOffset,
	beamOrigin,
	drawScenePreview,
	type Effect,
	type SceneExtras
} from '#lib/game/killswitch/render.js';
import { m } from '#lib/paraglide/messages.js';
import { createRandom, randomInt, randomSeed, type Random } from '#lib/game/random.js';
import { highscores, type Highscores } from '#lib/services/highscore.js';
import { soundManager } from '#lib/sound/soundManager.svelte.js';

export type KillswitchStatus = 'ready' | 'playing' | 'paused' | 'over';

export const KILLSWITCH_BEST_KEY = ['killswitch', 'score'] as const;

/** How many alternative lines each kind of post has (killswitch_post_<kind>_1 and so on) */
export const POST_LINES = 2;

const POST_MS = 4200;
const TOAST_MS = 2200;
const BANNER_MS = 2600;
const SHAKE_MS = 380;
/** Extra reach around every target, in world units: more for a finger than for a mouse */
const TOUCH_SLOP = 16;
const MOUSE_SLOP = 6;
const GOLD = '#f5c83a';
const WHITE = '#ffffff';
const RED = '#e5484d';
const CYAN = '#37d4ff';
const FLAME = '#f0772f';

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

/** The big message over the field: a wave starting (with a hint for a new kind) or being cleared */
export interface WaveBanner {
	id: number;
	type: 'start' | 'clear';
	wave: number;
	intro: TargetKind | null;
	bonus: number;
	flawless: boolean;
}

export class KillswitchGame {
	status = $state<KillswitchStatus>('ready');
	score = $state(0);
	lives = $state(STARTING_LIVES);
	streak = $state(0);
	multiplier = $state(1);
	/** Geofence charge, 0 to 1 */
	charge = $state(0);
	/** Link energy, 0 to 1 */
	energy = $state(1);
	/** The next drag on the field drops a geofence */
	fenceArmed = $state(false);
	fenceStanding = $state(false);
	rush = $state(false);
	boost = $state(false);
	unlimited = $state(false);
	wave = $state(0);
	post = $state.raw<PostBanner | null>(null);
	toast = $state.raw<Toast | null>(null);
	banner = $state.raw<WaveBanner | null>(null);
	cuts = $state(0);
	bestStreak = $state(0);
	perfects = $state(0);
	/** Share of taps that found a target, 0 to 1 */
	accuracy = $state(1);
	won = $state(false);
	stars = $state(0);
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
	#bannerMs = 0;
	#bannerId = 0;
	#emptyBuzzAt = -1e9;

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
		this.banner = null;
		this.fenceArmed = false;
		this.isNewBest = false;
		this.won = false;
		this.stars = 0;
		this.timeMs = 0;
		this.shakeMs = 0;
		this.#postMs = 0;
		this.#toastMs = 0;
		this.#bannerMs = 0;
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

	/** Taps the playfield at a world position; a finger gets more room than a mouse */
	tap(x: number, y: number, touch = false) {
		if (this.status !== 'playing') return;
		this.#apply(tap(this.state, x, y, touch ? TOUCH_SLOP : MOUSE_SLOP));
	}

	armFence() {
		if (this.status !== 'playing') return;
		if (this.state.charge < FENCE_CHARGE || this.state.fence) return;
		this.fenceArmed = !this.fenceArmed;
		soundManager().play('ui-toggle', 0.6);
		haptic().play(0.1);
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
		if (this.banner && (this.#bannerMs -= dtMs) <= 0) this.banner = null;
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
			reducedMotion: this.reducedMotion,
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

	#ambient() {
		return this.reducedMotion ? 0 : this.timeMs;
	}

	#add(effect: Effect) {
		this.effects.push(effect);
	}

	#sparks(x: number, y: number, color: string, size: number, count: number) {
		if (this.reducedMotion) return;
		this.#add({
			kind: 'sparks',
			x,
			y,
			size,
			color,
			count,
			seed: this.#flavor() * Math.PI,
			ageMs: 0,
			durationMs: 560
		});
	}

	#flash(color: string, strength: number) {
		if (this.reducedMotion) return;
		this.#add({ kind: 'flash', color, strength, ageMs: 0, durationMs: 380 });
	}

	#handle(event: KillEvent) {
		const durationMs = this.reducedMotion ? 450 : 800;
		switch (event.type) {
			case 'cut': {
				const text =
					event.multiplier > 1 ? `+${event.points} ×${event.multiplier}` : `+${event.points}`;
				this.#popup(
					event.x,
					event.y,
					text,
					event.multiplier > 1 ? GOLD : WHITE,
					durationMs,
					event.precise ? 24 : 20
				);
				// The link snaps: a beam from the nearest satellite crackles out at the drone
				const origin = beamOrigin(this.#ambient(), event.x);
				this.#add({
					kind: 'snap',
					x1: origin.x,
					y1: origin.y + 4,
					x2: event.x,
					y2: event.y - badgeOffset({ civilian: false, kind: event.kind }),
					ageMs: 0,
					durationMs: 320
				});
				this.#sparks(event.x, event.y, CYAN, 36, 7);
				if (event.precise) {
					this.#add({
						kind: 'ring',
						x: event.x,
						y: event.y,
						size: 44,
						color: GOLD,
						ageMs: 0,
						durationMs: 420
					});
					this.#popup(event.x, event.y - 20, m.killswitch_perfect(), GOLD, durationMs, 15);
				}
				soundManager().play(event.fenced ? 'zap' : 'link-snap', event.precise ? 1 : 0.6);
				soundManager().play('pop', 0.5);
				haptic().play(event.precise ? 0.28 : 0.15);
				break;
			}
			case 'shield':
				this.#add({
					kind: 'ring',
					x: event.x,
					y: event.y,
					size: 50,
					color: CYAN,
					ageMs: 0,
					durationMs: 360
				});
				this.#popup(event.x, event.y, m.killswitch_shield(), CYAN, durationMs, 16);
				soundManager().play('hit', 0.8);
				haptic().play(0.22);
				break;
			case 'combo':
				this.#popup(
					event.x,
					event.y - 26,
					m.killswitch_combo({ multiplier: event.multiplier }),
					GOLD,
					this.reducedMotion ? 600 : 1000,
					28
				);
				soundManager().play('chime', 0.5 + event.multiplier / 10);
				haptic().play(0.3);
				break;
			case 'no-energy':
				this.#add({
					kind: 'ping',
					x: event.x,
					y: event.y,
					color: RED,
					ageMs: 0,
					durationMs: 350
				});
				// Do not buzz on every frantic tap
				if (this.timeMs - this.#emptyBuzzAt > 260) {
					this.#emptyBuzzAt = this.timeMs;
					soundManager().play('energy-empty', 0.7);
					haptic().play(0.08);
				}
				break;
			case 'splash':
				this.#add({ kind: 'splash', x: event.x, ageMs: 0, durationMs: 650 });
				soundManager().play('splash', 0.6);
				break;
			case 'refinery-hit':
				this.#add({
					kind: 'burst',
					x: event.x,
					y: event.y,
					size: 52,
					ageMs: 0,
					durationMs: 520
				});
				this.#add({
					kind: 'ring',
					x: event.x,
					y: event.y,
					size: 90,
					color: FLAME,
					ageMs: 0,
					durationMs: 520
				});
				this.#sparks(event.x, event.y, FLAME, 70, 14);
				this.#flash(RED, 0.4);
				this.shakeMs = SHAKE_MS;
				soundManager().play('explosion-big', 0.9);
				soundManager().play('alarm', 0.6);
				haptic().play(0.7);
				break;
			case 'civilian-cut':
				this.#popup(event.x, event.y, `−♥`, RED, this.reducedMotion ? 700 : 1100, 30);
				this.#add({
					kind: 'ring',
					x: event.x,
					y: event.y,
					size: 56,
					color: RED,
					ageMs: 0,
					durationMs: 480
				});
				this.#flash(RED, 0.22);
				this.#showToast(event.kind, false);
				soundManager().play('ui-error', 0.9);
				haptic().play(0.55);
				break;
			case 'civilian-crash':
				this.#add({
					kind: 'burst',
					x: event.x,
					y: event.y,
					size: 34,
					ageMs: 0,
					durationMs: 450
				});
				this.#sparks(event.x, event.y, FLAME, 44, 9);
				this.#flash(RED, 0.2);
				this.#showToast(event.kind, true);
				this.shakeMs = SHAKE_MS;
				soundManager().play('thud', 0.9);
				haptic().play(0.5);
				break;
			case 'restored':
				this.#popup(event.x, event.y, `+${event.points}`, GOLD, durationMs);
				this.#add({
					kind: 'ring',
					x: event.x,
					y: event.y,
					size: 46,
					color: GOLD,
					ageMs: 0,
					durationMs: 420
				});
				soundManager().play('chime', 0.8);
				haptic().play(0.2);
				break;
			case 'miss':
				this.#add({ kind: 'ping', x: event.x, y: event.y, ageMs: 0, durationMs: 350 });
				soundManager().play('ui-tap', 0.3);
				break;
			case 'post':
				this.post = {
					id: ++this.#bannerId,
					kind: event.kind,
					line: randomInt(this.#flavor, 1, POST_LINES + 1)
				};
				this.#postMs = POST_MS;
				soundManager().play('ding', 0.9);
				haptic().play(0.3);
				break;
			case 'wave-start':
				this.#showBanner({
					type: 'start',
					wave: event.wave,
					intro: event.intro,
					bonus: 0,
					flawless: false
				});
				soundManager().play('wave-horn', 0.8);
				haptic().play(0.35);
				break;
			case 'wave-clear':
				this.#showBanner({
					type: 'clear',
					wave: event.wave,
					intro: null,
					bonus: event.bonus,
					flawless: event.flawless
				});
				soundManager().play('chime-big', 0.8);
				haptic().play(0.4);
				break;
			case 'victory':
				this.#finish();
				break;
			case 'fence-ready':
				soundManager().play('ding', 0.9);
				haptic().play(0.25);
				break;
			case 'fence-placed':
				this.#flash(CYAN, 0.18);
				soundManager().play('whoosh', 0.8);
				haptic().play(0.3);
				break;
			case 'fence-expired':
				break;
			case 'game-over':
				this.#finish();
				break;
		}
	}

	#popup(x: number, y: number, text: string, color: string, durationMs: number, size?: number) {
		this.#add({ kind: 'popup', x, y, text, color, size, ageMs: 0, durationMs });
	}

	#showToast(kind: CivilianKind, crash: boolean) {
		this.toast = { id: ++this.#bannerId, kind, crash };
		this.#toastMs = TOAST_MS;
	}

	#showBanner(banner: Omit<WaveBanner, 'id'>) {
		this.banner = { id: ++this.#bannerId, ...banner };
		this.#bannerMs = BANNER_MS;
	}

	#sync() {
		const state = this.state;
		this.score = state.score;
		this.lives = state.lives;
		this.streak = state.streak;
		this.multiplier = multiplier(state.streak);
		this.charge = state.fence ? 0 : state.charge / FENCE_CHARGE;
		// Whole percent only, so the bar does not invalidate every frame for nothing
		this.energy = Math.round((state.energy / ENERGY_MAX) * 100) / 100;
		this.fenceStanding = state.fence !== null;
		this.rush = state.rushMs > 0;
		this.boost = state.boostMs > 0;
		this.unlimited = state.unlimitedMs > 0;
		this.wave = Math.min(WAVE_COUNT, Math.max(1, state.wave));
		this.cuts = state.cuts;
		this.bestStreak = state.bestStreak;
		this.perfects = state.perfects;
		this.accuracy = accuracy(state);
		if (this.charge < 1) this.fenceArmed = false;
	}

	#finish() {
		this.#sync();
		this.won = this.state.won;
		this.stars = starsFor(this.state);
		const result = this.#scores().submit(KILLSWITCH_BEST_KEY, this.state.score);
		this.isNewBest = result.isNewBest;
		this.best = result.best;
		this.fenceArmed = false;
		this.preview = null;
		this.post = null;
		this.banner = null;
		this.status = 'over';
	}
}
