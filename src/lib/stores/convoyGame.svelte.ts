/*
 * Convoy Runner game state. The runner itself is plain data stepped by the fixed loop and read by
 * the canvas every frame; only the numbers the page displays are reactive, and they are synced
 * after each step so the interface does not re-render sixty times a second.
 */
import { MAX_HULL } from '$lib/game/convoy/constants';
import type { ConvoyEffect } from '$lib/game/convoy/drawScene';
import {
	createRunner,
	multiplierFor,
	runnerNauticalMiles,
	runnerScore,
	steer,
	stepRunner,
	type RunnerEventType,
	type RunnerState
} from '$lib/game/convoy/runnerStep';
import { createRandom, randomSeed, type Random } from '$lib/game/random';
import { highscores, type Highscores } from '$lib/services/highscore';

export type ConvoyStatus = 'ready' | 'running' | 'paused' | 'over';

const EFFECTS: Partial<Record<RunnerEventType, Pick<ConvoyEffect, 'kind' | 'durationMs'>>> = {
	hit: { kind: 'explosion', durationMs: 520 },
	shield: { kind: 'shield', durationMs: 480 },
	barrel: { kind: 'sparkle', durationMs: 380 },
	escort: { kind: 'sparkle', durationMs: 380 },
	escortBonus: { kind: 'sparkle', durationMs: 380 },
	slick: { kind: 'splash', durationMs: 420 }
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

	/** Not reactive on purpose: read by the canvas on every frame */
	runner: RunnerState = createRunner();
	effects: ConvoyEffect[] = [];
	shakeMs = 0;

	readonly reducedMotion: boolean;
	#random: Random = createRandom(1);
	#scores: () => Highscores;
	#seed: () => number;

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
		this.runner = createRunner();
		this.effects = [];
		this.shakeMs = 0;
		this.isNewBest = false;
		this.nearMisses = 0;
		this.shieldSaves = 0;
		this.#sync();
		this.status = 'running';
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
	}

	/** Advances the game by one fixed step */
	update(stepMs: number) {
		if (this.status !== 'running') return;
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
		const result = scores.submit(SCORE_KEY, this.score);
		this.isNewBest = result.isNewBest;
		this.best = result.best;
		this.bestDistance = scores.submit(DISTANCE_KEY, this.distance).best;
	}
}
