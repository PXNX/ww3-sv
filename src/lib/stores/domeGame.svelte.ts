/*
 * Iron Dome Juggler game store: wraps the pure rules with tap input, popups, sounds and personal
 * bests. The simulation state is a plain object the canvas reads every frame; only what the page
 * chrome shows (score, hearts, wave, combo, interceptors) is reactive, synced after each step.
 */
import {
	MAX_AMMO,
	STARTING_LIVES,
	WORLD_WIDTH,
	SEA_END,
	BATTERY_X,
	BATTERY_Y
} from '#lib/game/dome/config.js';
import { reloadProgress } from '#lib/game/dome/ammo.js';
import {
	createFx,
	fieldFx,
	fizzleFx,
	impactFx,
	interceptFx,
	launchFx,
	splashFx,
	stepFx,
	trailFx,
	wobbleBuilding,
	type DomeFx
} from '#lib/game/dome/fx.js';
import { drawScenePreview, type Effect, type SceneExtras } from '#lib/game/dome/render.js';
import { comboMultiplier } from '#lib/game/dome/priority.js';
import {
	createGame,
	step,
	tap,
	tapMostUrgent,
	type DomeEvent,
	type DomeState
} from '#lib/game/dome/state.js';
import type { Point } from '#lib/game/dome/trajectory.js';
import { flightPoint } from '#lib/game/dome/trajectory.js';
import { createRandom, randomSeed, type Random } from '#lib/game/random.js';
import { haptic } from '#lib/haptic/haptic.svelte.js';
import { m } from '#lib/paraglide/messages.js';
import { highscores, type Highscores } from '#lib/services/highscore.js';
import { soundManager } from '#lib/sound/soundManager.svelte.js';
import type { SoundId } from '#lib/sound/sounds.js';

export type DomeStatus = 'ready' | 'playing' | 'paused' | 'over';

export const SCORE_KEY = ['dome', 'score'] as const;
export const WAVE_KEY = ['dome', 'wave'] as const;

const INK_WHITE = '#ffffff';
const GOLD = '#f5c83a';
const RED = '#e5484d';
const ORANGE = '#f08a3c';
const DUST = '#e3c98a';
const SPLASH = '#9fd6ef';

export interface DomeOptions {
	reducedMotion?: boolean;
	/** Injected for tests; defaults to the browser's local high scores */
	scores?: () => Highscores;
	/** Fixed seed for tests; a fresh random seed per run otherwise */
	seed?: () => number;
}

export class DomeGame {
	status = $state<DomeStatus>('ready');
	score = $state(0);
	lives = $state(STARTING_LIVES);
	wave = $state(0);
	combo = $state(0);
	multiplier = $state(1);
	/** Interceptors loaded and the reload progress of the next one, 0 to 100 */
	loaded = $state(MAX_AMMO);
	reloadPercent = $state(0);
	blackout = $state(false);
	intercepts = $state(0);
	wasted = $state(0);
	bestCombo = $state(0);
	/** Counts up whenever a heart is lost, so the field can flash */
	hurtCount = $state(0);
	best = $state<number | null>(null);
	bestWave = $state<number | null>(null);
	isNewBest = $state(false);

	/** Simulation state, deliberately not reactive */
	state: DomeState;
	effects: Effect[] = [];
	timeMs = 0;
	/** Debris, smoke, shake, the battery's recoil and building wobble, stepped with the rules */
	fx: DomeFx;
	#trailMs = 0;

	readonly reducedMotion: boolean;
	#random: Random = createRandom(1);
	#scores: () => Highscores;
	#seed: () => number;

	constructor({ reducedMotion = false, scores = highscores, seed = randomSeed }: DomeOptions = {}) {
		this.reducedMotion = reducedMotion;
		this.#scores = scores;
		this.#seed = seed;
		this.state = createGame();
		this.fx = createFx(reducedMotion);
		this.#syncChrome();
	}

	/** Reads the stored bests; call in the browser only */
	loadBest() {
		this.best = this.#scores().get(SCORE_KEY);
		this.bestWave = this.#scores().get(WAVE_KEY);
	}

