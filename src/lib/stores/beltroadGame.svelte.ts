/*
 * Belt & Road game state: the level select, the running level, the routes drawn so far, the move
 * history (which is also the move counter) and the locally stored progress. The rules live in
 * $lib/game/beltroad. There are no lives: a level is won by filling the grid, the debt meter rises
 * with every move, and the number of moves decides the stars.
 *
 * One move is one stroke: press on a port (or on a route), drag, release. A stroke that changes
 * nothing is not a move.
 */
import {
	cellCount,
	coveredCount,
	debtFor,
	dragStroke,
	emptyPaths,
	isConnected,
	isSolved,
	parFor,
	samePaths,
	startStroke,
	starsFor,
	type Cell,
	type Level,
	type Paths
} from '#lib/game/beltroad/board.js';
import { LEVELS, levelAt } from '#lib/game/beltroad/levels.js';
import {
	EMPTY_PROGRESS,
	PROGRESS_KEY,
	isBeltRoadProgress,
	isUnlocked,
	recordFinish,
	totalStars,
	type BeltRoadProgress
} from '#lib/game/beltroad/progress.js';
import { highscores, type Highscores } from '#lib/services/highscore.js';
import { localStore, type Store } from '#lib/services/storage.js';
import { soundManager } from '#lib/sound/soundManager.svelte.js';

export type BeltRoadScreen = 'select' | 'play';

export const LEVEL_IDS: readonly string[] = LEVELS.map((level) => level.id);

/** Fewest moves per level; lower is better */
export function highscoreParts(levelId: string): string[] {
	return ['beltroad', levelId, 'moves'];
}

export interface BeltRoadGameOptions {
	scores?: Highscores;
	storage?: Store;
}

export class BeltRoadGame {
	screen = $state<BeltRoadScreen>('select');
	levelIndex = $state(0);
	paths = $state.raw<Paths>(emptyPaths(levelAt(0)));
	/** The routes before each move, newest last; its length is the move counter */
	history = $state.raw<Paths[]>([]);
	/** The pair being drawn right now, while a stroke is in progress */
	activePair = $state<number | null>(null);
	won = $state(false);
	stars = $state(0);
	isNewBest = $state(false);
	/** Fewest moves ever needed on the open level */
	best = $state<number | null>(null);
	progress = $state<BeltRoadProgress>(EMPTY_PROGRESS);

	#scores: Highscores;
	#storage: Store;
	/** The routes at the start of the running stroke, restored when it is cancelled */
	#strokeStart: Paths | null = null;

	constructor({ scores = highscores(), storage = localStore() }: BeltRoadGameOptions = {}) {
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
		return parFor(this.level);
	}

	/** The debt in billions: it rises with every move */
	get debt(): number {
		return debtFor(this.moves);
	}

	/** The stars the player would earn if the level ended with the moves so far */
	get currentStars(): number {
		return starsFor(Math.max(this.moves, 1), this.par);
	}

	get covered(): number {
		return coveredCount(this.level, this.paths);
	}

	get cells(): number {
		return cellCount(this.level);
	}

	/** Whether the pair at an index is joined end to end right now */
	connected(pair: number): boolean {
		return isConnected(this.level, this.paths, pair);
	}

	get connectedCount(): number {
		return this.level.pairs.filter((_, pair) => this.connected(pair)).length;
	}

	get isBlank(): boolean {
		return this.paths.every((path) => path.length === 0);
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
		this.progress = this.#storage.read(PROGRESS_KEY, EMPTY_PROGRESS, isBeltRoadProgress);
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
		this.paths = emptyPaths(LEVELS[index]);
		this.history = [];
		this.activePair = null;
		this.#strokeStart = null;
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
		this.activePair = null;
		this.#strokeStart = null;
		this.screen = 'select';
	}

	/**
	 * Presses on a cell. On a port the route of that pair starts over from it; on a cell of a route
	 * the route is cut back to the cell and carries on from there. Returns whether a stroke began.
	 */
	beginStroke(cell: Cell): boolean {
		if (this.screen !== 'play' || this.won || this.activePair !== null) return false;
		const started = startStroke(this.level, this.paths, cell);
		if (!started) return false;
		this.#strokeStart = this.paths;
		this.paths = started.paths;
		this.activePair = started.pair;
		return true;
	}

	/** Moves the pointer to a cell while a stroke is running: the route grows, retracts or cuts */
	dragTo(cell: Cell) {
		if (this.activePair === null) return;
		const { paths, results } = dragStroke(this.level, this.paths, this.activePair, cell);
		if (results.length === 0) return;
		this.paths = paths;
		const sounds = soundManager();
		if (results.includes('cut')) sounds.play('thud');
		else if (results.includes('completed')) sounds.play('pickup');
	}

	/** Lets go: a stroke that changed the board is one move, and the level may be won */
	endStroke() {
		const before = this.#strokeStart;
		if (this.activePair === null || !before) return;
		this.activePair = null;
		this.#strokeStart = null;
		// A route that is only its port (a bare tap, or a route cut back to its port) is no route
		this.paths = this.paths.map((path) => (path.length === 1 ? [] : path));
		if (samePaths(before, this.paths)) return;
		this.history = [...this.history, before];
		if (isSolved(this.level, this.paths)) this.#finish();
	}

	/** The pointer was taken away mid-stroke: the board goes back to how it was */
	cancelStroke() {
		if (this.activePair === null) return;
		if (this.#strokeStart) this.paths = this.#strokeStart;
		this.activePair = null;
		this.#strokeStart = null;
	}

	/** Takes back the last move, which also takes it off the move counter and the debt */
	undo(): boolean {
		if (this.won || this.activePair !== null || this.history.length === 0) return false;
		this.paths = this.history[this.history.length - 1];
		this.history = this.history.slice(0, -1);
		soundManager().play('click');
		return true;
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
