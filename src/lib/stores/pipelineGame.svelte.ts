/*
 * Pipeline Panic session: runs the pure game logic on a fixed-timestep loop and publishes a
 * snapshot for rendering once per frame. Unchanged tiles keep their snapshot object, so only
 * the tiles that actually changed are redrawn.
 */
import { createFixedLoop, onAppHidden, type FixedLoop } from '$lib/game/loop';
import { createRandom, randomSeed, type Random } from '$lib/game/random';
import type { Tile } from '$lib/game/pipeline/pipeGrid';
import {
	createGame,
	finalScore,
	intercept,
	isDifficulty,
	rotateTile,
	startRepair,
	stepGame,
	stopRepair,
	type Difficulty,
	type PipelineState
} from '$lib/game/pipeline/pipelineStep';
import { highscores } from '$lib/services/highscore';
import { localStore } from '$lib/services/storage';

const DIFFICULTY_KEY = 'pipeline:difficulty';
const STEP_MS = 1000 / 60;

export type PipelineView = Readonly<PipelineState>;

export interface PipelineResult {
	score: number;
	isNewBest: boolean;
	tankers: number;
	bestTankers: number | null;
}

function sameTile(a: Tile, b: Tile) {
	return (
		a.kind === b.kind && a.rotation === b.rotation && a.broken === b.broken && a.repair === b.repair
	);
}

export class PipelineGame {
	difficulty = $state<Difficulty>('normal');
	/** Increases with every new board, so the grid can re-key its tiles */
	gameId = $state(0);
	view = $state.raw<PipelineView>() as PipelineView;
	paused = $state(false);
	/** When on, a single tap keeps the wrench working until the tile is fixed */
	handsFree = $state(false);
	best = $state<number | null>(null);
	result = $state<PipelineResult | null>(null);

	#game!: PipelineState;
	#random: Random = createRandom(randomSeed());
	#loop: FixedLoop | null = null;

	constructor() {
		this.difficulty = localStore().read(DIFFICULTY_KEY, 'normal', isDifficulty);
		this.newGame();
	}

	/** Starts the loop and the auto-pause; call from the page once it is mounted */
	mount(): () => void {
		this.#loop = createFixedLoop({
			stepMs: STEP_MS,
			update: (stepMs) => this.#update(stepMs),
			render: () => this.#publish()
		});
		if (!this.paused && !this.result) this.#loop.start();
		const stopHidden = onAppHidden(() => this.pause());
		return () => {
			stopHidden();
			this.#loop?.pause();
			this.#loop = null;
		};
	}

	setDifficulty(level: Difficulty) {
		this.difficulty = level;
		localStore().write(DIFFICULTY_KEY, level);
		this.newGame();
	}

	newGame() {
		this.#random = createRandom(randomSeed());
		this.#game = createGame(this.#random, this.difficulty);
		this.gameId++;
		this.result = null;
		this.paused = false;
		this.best = highscores().get(['pipeline', this.difficulty, 'score']);
		this.#publish(true);
		this.#loop?.start();
	}

	pause() {
		if (this.result || this.paused) return;
		this.paused = true;
		stopRepair(this.#game);
		this.#loop?.pause();
		this.#publish();
	}

	resume() {
		if (this.result || !this.paused) return;
		this.paused = false;
		this.#loop?.start();
	}

	rotate(cell: number) {
		if (this.paused) return;
		if (rotateTile(this.#game, cell)) this.#publish();
	}

	pressRepair(cell: number) {
		if (this.paused) return;
		if (startRepair(this.#game, cell)) this.#publish();
	}

	releaseRepair() {
		if (this.handsFree) return;
		stopRepair(this.#game);
	}

	intercept(strikeId: number) {
		if (this.paused) return;
		if (intercept(this.#game, strikeId)) this.#publish();
	}

	#update(stepMs: number) {
		stepGame(this.#game, stepMs, this.#random);
		if (this.#game.phase === 'over' && !this.result) this.#finish();
	}

	#finish() {
		this.#loop?.pause();
		const level = this.#game.difficulty;
		const score = finalScore(this.#game);
		const scoreResult = highscores().submit(['pipeline', level, 'score'], score);
		const tankerResult = highscores().submit(
			['pipeline', level, 'tankers'],
			this.#game.tankersFilled
		);
		this.best = scoreResult.best;
		this.result = {
			score,
			isNewBest: scoreResult.isNewBest,
			tankers: this.#game.tankersFilled,
			bestTankers: tankerResult.best
		};
		this.#publish();
	}

	/** Copies the mutable game state into a fresh snapshot for the components */
	#publish(fresh = false) {
		const game = this.#game;
		const previous = fresh ? undefined : this.view?.grid.tiles;
		const tiles = game.grid.tiles.map((tile, cell) => {
			const old = previous?.[cell];
			return old && sameTile(old, tile) ? old : { ...tile };
		});
		this.view = {
			...game,
			grid: { ...game.grid, tiles },
			strikes: game.strikes.map((strike) => ({ ...strike })),
			effects: game.effects.map((effect) => ({ ...effect }))
		};
	}
}