	start() {
		this.#random = createRandom(this.#seed());
		this.state = createGame();
		this.effects = [];
		this.fx = createFx(this.reducedMotion);
		this.#trailMs = 0;
		this.timeMs = 0;
		this.isNewBest = false;
		this.hurtCount = 0;
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

	/** The back link during a run: ends it as a loss */
	forfeit() {
		if (this.status !== 'playing' && this.status !== 'paused') return;
		this.#finish();
	}

	/** A tap or click on the field, in world units */
	tapAt(point: Point) {
		if (this.status !== 'playing') return;
		this.#handleAll(tap(this.state, point));
		this.#syncChrome();
	}

	/** Keyboard: launch at the most urgent rocket */
	interceptUrgent() {
		if (this.status !== 'playing') return;
		this.#handleAll(tapMostUrgent(this.state));
		this.#syncChrome();
	}

	/** One fixed step: called by the canvas game loop */
	update(dtMs: number) {
		this.#ageEffects(dtMs);
		if (this.status !== 'playing') return;
		this.timeMs += dtMs;
		stepFx(this.fx, dtMs);
		this.#emitTrails(dtMs);
		this.#handleAll(step(this.state, dtMs, this.#random));
		this.#syncChrome();
	}

	sceneExtras(): SceneExtras {
		return {
			effects: this.effects,
			particles: this.fx.particles,
			rings: this.fx.rings,
			wobble: this.fx.wobble,
			recoil: this.fx.recoil,
			reducedMotion: this.reducedMotion,
			timeMs: this.timeMs
		};
	}

	/** Draws the final scene onto the shared score card */
	drawBoard = (context: CanvasRenderingContext2D, x: number, y: number, size: number) => {
		drawScenePreview(context, this.state, x, y, size);
	};

	#handleAll(events: DomeEvent[]) {
		for (const event of events) this.#handle(event);
	}

