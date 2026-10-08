/*
 * Run Comrade game store: wraps the pure step logic with the player's commands, visual effects,
 * sounds (including the drone's buzz, which stands in for sight among the tall sunflowers) and the
 * personal best. The simulation state is a plain object read by the canvas every frame; only what
 * the page chrome shows is reactive, synced after each step.
 */
import { createRandom, randomSeed, type Random } from '#lib/game/random.js';
import { BOOST_MS, STARTING_LIVES } from '#lib/game/runcomrade/config.js';
import {
	buzzIntensity,
	buzzIntervalMs,
	dronePan,
	maneuverIntensity,
	maneuverSoundDue
} from '#lib/game/runcomrade/drone.js';
import { laneX, RUNNER_Y } from '#lib/game/runcomrade/projection.js';
import { drawScenePreview, type Effect, type SceneExtras } from '#lib/game/runcomrade/render.js';
import { createGame, scoreOf, type RunEvent, type RunState } from '#lib/game/runcomrade/state.js';
import { command, stepGame, type Command } from '#lib/game/runcomrade/step.js';
import { m } from '#lib/paraglide/messages.js';
import { highscores, type Highscores } from '#lib/services/highscore.js';
import { soundManager } from '#lib/sound/soundManager.svelte.js';
import type { SoundId } from '#lib/sound/sounds.js';

export type RunComradeStatus = 'ready' | 'playing' | 'paused' | 'over';

const SCORE_KEY = ['runcomrade', 'score'] as const;
const DISTANCE_KEY = ['runcomrade', 'distance'] as const;

export interface RunComradeOptions {
	reducedMotion?: boolean;
	/** Injected for tests; defaults to the browser's local high scores */
	scores?: () => Highscores;
	/** Fixed seed for tests; a fresh random seed per run otherwise */
	seed?: () => number;
}

export class RunComradeGame {
	status = $state<RunComradeStatus>('ready');
	score = $state(0);
	lives = $state(STARTING_LIVES);
	/** Whole units run */
	distance = $state(0);
	stumbles = $state(0);
	helmets = $state(0);
	bowls = $state(0);
	/** Share of the helmet boost left, in steps of a twentieth; 0 when none */
	boostLeft = $state(0);
	shield = $state(false);
	/** Counts up whenever a heart is lost, so the field can flash */
	hurtCount = $state(0);
	best = $state<number | null>(null);
	bestDistance = $state<number | null>(null);
	isNewBest = $state(false);

	/** Simulation state, deliberately not reactive */
	state: RunState;
	effects: Effect[] = [];

	readonly reducedMotion: boolean;
	#random: Random = createRandom(1);
	#scores: () => Highscores;
	#seed: () => number;
	#buzzMs = 0;
	#clockMs = 0;
	#lastManeuverMs: number | null = null;

	constructor({
		reducedMotion = false,
		scores = highscores,
		seed = randomSeed
	}: RunComradeOptions = {}) {
		this.reducedMotion = reducedMotion;
		this.#scores = scores;
		this.#seed = seed;
		this.state = createGame();
		this.#syncChrome();
	}

	/** Reads the stored bests; call in the browser only */
	loadBest() {
		this.best = this.#scores().get(SCORE_KEY);
		this.bestDistance = this.#scores().get(DISTANCE_KEY);
	}

