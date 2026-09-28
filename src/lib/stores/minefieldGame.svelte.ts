/*
 * Minefield game state: wraps the pure rules in src/lib/game/minefield with the tools, tankers,
 * submarines, timer and personal bests. The page only calls methods and reads fields.
 */
import { findChannel } from '$lib/game/minefield/channelPathfinding';
import {
	DEFAULT_DIFFICULTY,
	DIFFICULTIES,
	TANKER_COUNT,
	isDifficultyId,
	type DifficultyId
} from '$lib/game/minefield/difficulty';
import {
	chord,
	countFlags,
	countRevealedSafe,
	createBoard,
	mineCountFor,
	minesRemaining,
	placeMines,
	revealCell,
	toggleFlag,
	type Board,
	type BoardChange
} from '$lib/game/minefield/minefieldBoard';
import { liveScore, scoreGame, type ScoreBreakdown } from '$lib/game/minefield/scoring';
import { canDeploySubmarine, submarineSweep } from '$lib/game/minefield/submarineSweep';
import { createRandom, randomSeed, type Random } from '$lib/game/random';
import { highscores, type Highscores } from '$lib/services/highscore';
import { localStore, type Store } from '$lib/services/storage';
import { soundManager } from '$lib/sound/soundManager.svelte';
import type { SoundId } from '$lib/sound/sounds';

const EVENT_SOUNDS: Record<MinefieldEventDetail['kind'], SoundId> = {
	explosion: 'explosion-small',
	defused: 'sparkle',
	'needs-water': 'ui-error'
};

export type MinefieldPhase = 'ready' | 'playing' | 'won' | 'lost';

export type MinefieldTool = 'reveal' | 'flag' | 'submarine';

export type MinefieldEventDetail =
	| { kind: 'explosion'; cells: number[] }
	| { kind: 'defused'; cells: number[]; count: number }
	| { kind: 'needs-water' };

/** Something worth telling the player about; the id lets the page replay animations */
export type MinefieldEvent = MinefieldEventDetail & { id: number };

export interface MinefieldResult {
	won: boolean;
	seconds: number;
	score: ScoreBreakdown;
	isNewBestScore: boolean;
	isNewBestTime: boolean;
	bestScore: number | null;
	bestTime: number | null;
}

export interface MinefieldGameOptions {
	store?: Store;
	scores?: Highscores;
	/** Milliseconds, for the timer */
	clock?: () => number;
	/** Seed for each new board */
	seed?: () => number;
}

const DIFFICULTY_KEY = 'minefield:difficulty';

export const bestParts = (level: DifficultyId, kind: 'score' | 'time') => [
	'minefield',
	level,
	kind
];

export class MinefieldGame {
	difficultyId: DifficultyId = $state(DEFAULT_DIFFICULTY);
	board: Board = $state.raw(createBoard(1, 1));
	phase: MinefieldPhase = $state('ready');
	tool: MinefieldTool = $state('reveal');
	tankersLeft = $state(TANKER_COUNT);
	submarinesLeft = $state(0);
	totalMines = $state(0);
	/** The winning route from west to east, once it exists */
	channel: number[] | null = $state.raw(null);
	event: MinefieldEvent | null = $state.raw(null);
	result: MinefieldResult | null = $state.raw(null);
	paused = $state(false);
	elapsedMs = $state(0);
	bestScore: number | null = $state(null);
	bestTime: number | null = $state(null);

	readonly difficulty = $derived(DIFFICULTIES[this.difficultyId]);
	readonly minesLeft = $derived(minesRemaining(this.board, this.totalMines));
	readonly score = $derived(
		this.result?.score.total ?? liveScore(this.difficulty, countRevealedSafe(this.board))
	);
	readonly isOver = $derived(this.phase === 'won' || this.phase === 'lost');

	#store: Store;
	#scores: Highscores;
	#clock: () => number;
	#seed: () => number;
	#random: Random = Math.random;
	#startedAt: number | null = null;
	#accumulatedMs = 0;
	#eventId = 0;