	#handle(event: DomeEvent) {
		switch (event.type) {
			case 'wave-start':
				this.#banner(
					m.dome_popup_wave({ wave: event.wave }),
					m.dome_banner_incoming({ count: event.count }),
					GOLD
				);
				this.#play('wave-horn', 0.8);
				haptic().play(0.2);
				break;
			case 'launch':
				launchFx(this.fx, event.x, event.y, event.heading);
				this.#play('patriot-launch', 0.55, this.#pan(event.x));
				haptic().play(0.12);
				break;
			case 'no-ammo':
				this.#popup(BATTERY_X, BATTERY_Y - 40, m.dome_popup_reloading(), false, GOLD);
				this.#play('ui-error');
				haptic().play(0.3);
				break;
			case 'intercept':
				if (event.wasted) {
					interceptFx(this.fx, event.x, event.y, false);
					this.#burst(event.x, event.y, 22, '#c9ccd3');
					this.#popup(
						event.x,
						event.y - 12,
						m.dome_popup_wasted({ points: Math.abs(event.points) }),
						false,
						RED
					);
					this.#play('ui-error', 0.8, this.#pan(event.x));
					haptic().play(0.35);
				} else {
					interceptFx(this.fx, event.x, event.y, true);
					this.#burst(event.x, event.y, 30, GOLD);
					const text =
						event.multiplier > 1 ? `+${event.points} ×${event.multiplier}` : `+${event.points}`;
					this.#popup(event.x, event.y - 12, text, event.multiplier > 1, INK_WHITE);
					this.#play('explosion-small', 0.7, this.#pan(event.x));
					haptic().play(Math.min(0.5, 0.18 + event.combo * 0.035));
				}
				break;
			case 'fizzle':
				fizzleFx(this.fx, event.x, event.y);
				this.#burst(event.x, event.y, 14, '#c9ccd3');
				this.#popup(event.x, event.y - 10, m.dome_popup_miss(), false, INK_WHITE);
				this.#play('pop', 0.7, this.#pan(event.x));
				haptic().play(0.12);
				break;
			case 'impact':
				this.#handleImpact(event);
				break;
			case 'blackout':
				this.#popup(WORLD_WIDTH / 2, 90, m.dome_popup_blackout(), true, GOLD);
				this.#play('alarm', 0.9);
				haptic().play(0.45);
				break;
			case 'wave-clear':
				this.#banner(
					m.dome_popup_clear({ bonus: event.bonus }),
					event.perfect ? m.dome_banner_perfect() : m.dome_banner_clear(),
					'#ffffff'
				);
				if (event.heartBack) {
					this.#popup(WORLD_WIDTH / 2, 150, m.dome_popup_clear_heart(), false, GOLD);
				}
				this.#play(event.perfect ? 'chime-big' : 'chime');
				haptic().play(event.perfect ? 0.5 : 0.3);
				break;
			case 'game-over':
				this.#finish();
				break;
		}
	}

	#handleImpact(event: Extract<DomeEvent, { type: 'impact' }>) {
		if (event.target === null) {
			const sea = event.x < SEA_END;
			if (sea) {
				splashFx(this.fx, event.x, event.y);
				this.#play('splash', 0.7, this.#pan(event.x));
				haptic().play(0.12);
			} else {
				fieldFx(this.fx, event.x, event.y);
				this.#play('thud', 0.6, this.#pan(event.x));
				haptic().play(0.15);
			}
			this.#burst(event.x, event.y, sea ? 16 : 14, sea ? SPLASH : DUST);
			this.#popup(
				event.x,
				event.y - 24,
				sea ? m.dome_popup_sea() : m.dome_popup_field(),
				false,
				INK_WHITE
			);
			return;
		}
		this.hurtCount += 1;
		impactFx(this.fx, event.x, event.y - 10, event.cost);
		wobbleBuilding(this.fx, event.index);
		this.#burst(event.x, event.y - 10, 44, ORANGE);
		const text =
			event.target === 'house'
				? m.dome_popup_hit_house()
				: event.target === 'hospital'
					? m.dome_popup_hit_hospital()
					: m.dome_popup_hit_plant();
		this.#popup(event.x, event.y - 70, text, true, RED);
		this.#play('shahed-impact', Math.min(1, 0.7 + event.cost * 0.1), this.#pan(event.x));
		haptic().play(Math.min(1, 0.6 + event.cost * 0.12));
	}

	/** A rocket or interceptor leaves a thin trail, made at a fixed rate rather than every step */
	#emitTrails(dtMs: number) {
		this.#trailMs += dtMs;
		const interval = this.reducedMotion ? 90 : 42;
		if (this.#trailMs < interval) return;
		this.#trailMs = 0;
		for (const rocket of this.state.rockets) {
			const back = flightPoint(rocket.flight, Math.max(0, rocket.elapsedMs - 40));
			trailFx(this.fx, back.x, back.y, 'rocket');
		}
		for (const interceptor of this.state.interceptors) {
			trailFx(
				this.fx,
				interceptor.x - Math.cos(interceptor.heading) * 10,
				interceptor.y - Math.sin(interceptor.heading) * 10,
				'interceptor'
			);
		}
	}

	#popup(x: number, y: number, text: string, big: boolean, color: string) {
		const short = this.reducedMotion ? 0.5 : 1;
		this.effects.push({
			kind: 'popup',
			x: Math.max(70, Math.min(WORLD_WIDTH - 70, x)),
			y: Math.max(24, y),
			text,
			big,
			color,
			ageMs: 0,
			durationMs: 1200 * short + 200
		});
	}

	#banner(text: string, sub: string, color: string) {
		this.effects.push({
			kind: 'banner',
			text,
			sub,
			color,
			ageMs: 0,
			durationMs: this.reducedMotion ? 900 : 1500
		});
	}

	#burst(x: number, y: number, radius: number, color: string) {
		this.effects.push({
			kind: 'burst',
			x,
			y,
			radius,
			color,
			ageMs: 0,
			durationMs: this.reducedMotion ? 250 : 450
		});
	}

	/** Places a sound in the stereo field by where it happened, so the sea sounds on the left */
	#pan(x: number) {
		return (Math.max(0, Math.min(WORLD_WIDTH, x)) / WORLD_WIDTH) * 1.5 - 0.75;
	}

	#play(id: SoundId, intensity = 1, pan = 0) {
		soundManager().play(id, intensity, pan);
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
		this.wave = state.wave;
		this.combo = state.combo;
		this.multiplier = comboMultiplier(state.combo);
		this.loaded = state.ammo.loaded;
		this.reloadPercent = Math.round(reloadProgress(state.ammo) * 100);
		this.blackout = state.blackoutMs > 0;
		this.intercepts = state.intercepts;
		this.wasted = state.wasted;
		this.bestCombo = state.bestCombo;
	}

	#finish() {
		this.#syncChrome();
		const scoreResult = this.#scores().submit(SCORE_KEY, this.state.score);
		const waveResult = this.#scores().submit(WAVE_KEY, this.state.wave);
		this.isNewBest = scoreResult.isNewBest;
		this.best = scoreResult.best;
		this.bestWave = waveResult.best;
		this.status = 'over';
		// Do not freeze a bright hit flash on the final frame
		this.fx.flashMs = 0;
		this.fx.shakeMs = 0;
		this.fx.shakeStrength = 0;
		this.#play('game-over');
		haptic().play(0.8);
	}
}
