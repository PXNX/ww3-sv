/*
 * Convoy Runner game state. The runner itself is plain data stepped by the fixed loop and read by
 * the canvas every frame; only the numbers the page displays are reactive, and they are synced
 * after each step so the interface does not re-render sixty times a second.
 */
import { MAX_HULL } from '#lib/game/convoy/constants.js';
import type { ConvoyEffect } from '#lib/game/convoy/drawScene.js';
import {
	createRunner,
	dragShip,
	grabShip,
	multiplierFor,
	releaseShip,
	reviveRunner,
	runnerNauticalMiles,
	runnerScore,
	shipRange,
	steer,
	stepRunner,
	tiltShip,
	type RunnerEventType,
	type RunnerState
} from '#lib/game/convoy/runnerStep.js';
import { TiltSteering, tiltLane } from '#lib/game/convoy/tilt.js';
import { createRandom, randomSeed, type Random } from '#lib/game/random.js';
import { highscores, type Highscores } from '#lib/services/highscore.js';
import { soundManager } from '#lib/sound/soundManager.svelte.js';
import type { SoundId } from '#lib/sound/sounds.js';

export type ConvoyStatus = 'ready' | 'running' | 'paused' | 'over';

const EFFECTS: Partial<Record<RunnerEventType, Pick<ConvoyEffect, 'kind' | 'durationMs'>>> = {
	hit: { kind: 'explosion', durationMs: 520 },
	shield: { kind: 'shield', durationMs: 480 },
	barrel: { kind: 'sparkle', durationMs: 380 },
	escort: { kind: 'sparkle', durationMs: 380 },
	escortBonus: { kind: 'sparkle', durationMs: 380 },
	slick: { kind: 'splash', durationMs: 420 }
};

const SOUNDS: Partial<Record<RunnerEventType, SoundId>> = {
	hit: 'explosion-small',
	shield: 'sparkle',
	barrel: 'pickup',
	escort: 'chime',
	escortBonus: 'chime-big',
	slick: 'splash',
	nearMiss: 'whoosh'
};

const SHAKE_MS = 280;

const SCORE_KEY = ['convoy', 'score'] as const;
const DISTANCE_KEY = ['convoy', 'distance'] as const;

export interface ConvoyGameOptions {
	reducedMotion?: boolean;
	/** Injected for tests; defaults to the browser's local high scores */
	scores?: () => Highscores;
	/** Fixed seed for tests; a fresh random seed per run otherwise */
	seed?: () => number;
}

export class ConvoyGame {
	status = $state<ConvoyStatus>('ready');
	score = $state(0);
	hull = $state(MAX_HULL);
	/** Distance in nautical miles, rounded to a tenth */
	distance = $state(0);
	barrels = $state(0);
	multiplier = $state(1);
	escort = $state(false);
	/** Counts up on every near miss, so the page can pop a message */
	nearMisses = $state(0);
	/** Counts up whenever the escort absorbs a hit */
	shieldSaves = $state(0);
	best = $state<number | null>(null);
	bestDistance = $state<number | null>(null);
	isNewBest = $state(false);
	/**
	 * True once the phone has actually reported a tilt: from then on the tanker is steered by
	 * tilting it, and touches on the field no longer grab it. Stays false on devices without a
	 * usable sensor (most desktops, refused permission), which keep the touch controls.
	 */
	tiltOn = $state(false);

	/** Not reactive on purpose: read by the canvas on every frame */
	runner: RunnerState = createRunner();
	effects: ConvoyEffect[] = [];
	shakeMs = 0;

	/** The sensor listener; it only reports the first reading, the game polls the deflection */
	readonly tilt = new TiltSteering(() => {
		this.tiltOn = true;
	});

	readonly reducedMotion: boolean;
	#random: Random = createRandom(1);
	#scores: () => Highscores;
	#seed: () => number;
	/** The stored best when the run started, so a revived run is not compared against itself */
	#bestBeforeRun: number | null = null;

	constructor({
		reducedMotion = false,
		scores = highscores,
		seed = randomSeed
	}: ConvoyGameOptions = {}) {
		this.reducedMotion = reducedMotion;
		this.#scores = scores;
		this.#seed = seed;
	}

	/** Reads the stored bests; call in the browser only */
	loadBest() {
		this.best = this.#scores().get(SCORE_KEY);
		this.bestDistance = this.#scores().get(DISTANCE_KEY);
	}

