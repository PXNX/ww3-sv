/*
 * Tanker Parking game state: the level select, the running level, the move history (which is also
 * the move counter) and the locally stored progress. The rules live in $lib/game/parking. There are
 * no lives: a level is won by freeing the tanker, and the number of moves decides the stars.
 */
import {
	TANKER_INDEX,
	createPuzzle,
	isSolved,
	samePositions,
	slideRange,
	starsFor,
	withMove,
	type Level,
	type Positions,
	type Puzzle,
	type Range
} from '#lib/game/parking/board.js';
import { LEVELS, levelAt } from '#lib/game/parking/levels.js';
import {
	EMPTY_PROGRESS,
	PROGRESS_KEY,
	isParkingProgress,
	isUnlocked,
	recordFinish,
	totalStars,
	type ParkingProgress
} from '#lib/game/parking/progress.js';
import { highscores, type Highscores } from '#lib/services/highscore.js';
import { localStore, type Store } from '#lib/services/storage.js';
import { soundManager } from '#lib/sound/soundManager.svelte.js';

export type ParkingScreen = 'select' | 'play';

export const LEVEL_IDS: readonly string[] = LEVELS.map((level) => level.id);

/** Fewest moves per level; lower is better */
export function highscoreParts(levelId: string): string[] {
	return ['parking', levelId, 'moves'];
}

export interface ParkingGameOptions {
	scores?: Highscores;
	storage?: Store;
}

export class ParkingGame {
	screen = $state<ParkingScreen>('select');
	levelIndex = $state(0);
	puzzle = $state.raw<Puzzle>(createPuzzle(levelAt(0)));
	positions = $state.raw<Positions>(this.puzzle.start);
	/** The positions before each move, newest last; its length is the move counter */
	history = $state.raw<Positions[]>([]);
	won = $state(false);
	stars = $state(0);
	isNewBest = $state(false);
	/** Fewest moves ever needed on the open level */
	best = $state<number | null>(null);
	progress = $state<ParkingProgress>(EMPTY_PROGRESS);

	#scores: Highscores;
	#storage: Store;

	constructor({ scores = highscores(), storage = localStore() }: ParkingGameOptions = {}) {
		this.#scores = scores;
		this.#storage = storage;
	}

	get level(): Level {
		return levelAt(this.levelIndex);
	}

	get moves(): number {
		return this.history.length;
	}

	get par(): number {
		return this.level.par;
	}

	/** The stars the player would earn if the level ended now */
	get currentStars(): number {
		return starsFor(Math.max(this.moves, 1), this.par);
	}

	get hasNext(): boolean {
		return this.levelIndex < LEVELS.length - 1;
	}

	get totalStars(): number {
		return totalStars(this.progress, LEVEL_IDS);
	}

	get maxStars(): number {
		return LEVELS.length * 3;
	}

	/** Reads the saved progress (call in the browser) */
	load() {
		this.progress = this.#storage.read(PROGRESS_KEY, EMPTY_PROGRESS, isParkingProgress);
	}

	isUnlocked(index: number): boolean {
		return isUnlocked(this.progress, LEVEL_IDS, index);
	}

	starsFor(levelId: string): number {
		return this.progress.stars[levelId] ?? 0;
	}

	bestFor(levelId: string): number | null {
		return this.#scores.get(highscoreParts(levelId));
	}

	openLevel(index: number) {
		if (!this.isUnlocked(index) || index >= LEVELS.length) return;
		this.levelIndex = index;
		this.puzzle = createPuzzle(LEVELS[index]);
		this.positions = this.puzzle.start;
		this.history = [];
		this.won = false;
		this.stars = 0;
		this.isNewBest = false;
		this.best = this.bestFor(LEVELS[index].id);
		this.screen = 'play';
	}

	retry() {
		this.openLevel(this.levelIndex);
	}

	nextLevel() {
		if (this.hasNext) this.openLevel(this.levelIndex + 1);
	}

	backToSelect() {
		// Leaving a won level also closes its win panel, which is open while `won` is set
		this.won = false;
		this.screen = 'select';
	}

	/** How far a ship can slide from where it is (the free span along its axis) */
	rangeOf(index: number): Range {
		return slideRange(this.puzzle, this.positions, index);
	}

	/**
	 * Slides a ship to a position along its axis. Counts as one move. Returns false (and changes
	 * nothing) when the ship would not move, the target is out of its reach, or the level is won.
	 */
	move(index: number, to: number): boolean {
		if (this.screen !== 'play' || this.won || !this.puzzle.pieces[index]) return false;
		if (!Number.isInteger(to) || to === this.positions[index]) return false;
		const { min, max } = this.rangeOf(index);
		if (to < min || to > max) {
			soundManager().play('ui-error');
			return false;
		}
		this.history = [...this.history, this.positions];
		this.positions = withMove(this.positions, index, to);
		if (isSolved(this.puzzle, this.positions)) this.#finish();
		else soundManager().play(index === TANKER_INDEX ? 'whoosh' : 'thud');
		return true;
	}

	/** Takes back the last move, which also takes it off the move counter */
	undo(): boolean {
		if (this.won || this.history.length === 0) return false;
		this.positions = this.history[this.history.length - 1];
		this.history = this.history.slice(0, -1);
		soundManager().play('click');
		return true;
	}

	/** Whether no ship has been moved yet */
	get isAtStart(): boolean {
		return samePositions(this.positions, this.puzzle.start);
	}

	#finish() {
		this.won = true;
		this.stars = starsFor(this.moves, this.par);
		const result = this.#scores.submit(highscoreParts(this.level.id), this.moves, 'lower');
		this.isNewBest = result.isNewBest;
		this.best = result.best;
		this.progress = recordFinish(this.progress, this.level.id, this.stars);
		this.#storage.write(PROGRESS_KEY, this.progress);
		soundManager().play(this.stars === 3 ? 'chime-big' : 'chime');
	}
}
