/*
 * Bureaucracy Maze game state: the size picker, the maze being walked, the player's progress
 * through it and the stored bests. The rules live in $lib/game/maze. There is no timer and there are
 * no lives, so nothing can be lost: the score is the number of steps, fewer is better, and the stars
 * compare them with the shortest way.
 */
import { SIZES, type SizeId } from '#lib/game/maze/difficulty.js';
import { generateMaze } from '#lib/game/maze/generate.js';
import type { Direction, ItemKind, Maze } from '#lib/game/maze/maze.js';
import {
	move,
	seenRooms,
	starsFor,
	startState,
	type MoveOutcome,
	type PlayState
} from '#lib/game/maze/play.js';
import { parSteps } from '#lib/game/maze/solver.js';
import { randomSeed } from '#lib/game/random.js';
import { highscores, type Highscores } from '#lib/services/highscore.js';
import { soundManager } from '#lib/sound/soundManager.svelte.js';

export type MazeScreen = 'select' | 'play';

/** What the last move did, for the status line under the maze */
export type MazeNotice =
	| { kind: 'pickup'; item: ItemKind }
	| { kind: 'locked'; item: ItemKind }
	| { kind: 'closed' }
	| { kind: 'wall' };

/** Fewest steps per size; lower is better */
export function highscoreParts(size: SizeId): string[] {
	return ['maze', size, 'steps'];
}

export interface MazeGameOptions {
	scores?: Highscores;
	/** Where the seed of a new maze comes from (a random one by default) */
	newSeed?: () => number;
}

export class MazeGame {
	screen = $state<MazeScreen>('select');
	size = $state<SizeId>('small');
	maze = $state.raw<Maze>(generateMaze(1, SIZES.small));
	play = $state.raw<PlayState>(startState(this.maze));
	notice = $state.raw<MazeNotice | null>(null);
	/** Counts the moves that produced a notice, so the same notice twice is still announced */
	noticeCount = $state(0);
	par = $state(0);
	stars = $state(0);
	isNewBest = $state(false);
	/** Fewest steps ever needed on the open size */
	best = $state<number | null>(null);

	#scores: Highscores;
	#newSeed: () => number;

	constructor({ scores = highscores(), newSeed = randomSeed }: MazeGameOptions = {}) {
		this.#scores = scores;
		this.#newSeed = newSeed;
	}

	get steps(): number {
		return this.play.steps;
	}

	get won(): boolean {
		return this.play.won;
	}

	get collected(): readonly ItemKind[] {
		return this.play.collected;
	}

	/** Documents the maze hides, in no particular order */
	get needed(): ItemKind[] {
		return this.maze.items.filter((item): item is ItemKind => item !== null);
	}

	get seen(): boolean[] {
		return seenRooms(this.maze, this.play);
	}

	bestFor(size: SizeId): number | null {
		return this.#scores.get(highscoreParts(size));
	}

	/** Opens a fresh maze of a size; every run gets its own doors, offices and documents */
	start(size: SizeId, seed: number = this.#newSeed()) {
		this.size = size;
		this.maze = generateMaze(seed, SIZES[size]);
		this.par = parSteps(this.maze);
		this.restart();
		this.screen = 'play';
	}

	/** Walks the same maze again from the start */
	restart() {
		this.play = startState(this.maze);
		this.notice = null;
		this.noticeCount = 0;
		this.stars = 0;
		this.isNewBest = false;
		this.best = this.bestFor(this.size);
	}

	/** A new maze of the same size */
	again() {
		this.start(this.size);
	}

	backToSelect() {
		// Also takes a finished run off the stage, which closes the win panel
		this.play = startState(this.maze);
		this.notice = null;
		this.screen = 'select';
	}

	/** Tries one step; returns what happened */
	move(direction: Direction): MoveOutcome | null {
		if (this.screen !== 'play' || this.play.won) return null;
		const result = move(this.maze, this.play, direction);
		this.play = result.state;
		const sounds = soundManager();
		switch (result.outcome) {
			case 'wall':
				this.#announce({ kind: 'wall' });
				break;
			case 'locked':
				this.#announce({ kind: 'locked', item: result.missing as ItemKind });
				sounds.play('ui-error');
				break;
			case 'closed':
				this.#announce({ kind: 'closed' });
				sounds.play('thud');
				break;
			case 'moved':
			case 'won':
				if (result.pickup) {
					this.#announce({ kind: 'pickup', item: result.pickup });
					sounds.play('pickup');
				} else {
					this.notice = null;
					sounds.play('click');
				}
				if (result.outcome === 'won') this.#finish();
				break;
		}
		return result.outcome;
	}

	#announce(notice: MazeNotice) {
		this.notice = notice;
		this.noticeCount += 1;
	}

	#finish() {
		this.stars = starsFor(this.play.steps, this.par);
		const result = this.#scores.submit(highscoreParts(this.size), this.play.steps, 'lower');
		this.isNewBest = result.isNewBest;
		this.best = result.best;
		soundManager().play(this.stars === 3 ? 'chime-big' : 'chime');
	}
}
