/*
 * Flamingo Flight game state for the UI. The simulation itself lives in
 * $lib/game/flamingo/flamingoStep and is advanced by the canvas's fixed-timestep loop; this store
 * mirrors the numbers the page shows, queues flaps, and records the bests on game over.
 */
import { randomSeed } from '#lib/game/random.js';
import {
	createFlamingoState,
	currentSegment,
	gapsLeft,
	reviveFlamingo,
	stepFlamingo,
	type CrashCause,
	type FlamingoEvent,
	type FlamingoState,
	type Stage
} from '#lib/game/flamingo/flamingoStep.js';
import type { SiteKind } from '#lib/game/flamingo/refinery.js';
import { highscores, type Highscores } from '#lib/services/highscore.js';
import { soundManager } from '#lib/sound/soundManager.svelte.js';
import type { SoundId } from '#lib/sound/sounds.js';

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
	/** What the current segment ends in, for the approach hint */
	site = $state<SiteKind>('refinery');
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

	/** Injected for tests; defaults to the browser's local high scores */
	private scores: () => Highscores;

	constructor(seed = randomSeed(), scores: () => Highscores = highscores) {
		this.scores = scores;
		this.sim = createFlamingoState(seed);
		this.sync();
	}

	/** Reads the stored bests; call once in the browser */
	loadBests(): void {
		this.best = this.scores().get(SCORE_KEY);
		this.bestRefineries = this.scores().get(REFINERIES_KEY);
	}

	newGame(seed = randomSeed()): void {
		this.sim = createFlamingoState(seed);
		this.flapQueued = false;
		this.status = 'ready';
		this.isNewBest = false;
		this.round += 1;
		this.sync();
	}

	/**
	 * Continues the run that just ended (a bought revival): same score and progress, and the
	 * flamingo hovers again until the next flap. Allowed any number of times per run.
	 */
	revive(): void {
		if (this.status !== 'over' || !reviveFlamingo(this.sim)) return;
		this.flapQueued = false;
		this.status = 'ready';
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
			// The fart is the sound of the crash itself; the flare or mast belongs to the target, so
			// only a "dumber" crash gets it and the flare keeps the plain clank
			const crashedDumb =
				event.type === 'crash' && event.cause !== 'flare' && event.cause !== 'mast';
			const sound = crashedDumb ? 'fart' : SOUNDS[event.type];
			if (sound) soundManager().play(sound);
			if (event.type === 'strike') soundManager().play('slava-ukraini');
		}
		this.sync();
		if (this.sim.phase === 'over') this.finish();
		return true;
	}

	private sync(): void {
		const sim = this.sim;
		this.stage = sim.stage;
		this.site = currentSegment(sim).refinery.kind;
		this.score = sim.score;
		this.gapsLeft = gapsLeft(sim);
		this.gapsPassed = sim.gapsPassed;
		this.refineriesStruck = sim.refineriesStruck;
		this.tanksDestroyed = sim.tanksDestroyed;
		this.crash = sim.crash;
	}

	private finish(): void {
		this.status = 'over';
		const score = this.scores().submit(SCORE_KEY, this.score);
		const refineries = this.scores().submit(REFINERIES_KEY, this.refineriesStruck);
		// After a revival the best may already have been beaten earlier in this run
		this.isNewBest ||= score.isNewBest;
		this.best = score.best;
		this.bestRefineries = refineries.best;
	}
}
