/*
 * Radar Slice game store: wraps the pure step logic with the player's swipes, visual effects
 * (juice, shockwaves, blade ribbon, screen shake), sounds, haptics and personal bests. The
 * simulation state is a plain object read by the canvas every frame; only what the page chrome
 * shows is reactive, synced after each step.
 */
import { YELLOW, STEEL, TIE_RED, PAPER, FLAG_BLUE } from '#lib/game/slice/art.js';
import { FOCUS_MS, STARTING_LIVES, WAVE_COUNT, specOf } from '#lib/game/slice/config.js';
import {
	RIBBON_FADE_MS,
	drawScenePreview,
	type Effect,
	type RibbonPoint,
	type SceneExtras
} from '#lib/game/slice/render.js';
import { starsFor, streakMultiplier } from '#lib/game/slice/scoring.js';
import { createGame, type SliceEvent, type SliceState } from '#lib/game/slice/state.js';
import { reviveGame, sliceWithTrail, stepGame } from '#lib/game/slice/step.js';
import { addTrailPoint, beginSwipe } from '#lib/game/slice/trail.js';
import { createRandom, randomSeed, type Random } from '#lib/game/random.js';
import { haptic } from '#lib/haptic/haptic.svelte.js';
import { m } from '#lib/paraglide/messages.js';
import { highscores, type Highscores } from '#lib/services/highscore.js';
import { soundManager } from '#lib/sound/soundManager.svelte.js';
import type { SoundId } from '#lib/sound/sounds.js';

export type SliceStatus = 'ready' | 'playing' | 'paused' | 'over';

const SCORE_KEY = ['slice', 'score'] as const;
const COMBO_KEY = ['slice', 'combo'] as const;

/** Shortest time between two plays of a frequent sound */
const SOUND_GAP_MS = 90;
/** Most juice particles alive at once, so a busy screen stays cheap */
const MAX_SPARKS = 160;
/** Most points kept in the blade ribbon */
const RIBBON_MAX_POINTS = 28;
/** Gravity of juice particles in world units per second squared */
const SPARK_GRAVITY = 620;

