/*
 * Shahed Shootdown game store: wraps the pure step logic with player input, visual effects,
 * banners, the commander's mood, settings and personal bests. The simulation state itself is a
 * plain object (read by the canvas every frame); only what the page chrome shows is reactive.
 */
import { createRandom, randomInt, randomSeed, type Random } from '$lib/game/random';
import { prefersReducedMotion } from '$lib/game/loop';
import {
	INTERMISSION_MS,
	STARTING_LIVES,
	commanderPose,
	createGame,
	stepGame,
	type CommanderPose,
	type ShootdownEvent,
	type ShootdownState
} from '$lib/game/shootdown/shootdownStep';
import {
	createClouds,
	driftClouds,
	drawScenePreview,
	type Cloud,
	type Effect,
	type SceneExtras
} from '$lib/game/shootdown/render';
import { highscores } from '$lib/services/highscore';
import { localStore } from '$lib/services/storage';
import { soundManager } from '$lib/sound/soundManager.svelte';

export type ShootdownStatus = 'ready' | 'playing' | 'paused' | 'over';

export type ShootdownBanner =
	| { kind: 'incoming'; wave: number; boss: boolean }
	| { kind: 'cleared'; bonus: number }
	| { kind: 'hit' };

export interface ShootdownSettings {
	autoFire: boolean;
}

const SETTINGS_KEY = 'shootdown:settings';
const SCORE_KEY = ['shootdown', 'score'];
const WAVE_KEY = ['shootdown', 'wave'];

const isSettings = (value: unknown): value is ShootdownSettings =>
	typeof value === 'object' &&
	value !== null &&
	typeof (value as ShootdownSettings).autoFire === 'boolean';

/** A tap on Fire during the reload still fires if the reload ends within this time */
const FIRE_BUFFER_MS = 150;
const REACTION_MS = 2800;
const SHAKE_MS = 350;
/** Number of blimp reaction lines (shootdown_blimp_1 to _3) */
export const BLIMP_LINES = 3;

export class ShootdownGame {
	status = $state<ShootdownStatus>('ready');
	score = $state(0);
	lives = $state(STARTING_LIVES);
	wave = $state(1);
	combo = $state(0);
	commander = $state<CommanderPose>('pointing');
	banner = $state<ShootdownBanner | null>(null);
	/** 1-based index of the blimp reaction line currently shown */
	reaction = $state<number | null>(null);
	bestScore = $state<number | null>(null);
	bestWave = $state<number | null>(null);
	isNewBest = $state(false);
	autoFire = $state(false);

	/** Simulation state, deliberately not reactive */
	state: ShootdownState = createGame();
	effects: Effect[] = [];
	clouds: Cloud[] = createClouds();
	timeMs = 0;
	shakeMs = 0;
	readonly reducedMotion = prefersReducedMotion();

	#random: Random = createRandom(randomSeed());
	#flavor: Random = createRandom(randomSeed());
	#bannerMs = 0;
	#reactionMs = 0;
	#steer = { left: false, right: false };
	#dragTarget: number | null = null;
	#fireHeld = false;
	#fireBufferMs = 0;

	constructor() {
		this.autoFire = localStore().read(SETTINGS_KEY, { autoFire: false }, isSettings).autoFire;
		this.bestScore = highscores().get(SCORE_KEY);
		this.bestWave = highscores().get(WAVE_KEY);
	}

	start() {
		this.state = createGame();
		this.#random = createRandom(randomSeed());
		this.effects = [];
		this.score = 0;
		this.lives = STARTING_LIVES;
		this.wave = 1;
		this.combo = 0;
		this.isNewBest = false;
		this.reaction = null;
		this.shakeMs = 0;
		this.releaseInputs();
		this.#showBanner({ kind: 'incoming', wave: 1, boss: false }, 1600);
		this.#syncChrome();
		this.status = 'playing';
	}

	pause() {
		if (this.status === 'playing') this.status = 'paused';
		this.releaseInputs();
	}

	resume() {
		if (this.status === 'paused') this.status = 'playing';
	}

	togglePause() {
		if (this.status === 'playing') this.pause();
		else this.resume();
	}

	setAutoFire(autoFire: boolean) {
		this.autoFire = autoFire;
		localStore().write(SETTINGS_KEY, { autoFire } satisfies ShootdownSettings);
	}

	steer(direction: -1 | 1, pressed: boolean) {
		this.#steer[direction === -1 ? 'left' : 'right'] = pressed;
	}

	/** Drag target in world units, or null when the drag ends */
	dragTo(x: number | null) {
		this.#dragTarget = x;
	}

	pressFire() {
		this.#fireBufferMs = FIRE_BUFFER_MS;
	}

	holdFire(held: boolean) {
		this.#fireHeld = held;
		if (held) this.pressFire();
	}

	releaseInputs() {
		this.#steer = { left: false, right: false };
		this.#dragTarget = null;
		this.#fireHeld = false;
		this.#fireBufferMs = 0;
	}

