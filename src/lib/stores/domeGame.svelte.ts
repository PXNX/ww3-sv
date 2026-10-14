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
import { createRandom, randomSeed, type Random } from '#lib/game/random.js';
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

	readonly reducedMotion: boolean;
	#random: Random = createRandom(1);
	#scores: () => Highscores;
	#seed: () => number;

	constructor({ reducedMotion = false, scores = highscores, seed = randomSeed }: DomeOptions = {}) {
		this.reducedMotion = reducedMotion;
		this.#scores = scores;
		this.#seed = seed;
		this.state = createGame();
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
		this.#handleAll(step(this.state, dtMs, this.#random));
		this.#syncChrome();
	}

	sceneExtras(): SceneExtras {
		return { effects: this.effects, reducedMotion: this.reducedMotion, timeMs: this.timeMs };
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
				this.#popup(WORLD_WIDTH / 2, 120, m.dome_popup_wave({ wave: event.wave }), true, INK_WHITE);
				this.#play('ding');
				break;
			case 'launch':
				this.#play('whoosh');
				break;
			case 'no-ammo':
				this.#popup(BATTERY_X, BATTERY_Y - 40, m.dome_popup_reloading(), false, GOLD);
				this.#play('ui-error');
				break;
			case 'intercept':
				if (event.wasted) {
					this.#burst(event.x, event.y, 22, '#c9ccd3');
					this.#popup(
						event.x,
						event.y - 12,
						m.dome_popup_wasted({ points: Math.abs(event.points) }),
						false,
						RED
					);
					this.#play('ui-error');
				} else {
					this.#burst(event.x, event.y, 30, GOLD);
					const text =
						event.multiplier > 1 ? `+${event.points} ×${event.multiplier}` : `+${event.points}`;
					this.#popup(event.x, event.y - 12, text, event.multiplier > 1, INK_WHITE);
					this.#play('explosion-small');
				}
				break;
			case 'fizzle':
				this.#burst(event.x, event.y, 14, '#c9ccd3');
				this.#popup(event.x, event.y - 10, m.dome_popup_miss(), false, INK_WHITE);
				this.#play('pop');
				break;
			case 'impact':
				this.#handleImpact(event);
				break;
			case 'blackout':
				this.#popup(WORLD_WIDTH / 2, 90, m.dome_popup_blackout(), true, GOLD);
				this.#play('alarm');
				break;
			case 'wave-clear':
				this.#popup(
					WORLD_WIDTH / 2,
					110,
					m.dome_popup_clear({ bonus: event.bonus }),
					true,
					INK_WHITE
				);
				if (event.heartBack) {
					this.#popup(WORLD_WIDTH / 2, 150, m.dome_popup_clear_heart(), false, GOLD);
				}
				this.#play(event.perfect ? 'chime-big' : 'chime');
				break;
			case 'game-over':
				this.#finish();
				break;
		}
	}

	#handleImpact(event: Extract<DomeEvent, { type: 'impact' }>) {
		if (event.target === null) {
			const sea = event.x < SEA_END;
			this.#burst(event.x, event.y, sea ? 16 : 14, sea ? SPLASH : DUST);
			this.#popup(
				event.x,
				event.y - 24,
				sea ? m.dome_popup_sea() : m.dome_popup_field(),
				false,
				INK_WHITE
			);
			this.#play(sea ? 'splash' : 'thud');
			return;
		}
		this.hurtCount += 1;
		this.#burst(event.x, event.y - 10, 44, ORANGE);
		const text =
			event.target === 'house'
				? m.dome_popup_hit_house()
				: event.target === 'hospital'
					? m.dome_popup_hit_hospital()
					: m.dome_popup_hit_plant();
		this.#popup(event.x, event.y - 70, text, true, RED);
		this.#play('explosion-big');
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
	}
}