	start() {
		const seed = this.#seed();
		this.#random = createRandom(seed);
		this.state = createGame(seed);
		this.effects = [];
		this.isNewBest = false;
		this.#buzzMs = 1200;
		this.#clockMs = 0;
		this.#lastManeuverMs = null;
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

	/** A swipe, tap or key press: change lane, jump or duck */
	command(action: Command) {
		if (this.status !== 'playing') return;
		this.#apply(command(this.state, action));
	}

	/** One fixed step: called by the canvas game loop */
	update(dtMs: number) {
		this.#ageEffects(dtMs);
		if (this.status !== 'playing') return;
		this.#clockMs += dtMs;
		this.#apply(stepGame(this.state, this.#random, dtMs));
		this.#buzz(dtMs);
	}

	sceneExtras(): SceneExtras {
		return { effects: this.effects, reducedMotion: this.reducedMotion };
	}

	/** Draws the final scene onto the shared score card */
	drawBoard = (context: CanvasRenderingContext2D, x: number, y: number, size: number) => {
		drawScenePreview(context, this.state, x, y, size);
	};

	/** The drone's buzz: quicker and louder as it closes in, loudest when it cannot be seen */
	#buzz(dtMs: number) {
		if (this.state.over) return;
		this.#buzzMs -= dtMs;
		if (this.#buzzMs > 0) return;
		const { gap } = this.state.drone;
		soundManager().play('drone-buzz', buzzIntensity(gap, this.state.hidden));
		this.#buzzMs = buzzIntervalMs(gap);
	}

	#apply(events: readonly RunEvent[]) {
		for (const event of events) this.#handle(event);
		this.#syncChrome();
	}

	#handle(event: RunEvent) {
		const short = this.reducedMotion ? 0.5 : 1;
		const x = laneX(this.state.runner.x, 0);
		const y = RUNNER_Y - 70;
		const popup = (text: string, big: boolean, duration = 800) =>
			this.effects.push({
				kind: 'popup',
				x,
				y,
				text,
				big,
				ageMs: 0,
				durationMs: duration * short + 150
			});
		switch (event.type) {
			case 'stumble':
				this.effects.push({ kind: 'poof', x, y: y + 30, ageMs: 0, durationMs: 520 * short + 80 });
				popup(m.runcomrade_popup_stumble(), false);
				this.#play(
					event.kind === 'mine' ? 'mine-explosion' : event.kind === 'ditch' ? 'thud' : 'hit'
				);
				break;
			case 'smash':
				this.effects.push({ kind: 'poof', x, y: y + 30, ageMs: 0, durationMs: 420 * short + 80 });
				this.#play('explosion-tiny');
				break;
			case 'shield-block':
				this.effects.push({ kind: 'ring', x, y, ageMs: 0, durationMs: 420 * short + 80 });
				popup(m.runcomrade_popup_blocked(), true);
				this.#play('sparkle');
				break;
			case 'pickup':
				if (event.kind === 'helmet') {
					popup(m.runcomrade_popup_boost(), true);
					this.#play('chime');
				} else {
					popup(m.runcomrade_popup_shield(), true);
					this.#play('pickup');
				}
				break;
			case 'contact':
				this.hurtCount += 1;
				this.effects.push({ kind: 'ring', x, y, ageMs: 0, durationMs: 500 * short + 100 });
				this.effects.push({
					kind: 'popup',
					x,
					y: y - 28,
					text: '-1 ♥',
					big: true,
					ageMs: 0,
					durationMs: 900 * short + 150
				});
				this.#play('alarm');
				break;
			case 'game-over':
				this.#finish();
				break;
			case 'drone-maneuver':
				// A short, distinct brzzz, never stacked, and the steady buzz waits for it to finish
				if (maneuverSoundDue(this.#clockMs, this.#lastManeuverMs)) {
					this.#lastManeuverMs = this.#clockMs;
					soundManager().play('drone-brzzz', maneuverIntensity(event.gap), dronePan(event.x));
					this.#buzzMs = Math.max(this.#buzzMs, 450);
				}
				break;
			case 'jump':
			case 'duck':
			case 'land':
			case 'lane':
			case 'boost-end':
				break;
		}
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
		this.score = scoreOf(state);
		this.lives = state.lives;
		this.distance = Math.floor(state.distance);
		this.stumbles = state.stumbles;
		this.helmets = state.pickups.helmet;
		this.bowls = state.pickups.rice;
		this.boostLeft = Math.ceil((state.power.boostMs / BOOST_MS) * 20) / 20;
		this.shield = state.power.shield;
	}

	#finish() {
		this.#syncChrome();
		const scores = this.#scores();
		const result = scores.submit(SCORE_KEY, this.score);
		this.isNewBest = result.isNewBest;
		this.best = result.best;
		this.bestDistance = scores.submit(DISTANCE_KEY, this.distance).best;
		this.status = 'over';
	}
}
