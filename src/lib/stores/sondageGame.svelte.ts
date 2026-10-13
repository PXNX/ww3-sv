/*
 * Sondage Surge game store: wraps the pure board, the greedy rival, the random events and the
 * win/lose rules with the turn flow, the sounds and the personal best. There are no lives: the
 * poll decides. The board is a plain mutable object; only what the page shows is reactive and is
 * synced after every change.
 */
import { createRandom, randomSeed, type Random } from '#lib/game/random.js';
import { chooseMove, GAFFE_CHANCE } from '#lib/game/sondage/ai.js';
import {
	createBoard,
	flipsFor,
	holdRally,
	rallyTiles,
	SIDE_COLOR,
	tally,
	type Board,
	type Side,
	type Tally
} from '#lib/game/sondage/board.js';
import {
	candidatePose,
	pollMood,
	resultPose,
	type CandidateMood
} from '#lib/game/sondage/candidate.js';
import { applyEvent, rollEvent, tickEvents, type EventKind } from '#lib/game/sondage/events.js';
import { decide, finalScore, TOTAL_ROUNDS, type Outcome } from '#lib/game/sondage/rules.js';
import { highscores, type Highscores } from '#lib/services/highscore.js';
import { soundManager } from '#lib/sound/soundManager.svelte.js';
import type { SoundId } from '#lib/sound/sounds.js';

export type SondageStatus = 'ready' | 'playing' | 'paused' | 'over';
/** Whose move it is inside a round: you first, then La Candidate */
export type Phase = 'you' | 'rival';

export const SCORE_KEY = ['sondage', 'score'] as const;

/** Real milliseconds La Candidate "counts votes" before her rally lands */
export const RIVAL_DELAY_MS = 900;
export const RIVAL_DELAY_REDUCED_MS = 350;

export interface CellView {
	name: string | null;
	owner: Side | null;
	frozen: boolean;
	blocked: boolean;
}

export interface EventView {
	kind: EventKind;
	/** Département the event hits */
	name: string;
	/** Whose rally a scandal froze */
	side?: Side;
}

/** The last rally of either side, for the status line */
export interface ActionView {
	side: Side;
	name: string;
	flips: number;
	gaffe: boolean;
}

export interface SondageOptions {
	reducedMotion?: boolean;
	/** Injected for tests; defaults to the browser's local high scores */
	scores?: () => Highscores;
	/** Fixed seed for tests; a fresh random seed per run otherwise */
	seed?: () => number;
	/** La Candidate's gaffe chance; tests set 0 for a fully greedy rival */
	gaffeChance?: number;
}

export class SondageGame {
	status = $state<SondageStatus>('ready');
	phase = $state<Phase>('you');
	round = $state(1);
	score = $state(0);
	cells = $state.raw<CellView[]>([]);
	counts = $state.raw<Tally>({ you: 0, rival: 0, free: 0, total: 0 });
	/** Flips each free tile would give you right now (0 when it flips nothing or is not free) */
	hints = $state.raw<number[]>([]);
	/** Per tile: the move number that last changed it, for the flip burst animation */
	stamps = $state.raw<number[]>([]);
	moves = $state(0);
	/** Your flips over the whole run */
	flips = $state(0);
	event = $state.raw<EventView | null>(null);
	last = $state.raw<ActionView | null>(null);
	outcome = $state.raw<Outcome | null>(null);
	/** The board as it stood when the election was called, for the swinging result map */
	finalCells = $state.raw<CellView[]>([]);
	mood = $state<CandidateMood | 'worried'>('neutral');
	best = $state<number | null>(null);
	isNewBest = $state(false);

	/** Simulation state, deliberately not reactive */
	board: Board = createBoard();

	readonly reducedMotion: boolean;
	#random: Random = createRandom(1);
	#scores: () => Highscores;
	#seed: () => number;
	#gaffeChance: number;
	#waitMs = 0;

	constructor({
		reducedMotion = false,
		scores = highscores,
		seed = randomSeed,
		gaffeChance = GAFFE_CHANCE
	}: SondageOptions = {}) {
		this.reducedMotion = reducedMotion;
		this.#scores = scores;
		this.#seed = seed;
		this.#gaffeChance = gaffeChance;
		this.#sync();
	}

	get totalRounds() {
		return TOTAL_ROUNDS;
	}

	/** Reads the stored best; call in the browser only */
	loadBest() {
		this.best = this.#scores().get(SCORE_KEY);
	}