	constructor(options: MinefieldGameOptions = {}) {
		this.#store = options.store ?? localStore();
		this.#scores = options.scores ?? highscores();
		this.#clock = options.clock ?? (() => performance.now());
		this.#seed = options.seed ?? randomSeed;
		this.newGame(this.#store.read(DIFFICULTY_KEY, DEFAULT_DIFFICULTY, isDifficultyId));
	}

	/** Starts a fresh board; the chosen difficulty is remembered for next time */
	newGame(difficultyId: DifficultyId = this.difficultyId) {
		const { columns, rows, mineDensity, submarines } = DIFFICULTIES[difficultyId];
		if (difficultyId !== this.difficultyId) this.#store.write(DIFFICULTY_KEY, difficultyId);
		this.difficultyId = difficultyId;
		this.#random = createRandom(this.#seed());
		this.board = createBoard(columns, rows);
		this.totalMines = mineCountFor(columns, rows, mineDensity);
		this.phase = 'ready';
		this.tool = 'reveal';
		this.tankersLeft = TANKER_COUNT;
		this.submarinesLeft = submarines;
		this.channel = null;
		this.event = null;
		this.result = null;
		this.paused = false;
		this.elapsedMs = 0;
		this.#startedAt = null;
		this.#accumulatedMs = 0;
		this.bestScore = this.#scores.get(bestParts(difficultyId, 'score'));
		this.bestTime = this.#scores.get(bestParts(difficultyId, 'time'));
	}

	get canAct(): boolean {
		return (this.phase === 'ready' || this.phase === 'playing') && !this.paused;
	}

	/** A tap on a cell, interpreted by the selected tool */
	activate(index: number) {
		if (!this.canAct) return;
		const cell = this.board.cells[index];
		if (cell.state === 'revealed') {
			if (this.tool === 'submarine') this.#announce({ kind: 'needs-water' });
			else this.#apply(chord(this.board, index));
			return;
		}
		if (this.tool === 'flag') this.flag(index);
		else if (this.tool === 'submarine') this.deploySubmarine(index);
		else this.reveal(index);
	}

	reveal(index: number) {
		if (!this.canAct || this.board.cells[index].state !== 'hidden') return;
		this.#ensureMines(index);
		this.#apply(revealCell(this.board, index));
	}

	/** Places or removes a buoy flag, whatever tool is selected (long-press, right-click, F key) */
	flag(index: number) {
		if (!this.canAct) return;
		this.board = toggleFlag(this.board, index);
		soundManager().play('ui-toggle');
	}

	deploySubmarine(index: number) {
		if (!this.canAct || this.submarinesLeft <= 0) return;
		if (!canDeploySubmarine(this.board, index)) {
			this.#announce({ kind: 'needs-water' });
			return;
		}
		this.#ensureMines(index);
		const sweep = submarineSweep(this.board, index);
		this.submarinesLeft--;
		this.tool = 'reveal';
		this.#apply(
			{ board: sweep.board, revealed: sweep.revealed, detonated: [] },
			{ kind: 'defused', cells: sweep.defused, count: sweep.defused.length }
		);
	}

	toggleFlagMode() {
		this.tool = this.tool === 'flag' ? 'reveal' : 'flag';
		this.event = null;
	}

	toggleSubmarine() {
		if (this.submarinesLeft <= 0) return;
		this.tool = this.tool === 'submarine' ? 'reveal' : 'submarine';
		this.event = null;
	}

	pause() {
		if (this.phase !== 'playing' || this.paused) return;
		this.tick();
		this.#accumulatedMs = this.elapsedMs;
		this.#startedAt = null;
		this.paused = true;
	}

	resume() {
		if (!this.paused) return;
		this.paused = false;
		if (this.phase === 'playing') this.#startedAt = this.#clock();
	}

	/** Updates the visible timer; called a few times per second by the page */
	tick() {
		if (this.#startedAt === null) return;
		this.elapsedMs = this.#accumulatedMs + (this.#clock() - this.#startedAt);
	}

	/** Mines are only placed on the first action, so that cell and its neighbors stay safe */
	#ensureMines(index: number) {
		if (this.board.minesPlaced) return;
		this.board = placeMines(this.board, index, this.totalMines, this.#random);
		this.phase = 'playing';
		this.#startedAt = this.#clock();
	}

	/** Applies a board change; an ordinary reveal clears the previous event message */
	#apply(change: BoardChange, detail: MinefieldEventDetail | null = null) {
		this.board = change.board;
		if (change.detonated.length > 0) {
			this.tankersLeft = Math.max(0, this.tankersLeft - change.detonated.length);
			detail = { kind: 'explosion', cells: change.detonated };
		}
		if (detail) this.#announce(detail);
		else {
			this.event = null;
			soundManager().play('click');
		}
		if (this.tankersLeft === 0) {
			this.#finish(false);
			return;
		}
		const channel = findChannel(this.board);
		if (channel) {
			this.channel = channel;
			this.#finish(true);
		}
	}

	#announce(detail: MinefieldEventDetail) {
		this.event = { ...detail, id: ++this.#eventId };
		soundManager().play(EVENT_SOUNDS[detail.kind]);
	}

	#finish(won: boolean) {
		this.tick();
		this.#startedAt = null;
		const seconds = Math.max(1, Math.round(this.elapsedMs / 1000));
		const flags = countFlags(this.board);
		const score = scoreGame({
			difficulty: this.difficulty,
			won,
			seconds,
			tankersLeft: this.tankersLeft,
			submarinesLeft: this.submarinesLeft,
			revealedCells: countRevealedSafe(this.board),
			correctFlags: flags.correct,
			wrongFlags: flags.wrong
		});
		const scoreBest = this.#scores.submit(bestParts(this.difficultyId, 'score'), score.total);
		const timeBest = won
			? this.#scores.submit(bestParts(this.difficultyId, 'time'), seconds, 'lower')
			: { isNewBest: false, best: this.bestTime };
		this.bestScore = scoreBest.best;
		this.bestTime = timeBest.best;
		this.phase = won ? 'won' : 'lost';
		this.tool = 'reveal';
		this.result = {
			won,
			seconds,
			score,
			isNewBestScore: scoreBest.isNewBest,
			isNewBestTime: timeBest.isNewBest,
			bestScore: scoreBest.best,
			bestTime: timeBest.best
		};
	}
}