const WORLD_CENTER_X = 180;

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
	/** Clean slices in a row */
	streak = $state(0);
	bestStreak = $state(0);
	/** Score multiplier from the streak */
	multiplier = $state(1);
	wave = $state(1);
	/** Share of the slow-motion focus left, 0 to 1 */
	focus = $state(0);
	flawlessWaves = $state(0);
	won = $state(false);
	stars = $state(0);
	/** Counts up whenever a heart is lost, so the field can flash */
	hurtCount = $state(0);
	best = $state<number | null>(null);
	bestComboEver = $state<number | null>(null);
	isNewBest = $state(false);

	/** Simulation state, deliberately not reactive */
	state: SliceState = createGame();
	effects: Effect[] = [];
	ribbon: RibbonPoint[] = [];

	readonly reducedMotion: boolean;
	#random: Random = createRandom(1);
	#scores: () => Highscores;
	#seed: () => number;
	#soundClock = 0;
	#lastSound: Partial<Record<SoundId, number>> = {};
	#shake = { magnitude: 0, ageMs: 0, durationMs: 1 };

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
		this.ribbon = [];
		this.#shake = { magnitude: 0, ageMs: 0, durationMs: 1 };
		this.isNewBest = false;
		this.won = false;
		this.stars = 0;
		this.#soundClock = 0;
		this.#lastSound = {};
		this.#syncChrome();
		this.status = 'playing';
	}

	/** A bought revival: the same run goes on with one heart and a clear sky */
	revive() {
		if (this.status !== 'over' || this.state.won) return;
		reviveGame(this.state);
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
		else if (this.status === 'paused') this.resume();
	}

	/** The back link during a run: ends it as a loss */
	forfeit() {
		if (this.status !== 'playing' && this.status !== 'paused') return;
		this.#finish();
	}

	/** A press on the field at a world position starts a new swipe (a tap alone can cut) */
	pointerDown(x: number, y: number) {
		if (this.status !== 'playing') return;
		beginSwipe(this.state.trail, { x, y }, this.state.timeMs);
		this.ribbon = [{ x, y, t: this.state.timeMs }];
		this.#cutNow();
	}

	/** The pointer moved: extend the trail and test it right away, before the next frame */
	pointerMove(x: number, y: number) {
		if (this.status !== 'playing' || this.state.trail.points.length === 0) return;
		addTrailPoint(this.state.trail, { x, y }, this.state.timeMs);
		this.ribbon.push({ x, y, t: this.state.timeMs });
		if (this.ribbon.length > RIBBON_MAX_POINTS) this.ribbon.shift();
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
		return {
			effects: this.effects,
			reducedMotion: this.reducedMotion,
			ribbon: this.ribbon,
			shake: this.#shakeOffset(),
			focus: this.focus > 0 ? Math.min(1, this.focus * 4) : 0
		};
	}

	/** Draws the final field onto the shared score card */
	drawBoard = (context: CanvasRenderingContext2D, x: number, y: number, size: number) => {
		drawScenePreview(context, this.state, x, y, size);
	};

	#cutNow() {
		for (const event of sliceWithTrail(this.state)) this.#handle(event);
		this.#syncChrome();
	}

	#shakeOffset() {
		const { magnitude, ageMs, durationMs } = this.#shake;
		if (this.reducedMotion || ageMs >= durationMs) return { x: 0, y: 0 };
		const amplitude = magnitude * (1 - ageMs / durationMs);
		return { x: Math.sin(ageMs * 0.09) * amplitude, y: Math.cos(ageMs * 0.13) * amplitude };
	}

	#kick(magnitude: number, durationMs = 260) {
		if (this.reducedMotion) return;
		const left = this.#shake.durationMs - this.#shake.ageMs;
		if (left > 0 && this.#shake.magnitude * (left / this.#shake.durationMs) > magnitude) return;
		this.#shake = { magnitude, ageMs: 0, durationMs };
	}

	#popup(x: number, y: number, text: string, big: boolean, durationMs: number) {
		const short = this.reducedMotion ? 0.5 : 1;
		this.effects.push({
			kind: 'popup',
			x: Math.min(330, Math.max(30, x)),
			y,
			text,
			big,
			ageMs: 0,
			durationMs: durationMs * short + 150
		});
	}

	/** A burst of juice droplets or scraps (a few only for reduced motion) */
	#burst(x: number, y: number, count: number, colors: readonly string[], speed: number) {
		const total = Math.round(count * (this.reducedMotion ? 0.3 : 1));
		for (let i = 0; i < total; i++) {
			if (this.effects.length > MAX_SPARKS + 40) break;
			const angle = Math.random() * Math.PI * 2;
			const velocity = speed * (0.35 + Math.random() * 0.65);
			this.effects.push({
				kind: 'spark',
				x,
				y,
				vx: Math.cos(angle) * velocity,
				vy: Math.sin(angle) * velocity - speed * 0.3,
				size: 2.5 + Math.random() * 3,
				color: colors[i % colors.length],
				ageMs: 0,
				durationMs: 450 + Math.random() * 350
			});
		}
	}

	#ring(x: number, y: number, radius: number, color: string, durationMs = 380) {
		if (this.reducedMotion) return;
		this.effects.push({ kind: 'ring', x, y, radius, color, ageMs: 0, durationMs });
	}

	#handle(event: SliceEvent) {
		const short = this.reducedMotion ? 0.5 : 1;
		switch (event.type) {
			case 'launched':
				this.#play('whoosh', 160);
				break;
			case 'sliced': {
				const spec = specOf(event.kind);
				this.effects.push({
					kind: 'puff',
					x: event.x,
					y: event.y,
					size: spec.radius * 0.9,
					ageMs: 0,
					durationMs: 360 * short + 80
				});
				if (!this.reducedMotion) {
					this.effects.push({
						kind: 'slash',
						x: event.x,
						y: event.y,
						angle: event.angle,
						length: spec.radius * 2.6,
						ageMs: 0,
						durationMs: 200
					});
				}
				this.#burst(event.x, event.y, 8 + event.chain * 2, [YELLOW, TIE_RED, STEEL, PAPER], 190);
				this.#popup(event.x, event.y, `+${event.points}`, false, 650);
				if (event.chain >= 2) {
					this.#popup(event.x, event.y - 22, `x${event.chain}`, true, 800);
					this.#play('chime', 0, Math.min(1, event.chain / 6));
					this.#kick(1.5 + event.chain * 0.5, 200);
				} else {
					this.#play('pop', SOUND_GAP_MS);
				}
				haptic().play(Math.min(0.5, 0.12 + event.chain * 0.06));
				break;
			}
			case 'armor-hit':
				this.#burst(event.x, event.y, 10, [STEEL, PAPER, YELLOW], 160);
				this.#popup(event.x, event.y, m.slice_armor_popup(), true, 800);
				this.#play('slice-clang', 60);
				this.#kick(3, 180);
				haptic().play(0.3);
				break;
			case 'split':
				this.#ring(event.x, event.y, 46, YELLOW, 320);
				this.#play('sparkle', 120);
				break;
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
				this.#popup(event.x, event.y, '-1 ♥', true, 900);
				if (event.blast) {
					this.#ring(event.x, event.y, 130, TIE_RED, 480);
					this.#burst(event.x, event.y, 22, [TIE_RED, YELLOW, STEEL], 300);
					this.#popup(event.x, event.y - 30, m.slice_boom_popup(), true, 800);
					this.#play('explosion-small', 0);
					this.#kick(10, 380);
					haptic().play(1);
				} else {
					this.#burst(event.x, event.y, 10, [PAPER, FLAG_BLUE], 170);
					this.#play('ui-error', 0);
					this.#kick(4, 240);
					haptic().play(0.75);
				}
				break;
			case 'pickup':
				this.#ring(event.x, event.y, 70, event.kind === 'focus' ? FLAG_BLUE : TIE_RED);
				this.#burst(event.x, event.y, 14, [YELLOW, PAPER, FLAG_BLUE], 200);
				if (event.kind === 'focus') {
					this.#popup(event.x, event.y, m.slice_focus_popup(), true, 900);
					this.#play('slice-focus-in', 0);
				} else {
					this.#popup(event.x, event.y, '+1 ♥', true, 900);
					this.#play('sparkle', 0);
				}
				haptic().play(0.4);
				break;
			case 'missed':
				this.effects.push({
					kind: 'splash',
					x: event.x,
					y: event.y - 10,
					ageMs: 0,
					durationMs: 600 * short + 100
				});
				if (!event.minor) {
					this.hurtCount += 1;
					this.#play('thud', SOUND_GAP_MS);
					this.#kick(4, 240);
					haptic().play(0.6);
				} else {
					this.#play('splash', 120, 0.3);
				}
				break;
			case 'bounce':
				if (event.speed > 50) this.#play('click', 120, Math.min(1, event.speed / 250));
				break;
			case 'skim':
				this.effects.push({
					kind: 'splash',
					x: event.x,
					y: event.y,
					ageMs: 0,
					durationMs: 400 * short + 100
				});
				this.#play('splash', 160, 0.3);
				break;
			case 'wave-start':
				this.effects.push({
					kind: 'banner',
					text: m.slice_wave_banner({ wave: event.wave }),
					sub: m.slice_wave_banner_sub({ wave: event.wave, total: WAVE_COUNT }),
					ageMs: 0,
					durationMs: 1800
				});
				this.#play('wave-horn', 0);
				haptic().play(0.3);
				break;
			case 'wave-clear':
				this.#popup(
					WORLD_CENTER_X,
					300,
					event.flawless
						? m.slice_wave_flawless_popup({ bonus: event.bonus })
						: m.slice_wave_clear_popup({ bonus: event.bonus }),
					true,
					1500
				);
				this.#ring(WORLD_CENTER_X, 300, 200, YELLOW, 700);
				this.#play('chime-big', 0);
				haptic().play(0.5);
				break;
			case 'focus-end':
				this.#play('slice-focus-out', 0);
				break;
			case 'victory':
				this.#finish();
				break;
			case 'game-over':
				haptic().play(0.9);
				this.#finish();
				break;
		}
	}

	/** Plays a sound unless the same one played within the gap */
	#play(id: SoundId, gapMs: number, intensity = 0.5) {
		const last = this.#lastSound[id];
		if (last !== undefined && gapMs > 0 && this.#soundClock - last < gapMs) return;
		this.#lastSound[id] = this.#soundClock;
		soundManager().play(id, intensity);
	}

	#ageEffects(dtMs: number) {
		if (this.status !== 'playing') return;
		const dt = dtMs / 1000;
		for (const effect of this.effects) {
			effect.ageMs += dtMs;
			if (effect.kind === 'spark') {
				effect.vy += SPARK_GRAVITY * dt;
				effect.x += effect.vx * dt;
				effect.y += effect.vy * dt;
			}
		}
		this.effects = this.effects.filter((effect) => effect.ageMs < effect.durationMs);
		this.#shake.ageMs += dtMs;
		const horizon = this.state.timeMs - RIBBON_FADE_MS;
		if (this.ribbon.length > 0 && this.ribbon[this.ribbon.length - 1].t < horizon) this.ribbon = [];
	}

	#syncChrome() {
		const state = this.state;
		this.score = state.score;
		this.lives = state.lives;
		this.sliced = state.sliced;
		this.missed = state.missed;
		this.decoysHit = state.decoysHit;
		this.bestCombo = state.bestCombo;
		this.streak = state.streak;
		this.bestStreak = state.bestStreak;
		this.multiplier = streakMultiplier(state.streak);
		this.wave = state.spawner.wave;
		this.focus = state.focusMs / FOCUS_MS;
		this.flawlessWaves = state.flawlessWaves;
	}

	#finish() {
		this.#syncChrome();
		this.won = this.state.won;
		this.stars = starsFor(this.state);
		const scoreResult = this.#scores().submit(SCORE_KEY, this.state.score);
		const comboResult = this.#scores().submit(COMBO_KEY, this.state.bestCombo);
		// After a revival the stored best may already be this run's own score, so stay a new best
		this.isNewBest = this.isNewBest || scoreResult.isNewBest;
		this.best = scoreResult.best;
		this.bestComboEver = comboResult.best;
		if (this.won) haptic().play(0.7);
		this.status = 'over';
	}
}