	start() {
		this.#random = createRandom(this.#seed());
		this.#bestBeforeRun = this.#scores().get(SCORE_KEY);
		this.runner = createRunner();
		this.effects = [];
		this.shakeMs = 0;
		this.isNewBest = false;
		this.nearMisses = 0;
		this.shieldSaves = 0;
		this.#sync();
		this.status = 'running';
		// Asks for motion access on iOS, where that only works from a tap (this is called by one)
		void this.tilt.start();
	}

	/** Continues a finished run with one hull point (a bought revival; any number per run) */
	revive() {
		if (this.status !== 'over') return;
		this.runner = reviveRunner(this.runner);
		this.shakeMs = 0;
		this.#sync();
		this.status = 'running';
		// The phone has probably been moved while the game-over card was up
		this.tilt.recalibrate();
	}

	/** Stops listening for tilt; call it when the playfield goes away */
	stopTilt() {
		this.tilt.stop();
		this.tiltOn = false;
	}

	pause() {
		if (this.status === 'running') this.status = 'paused';
	}

	resume() {
		if (this.status === 'paused') this.status = 'running';
	}

	togglePause() {
		if (this.status === 'running') this.pause();
		else this.resume();
	}

	steer(direction: -1 | 1) {
		if (this.status !== 'running') return;
		this.runner = steer(this.runner, direction);
		soundManager().play('click');
	}

	/** Takes hold of the tanker (a finger or the mouse went down); false when it cannot be held now */
	grabShip(): boolean {
		if (this.status !== 'running') return false;
		this.runner = grabShip(this.runner);
		return this.runner.dragX !== null;
	}

	/** Moves the held tanker to x lanes, 1:1 with the pointer; the runner clamps it to the open water */
	dragShipTo(x: number) {
		if (this.status !== 'running') return;
		this.runner = dragShip(this.runner, x);
	}

	/** Lets go of the tanker; it settles into the nearest lane */
	releaseShip() {
		this.runner = releaseShip(this.runner);
	}

	/** Advances the game by one fixed step */
	update(stepMs: number) {
		if (this.status !== 'running') return;
		// Telegram's sensor only updates its own fields, so it is read here, once per step
		this.tilt.poll();
		// Tilt steering is analog: it eases the tanker towards a point in the open water, so it
		// behaves like a finger held on the ship. Touch and keyboard are untouched by it.
		if (this.tilt.active) {
			const target = tiltLane(this.tilt.deflection, shipRange(this.runner));
			this.runner = tiltShip(this.runner, target, stepMs);
		}
		this.runner = stepRunner(this.runner, stepMs, this.#random, {
			reducedMotion: this.reducedMotion
		});

		for (const effect of this.effects) effect.ageMs += stepMs;
		this.effects = this.effects.filter((effect) => effect.ageMs < effect.durationMs);
		this.shakeMs = Math.max(0, this.shakeMs - stepMs);

		for (const event of this.runner.events) {
			const effect = EFFECTS[event.type];
			if (effect) this.effects.push({ ...effect, x: event.x, y: event.y, ageMs: 0 });
			if (event.type === 'hit' && !this.reducedMotion) this.shakeMs = SHAKE_MS;
			if (event.type === 'nearMiss') this.nearMisses++;
			if (event.type === 'shield') this.shieldSaves++;
			const sound = SOUNDS[event.type];
			if (sound) soundManager().play(sound);
		}

		this.#sync();
		if (this.runner.over) this.#finish();
	}

	#sync() {
		const runner = this.runner;
		this.score = runnerScore(runner);
		this.hull = runner.hull;
		this.distance = Math.floor(runnerNauticalMiles(runner) * 10) / 10;
		this.barrels = runner.barrels;
		this.multiplier = multiplierFor(runner.nearMissStreak);
		this.escort = runner.escort;
	}

	#finish() {
		this.status = 'over';
		const scores = this.#scores();
		this.best = scores.submit(SCORE_KEY, this.score).best;
		// After a revival the stored best may be this very run, so compare with the best before it
		this.isNewBest =
			this.#bestBeforeRun === null ? this.score > 0 : this.score > this.#bestBeforeRun;
		this.bestDistance = scores.submit(DISTANCE_KEY, this.distance).best;
	}
}
