/*
 * Block Puzzle game state (requirements Section 2). The rules live in $lib/game/blocks; this class
 * wires them to reactive state, the seeded random source, and the personal best.
 */
import {
	cellsAt,
	clampAnchor,
	createBoard,
	fillRatio,
	fitsAnywhere,
	isGameOver,
	lineCount,
	placePiece,
	type Board
} from '#lib/game/blocks/board.js';
import { generateTray } from '#lib/game/blocks/pieceGenerator.js';
import type { Cell, Piece, PieceKind } from '#lib/game/blocks/pieces.js';
import { NO_COMBO, performanceMood, scoreMove } from '#lib/game/blocks/scoring.js';
import { createRandom, randomSeed, type Random } from '#lib/game/random.js';
import { highscores, type Highscores } from '#lib/services/highscore.js';
import { soundManager } from '#lib/sound/soundManager.svelte.js';

export const BLOCKS_BEST_KEY = ['blocks', 'score'] as const;

export interface Preview {
	anchor: Cell;
	cells: Cell[];
	legal: boolean;
	kind: PieceKind;
	/** Board indices that would be cleared by placing here */
	clears: number[];
}

export interface ClearFeedback {
	/** Increases with every clear, so the view can replay its animation */
	id: number;
	lines: number;
	points: number;
	streak: number;
	/** Board indices that were cleared */
	cells: number[];
	/** The kind each cleared cell held, in the same order as cells */
	kinds: PieceKind[];
	/** Center of the piece that caused the clear, so the animation can ripple outwards from it */
	origin: Cell;
}

export type PlaceOutcome = 'placed' | 'no-selection' | 'blocked';

export interface BlocksGameOptions {
	scores?: Highscores;
	seed?: number;
	/** Starting board (defaults to an empty one); used by tests */
	board?: Board;
}

export class BlocksGame {
	board = $state.raw<Board>(createBoard());
	tray = $state.raw<(Piece | null)[]>([]);
	selected = $state<number | null>(null);
	score = $state(0);
	best = $state<number | null>(null);
	combo = $state.raw(NO_COMBO);
	lastLines = $state(0);
	feedback = $state.raw<ClearFeedback | null>(null);
	over = $state(false);
	isNewBest = $state(false);
	linesCleared = $state(0);
	piecesPlaced = $state(0);
	longestStreak = $state(0);

	// Plain getters rather than $derived: they are cheap, stay reactive in templates, and behave
	// the same in unit tests, where the store is compiled for the server

	get selectedPiece(): Piece | null {
		return this.selected === null ? null : (this.tray[this.selected] ?? null);
	}

	get fill(): number {
		return fillRatio(this.board);
	}

	/** Whether each tray piece fits somewhere on the board */
	get fits(): boolean[] {
		return this.tray.map((piece) => piece !== null && fitsAnywhere(this.board, piece));
	}

	get mood() {
		return performanceMood({
			fillRatio: this.fill,
			streak: this.combo.streak,
			lastLines: this.lastLines
		});
	}

	#scores: Highscores;
	#random: Random = Math.random;
	#feedbackId = 0;

	constructor({ scores = highscores(), seed, board }: BlocksGameOptions = {}) {
		this.#scores = scores;
		this.newGame(seed, board);
	}

	newGame(seed = randomSeed(), board = createBoard()) {
		this.#random = createRandom(seed);
		this.board = board;
		this.tray = generateTray(board, this.#random);
		this.selected = null;
		this.score = 0;
		this.best = this.#scores.get(BLOCKS_BEST_KEY);
		this.combo = NO_COMBO;
		this.lastLines = 0;
		this.feedback = null;
		this.over = false;
		this.isNewBest = false;
		this.linesCleared = 0;
		this.piecesPlaced = 0;
		this.longestStreak = 0;
		if (isGameOver(this.board, this.tray)) this.#end();
	}

	/** Selects a tray piece, or deselects it when it is already selected */
	select(index: number | null) {
		if (this.over) return;
		this.selected = index === null || this.selected === index || !this.tray[index] ? null : index;
		if (this.selected !== null) soundManager().play('click');
	}

	/** Where the selected piece would land for a tap on the given cell, and whether that is legal */
	preview(row: number, col: number): Preview | null {
		const piece = this.selectedPiece;
		if (!piece || this.over) return null;
		const anchor = clampAnchor(this.board, piece, row, col);
		const result = placePiece(this.board, piece, anchor[0], anchor[1]);
		return {
			anchor,
			cells: cellsAt(piece, anchor[0], anchor[1]),
			legal: result !== null,
			kind: piece.kind,
			clears: result?.clearedCells ?? []
		};
	}

	/** Places the selected piece for a tap on the given cell (clamped so it stays on the board) */
	place(row: number, col: number): PlaceOutcome {
		const piece = this.selectedPiece;
		if (!piece || this.selected === null || this.over) return 'no-selection';
		const [anchorRow, anchorCol] = clampAnchor(this.board, piece, row, col);
		const result = placePiece(this.board, piece, anchorRow, anchorCol);
		if (!result) {
			soundManager().play('ui-error');
			return 'blocked';
		}

		const lines = lineCount(result.cleared);
		const move = scoreMove(piece.cells.length, lines, this.combo);
		const slot = this.selected;
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- local lookup, never reactive state
		const placedNow = new Set(result.placed);
		const kinds = result.clearedCells.map(
			(index) => (placedNow.has(index) ? piece.kind : this.board.cells[index]) ?? piece.kind
		);

		this.board = result.board;
		this.score += move.points;
		this.combo = move.combo;
		this.lastLines = lines;
		this.piecesPlaced += 1;
		this.linesCleared += lines;
		this.longestStreak = Math.max(this.longestStreak, move.combo.streak);
		this.feedback =
			lines > 0
				? {
						id: ++this.#feedbackId,
						lines,
						points: move.linePoints,
						streak: move.combo.streak,
						cells: result.clearedCells,
						kinds,
						origin: [anchorRow + (piece.height - 1) / 2, anchorCol + (piece.width - 1) / 2]
					}
				: null;
		soundManager().play(lines >= 2 ? 'chime' : lines === 1 ? 'pop' : 'thud');

		const tray = this.tray.map((entry, index) => (index === slot ? null : entry));
		this.tray = tray.every((entry) => entry === null)
			? generateTray(this.board, this.#random)
			: tray;
		this.selected = null;

		if (isGameOver(this.board, this.tray)) this.#end();
		return 'placed';
	}

	#end() {
		this.over = true;
		this.selected = null;
		soundManager().play('fake-news');
		const result = this.#scores.submit(BLOCKS_BEST_KEY, this.score);
		this.isNewBest = result.isNewBest;
		this.best = result.best;
	}
}