	/** One fixed step: called by the canvas game loop */
	update(dtMs: number) {
		driftClouds(this.clouds, dtMs, this.reducedMotion ? 2 : 7);
		this.#ageEffects(dtMs);
		if (this.status !== 'playing') return;

		this.timeMs += dtMs;
		const left = this.#steer.left;
		const right = this.#steer.right;
		const fire = this.autoFire || this.#fireHeld || this.#fireBufferMs > 0;
		const missilesBefore = this.state.missiles.length;
		const events = stepGame(
			this.state,
			{ move: left === right ? 0 : left ? -1 : 1, targetX: this.#dragTarget, fire },
			this.#random,
			dtMs
		);
		this.#fireBufferMs = Math.max(0, this.#fireBufferMs - dtMs);
		if (this.state.missiles.length > missilesBefore) {
			this.#fireBufferMs = 0;
			soundManager().play('patriot-launch');
		}

		for (const event of events) this.#handle(event);
		this.#syncChrome();
	}

	/** Extra drawing state for the renderer */
	sceneExtras(): SceneExtras {
		const shaking = this.shakeMs > 0 && !this.reducedMotion;
		const amplitude = shaking ? (this.shakeMs / SHAKE_MS) * 5 : 0;
		return {
			clouds: this.clouds,
			effects: this.effects,
			timeMs: this.timeMs,
			shakeX: Math.sin(this.timeMs / 17) * amplitude,
			shakeY: Math.cos(this.timeMs / 23) * amplitude
		};
	}

	/** Draws the final playfield onto the shared score card */
	drawBoard = (context: CanvasRenderingContext2D, x: number, y: number, size: number) => {
		drawScenePreview(context, this.state, { ...this.sceneExtras(), effects: [] }, x, y, size);
	};

	#handle(event: ShootdownEvent) {
		const explosionMs = this.reducedMotion ? 220 : 450;
		switch (event.type) {
			case 'drone-destroyed':
				this.#explode(event.x, event.y, 38, explosionMs);
				this.#popup(event.x, event.y, event.points);
				soundManager().play('explosion-small');
				break;
			case 'diver-crashed':
				this.#explode(event.x, event.y, 34, explosionMs);
				soundManager().play('shahed-impact');
				break;
			case 'boss-hit':
				this.#explode(event.x, event.y, 22, explosionMs);
				this.#popup(event.x, event.y, event.points);
				soundManager().play('hit');
				break;
			case 'boss-destroyed':
				this.#explode(event.x, event.y, 110, explosionMs * 1.6);
				this.#popup(event.x, event.y, event.points);
				this.shakeMs = SHAKE_MS;
				soundManager().play('explosion-big');
				break;
			case 'blimp-hit':
				this.#explode(event.x, event.y + 12, 56, explosionMs);
				this.#popup(event.x, event.y + 30, event.points);
				this.reaction = randomInt(this.#flavor, 1, BLIMP_LINES + 1);
				this.#reactionMs = REACTION_MS;
				soundManager().play('explosion-big');
				break;
			case 'bunker-hit':
				this.effects.push({ kind: 'dust', x: event.x, y: event.y, ageMs: 0, durationMs: 300 });
				soundManager().play('thud');
				break;
			case 'life-lost':
				this.shakeMs = SHAKE_MS;
				this.#showBanner({ kind: 'hit' }, 1300);
				soundManager().play('alarm');
				break;
			case 'wave-cleared':
				this.#showBanner({ kind: 'cleared', bonus: event.bonus }, INTERMISSION_MS);
				soundManager().play('chime-big');
				break;
			case 'wave-started':
				if (event.wave > 1) {
					this.#showBanner({ kind: 'incoming', wave: event.wave, boss: event.boss }, 1600);
					soundManager().play('alarm');
				}
				break;
			case 'game-over':
				this.#finish();
				break;
		}
	}

	#explode(x: number, y: number, size: number, durationMs: number) {
		this.effects.push({ kind: 'explosion', x, y, size, ageMs: 0, durationMs });
	}

	#popup(x: number, y: number, points: number) {
		const durationMs = this.reducedMotion ? 500 : 800;
		this.effects.push({ kind: 'popup', x, y, text: `+${points}`, ageMs: 0, durationMs });
	}

	#showBanner(banner: ShootdownBanner, durationMs: number) {
		this.banner = banner;
		this.#bannerMs = durationMs;
	}

	#ageEffects(dtMs: number) {
		if (this.status !== 'playing') return;
		for (const effect of this.effects) effect.ageMs += dtMs;
		this.effects = this.effects.filter((effect) => effect.ageMs < effect.durationMs);
		this.shakeMs = Math.max(0, this.shakeMs - dtMs);
		if (this.#bannerMs > 0) {
			this.#bannerMs -= dtMs;
			if (this.#bannerMs <= 0) this.banner = null;
		}
		if (this.#reactionMs > 0) {
			this.#reactionMs -= dtMs;
			if (this.#reactionMs <= 0) this.reaction = null;
		}
	}

	#syncChrome() {
		this.score = this.state.score;
		this.lives = this.state.lives;
		this.wave = this.state.wave;
		this.combo = this.state.combo;
		this.commander = commanderPose(this.state);
	}

	#finish() {
		this.#syncChrome();
		const scoreResult = highscores().submit(SCORE_KEY, this.state.score);
		const waveResult = highscores().submit(WAVE_KEY, this.state.wave);
		this.isNewBest = scoreResult.isNewBest;
		this.bestScore = scoreResult.best;
		this.bestWave = waveResult.best;
		this.banner = null;
		this.releaseInputs();
		this.status = 'over';
	}
}