	start() {
		this.#random = createRandom(this.#seed());
		this.board = createBoard();
		this.round = 1;
		this.phase = 'you';
		this.moves = 0;
		this.flips = 0;
		this.event = null;
		this.last = null;
		this.outcome = null;
		this.isNewBest = false;
		this.stamps = this.board.cells.map(() => 0);
		this.#waitMs = 0;
		this.#sync();
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

	/** The tiles that would flip if you rallied at `index`, for the hover preview */
	preview(index: number): number[] {
		if (this.status !== 'playing' || this.phase !== 'you') return [];
		return flipsFor(this.board, index, 'you');
	}

	/** The player holds a rally; returns false when the tap does nothing */
	rally(index: number): boolean {
		if (this.status !== 'playing' || this.phase !== 'you') return false;
		const flipped = holdRally(this.board, index, 'you');
		if (flipped === null) {
			this.#play('ui-error');
			return false;
		}
		this.flips += flipped.length;
		this.#record('you', index, flipped, false);
		this.#play(flipped.length > 0 ? 'chime' : 'pop');
		const outcome = decide(this.board, this.round, false);
		if (outcome) {
			this.#finish(outcome);
			return true;
		}
		this.phase = 'rival';
		this.#waitMs = 0;
		this.#sync();
		return true;
	}

	/** One fixed step of real time: called by the page's game loop; La Candidate answers after a beat */
	update(dtMs: number) {
		if (this.status !== 'playing' || this.phase !== 'rival') return;
		this.#waitMs += dtMs;
		const delay = this.reducedMotion ? RIVAL_DELAY_REDUCED_MS : RIVAL_DELAY_MS;
		if (this.#waitMs >= delay) this.#rivalTurn();
	}

	#rivalTurn() {
		const move = chooseMove(this.board, 'rival', this.#random, this.#gaffeChance);
		if (move) {
			const flipped = holdRally(this.board, move.index, 'rival') ?? [];
			this.#record('rival', move.index, flipped, move.gaffe);
			this.#play(move.gaffe ? 'ui-error' : flipped.length > 0 ? 'thud' : 'click');
			const outcome = decide(this.board, this.round, false);
			if (outcome) {
				this.#finish(outcome);
				return;
			}
		}
		this.#endRound();
	}

	#endRound() {
		tickEvents(this.board);
		const outcome = decide(this.board, this.round, true);
		if (outcome) {
			this.#finish(outcome);
			return;
		}
		this.round += 1;
		this.phase = 'you';
		this.#waitMs = 0;
		this.#openRound();
		// No tile left to rally on for either side: the vote is in
		if (rallyTiles(this.board).length === 0) {
			const counts = tally(this.board);
			this.#finish({
				winner: counts.you > counts.rival ? 'you' : 'rival',
				reason: 'final',
				early: this.round < TOTAL_ROUNDS
			});
			return;
		}
		this.#sync();
	}

	/** A round may open with a scandal or a strike; the banner stays until the next round opens */
	#openRound() {
		const event = rollEvent(this.board, this.round, this.#random);
		if (!event) {
			this.event = null;
			return;
		}
		applyEvent(this.board, event);
		this.event = {
			kind: event.kind,
			name: this.board.cells[event.tile].name ?? '',
			side: event.side
		};
		this.#play(event.kind === 'scandal' ? 'alarm' : 'ding');
	}

	#record(side: Side, index: number, flipped: number[], gaffe: boolean) {
		this.moves += 1;
		const stamps = [...this.stamps];
		for (const tile of [index, ...flipped]) stamps[tile] = this.moves;
		this.stamps = stamps;
		this.last = { side, name: this.board.cells[index].name ?? '', flips: flipped.length, gaffe };
		this.#sync();
	}

	#finish(outcome: Outcome) {
		const counts = tally(this.board);
		this.outcome = outcome;
		this.finalCells = this.#views();
		this.phase = 'you';
		this.#sync();
		const roundsLeft = TOTAL_ROUNDS - this.round;
		this.score = finalScore(outcome, counts.you, this.flips, roundsLeft);
		this.mood = candidatePose(resultPose(outcome));
		const result = this.#scores().submit(SCORE_KEY, this.score);
		this.isNewBest = result.isNewBest;
		this.best = result.best;
		this.status = 'over';
	}

	/** Draws the final map onto the shared score card */
	drawBoard = (context: CanvasRenderingContext2D, x: number, y: number, size: number) => {
		const { cols, rows } = this.board;
		const step = size / Math.max(cols, rows);
		const left = x + (size - step * cols) / 2;
		const top = y + (size - step * rows) / 2;
		context.fillStyle = '#ffffff';
		context.fillRect(x, y, size, size);
		const cells = this.finalCells.length > 0 ? this.finalCells : this.cells;
		cells.forEach((cell, index) => {
			if (cell.name === null) return;
			const cx = left + (index % cols) * step;
			const cy = top + Math.floor(index / cols) * step;
			context.fillStyle = SIDE_COLOR[cell.owner ?? 'free'];
			context.fillRect(cx + step * 0.06, cy + step * 0.06, step * 0.88, step * 0.88);
			context.strokeStyle = '#111111';
			context.lineWidth = Math.max(1, step * 0.06);
			context.strokeRect(cx + step * 0.06, cy + step * 0.06, step * 0.88, step * 0.88);
		});
	};

	#views(): CellView[] {
		return this.board.cells.map((cell) => ({
			name: cell.name,
			owner: cell.owner,
			frozen: cell.frozen > 0,
			blocked: cell.blocked > 0
		}));
	}

	#sync() {
		this.cells = this.#views();
		this.counts = tally(this.board);
		this.score = this.counts.you * 10 + this.flips * 3;
		this.mood = pollMood(this.counts);
		this.hints = this.board.cells.map((_, index) => flipsFor(this.board, index, 'you').length);
	}

	#play(id: SoundId) {
		soundManager().play(id);
	}
}
