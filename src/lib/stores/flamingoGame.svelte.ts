/*
 * Flamingo Flight game state for the UI. The simulation itself lives in
 * $lib/game/flamingo/flamingoStep and is advanced by the canvas's fixed-timestep loop; this store
 * mirrors the numbers the page shows, queues flaps, and records the bests on game over.
 */
import { randomSeed } from '$lib/game/random';
import {
	createFlamingoState,
	gapsLeft,
	stepFlamingo,
	type CrashCause,
	type FlamingoEvent,
	type FlamingoState,
	type Stage
} from '$lib/game/flamingo/flamingoStep';
import { highscores } from '$lib/services/highscore';
import { soundManager } from '$lib/sound/soundManager.svelte';
import type { SoundId } from '$lib/sound/sounds';

const SOUNDS: Partial<Record<FlamingoEvent['type'], SoundId>> = {
	flap: 'flap',
	gap: 'ding',
	approach: 'alarm',
	strike: 'chime',
	crash: 'hit'
};

export type FlamingoStatus = 'ready' | 'playing' | 'paused' | 'over';

const SCORE_KEY = ['flamingo', 'score'];
const REFINERIES_KEY = ['flamingo', 'refineries'];

export class FlamingoGame {
	status = $state<FlamingoStatus>('ready');
	stage = $state<Stage>('gaps');
	score = $state(0);
	gapsLeft = $state(0);
	gapsPassed = $state(0);
	refineriesStruck = $state(0);
	tanksDestroyed = $state(0);
	crash = $state<CrashCause | null>(null);
	best = $state<number | null>(null);
	bestRefineries = $state<number | null>(null);
	isNewBest = $state(false);
	/** Bumped on every new game so the canvas can reset its effects */
	round = $state(0);

	/** The simulation is mutated sixty times a second, so it is deliberately not reactive */
	sim: FlamingoState;
	private flapQueued = false;

	constructor(seed = randomSeed()) {
		this.sim = createFlamingoState(seed);
		this.sync();
	}

	/** Reads the stored bests; call once in the browser */
	loadBests(): void {
		this.best = highscores().get(SCORE_KEY);
		this.bestRefineries = highscores().get(REFINERIES_KEY);
	}

	newGame(seed = randomSeed()): void {
		this.sim = createFlamingoState(seed);
		this.flapQueued = false;
		this.status = 'ready';
		this.isNewBest = false;
		this.round += 1;
		this.sync();
	}

	flap(): void {
		if (this.status === 'ready') this.status = 'playing';
		if (this.status === 'playing') this.flapQueued = true;
	}

	pause(): void {
		if (this.status === 'playing') this.status = 'paused';
	}

	resume(): void {
		if (this.status === 'paused') this.status = 'playing';
	}

	/** Advances the simulation by one fixed step; returns whether it moved on */
	update(dt: number): boolean {
		if (this.status !== 'playing' && this.status !== 'ready') return false;
		stepFlamingo(this.sim, this.flapQueued, dt);
		this.flapQueued = false;
		for (const event of this.sim.events) {
			const sound = SOUNDS[event.type];
			if (sound) soundManager().play(sound);
		}
		this.sync();
		if (this.sim.phase === 'over') this.finish();
		return true;
	}

	private sync(): void {
		const sim = this.sim;
		this.stage = sim.stage;
		this.score = sim.score;
		this.gapsLeft = gapsLeft(sim);
		this.gapsPassed = sim.gapsPassed;
		this.refineriesStruck = sim.refineriesStruck;
		this.tanksDestroyed = sim.tanksDestroyed;
		this.crash = sim.crash;
	}

	private finish(): void {
		this.status = 'over';
		const score = highscores().submit(SCORE_KEY, this.score);
		const refineries = highscores().submit(REFINERIES_KEY, this.refineriesStruck);
		this.isNewBest = score.isNewBest;
		this.best = score.best;
		this.bestRefineries = refineries.best;
	}
}
