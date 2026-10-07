/*
 * Putin's chess brain: a shallow search that plays sensibly, plus the occasional rookie mistake.
 * A mistake is a legal move that costs him a pawn up to a minor piece, such as leaving a piece
 * hanging. He never misses a checkmate in one, and never throws away his queen, so a game stays
 * winnable but not a walk in the park. Random numbers are injected so tests can be exact.
 */
import {
	applyMove,
	isInCheck,
	legalMoves,
	rowOf,
	colOf,
	type Board,
	type Color,
	type Move,
	type PieceType,
	type Position
} from './chess';
import type { Random } from '../random';

/** Centipawn values, so small positional bonuses can sit between whole pawns */
const VALUE: Record<PieceType, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
const MATE = 100_000;

export const DEFAULT_BLUNDER_CHANCE = 0.2;
/** A mistake must lose at least a pawn, but never more than a bishop and a pawn */
const MISTAKE_MIN_LOSS = 100;
const MISTAKE_MAX_LOSS = 430;
const SEARCH_DEPTH = 2;

/** Bonus for standing near the middle of the board, a cheap stand-in for good piece placement */
function centerBonus(row: number, col: number): number {
	const distance = Math.max(Math.abs(row - 3.5), Math.abs(col - 3.5));
	return Math.round((3.5 - distance) * 6);
}

/** Static score from the point of view of `color`: material, development and pawn advancement */
export function evaluate(board: Board, color: Color): number {
	let score = 0;
	board.forEach((piece, square) => {
		if (!piece) return;
		const row = rowOf(square);
		let value = VALUE[piece.type];
		if (piece.type === 'n' || piece.type === 'b') value += centerBonus(row, colOf(square));
		if (piece.type === 'p') value += (piece.color === 'w' ? 6 - row : row - 1) * 4;
		score += piece.color === color ? value : -value;
	});
	return score;
}

function orderMoves(moves: Move[]): Move[] {
	const gain = (move: Move) =>
		(move.captured ? VALUE[move.captured] * 10 - VALUE[move.piece] : 0) +
		(move.promotion ? VALUE[move.promotion] : 0);
	return moves.sort((a, b) => gain(b) - gain(a));
}

/** Negamax with alpha-beta pruning; the score is for the side to move in `position` */
function search(position: Position, depth: number, alpha: number, beta: number): number {
	const moves = legalMoves(position);
	if (moves.length === 0) {
		// A nearer mate scores higher, so the search prefers the fastest one
		return isInCheck(position) ? -MATE - depth : 0;
	}
	if (depth === 0) return evaluate(position.board, position.turn);

	let best = -Infinity;
	for (const move of orderMoves(moves)) {
		const score = -search(applyMove(position, move), depth - 1, -beta, -alpha);
		if (score > best) best = score;
		if (best > alpha) alpha = best;
		if (alpha >= beta) break;
	}
	return best;
}

export interface PutinOptions {
	/** Chance per move that he plays a rookie mistake instead of his best move */
	blunderChance?: number;
	depth?: number;
}

export interface PutinChoice {
	move: Move;
	/** True when he deliberately played a mistake instead of his best move */
	blunder: boolean;
}

interface Scored {
	move: Move;
	score: number;
}

/** Picks Putin's move for the side to move, or null when there is no legal move */
export function choosePutinMove(
	position: Position,
	random: Random,
	{ blunderChance = DEFAULT_BLUNDER_CHANCE, depth = SEARCH_DEPTH }: PutinOptions = {}
): PutinChoice | null {
	const moves = legalMoves(position);
	if (moves.length === 0) return null;

	const scored: Scored[] = moves.map((move) => ({
		move,
		// A little noise breaks ties, so games do not repeat move for move
		score: -search(applyMove(position, move), depth - 1, -Infinity, Infinity) + random() * 6
	}));
	scored.sort((a, b) => b.score - a.score);
	const best = scored[0];

	const mate = scored.find((entry) => entry.score > MATE / 2);
	if (mate) return { move: mate.move, blunder: false };

	if (random() < blunderChance) {
		const mistakes = scored.filter((entry) => {
			const loss = best.score - entry.score;
			return loss >= MISTAKE_MIN_LOSS && loss <= MISTAKE_MAX_LOSS;
		});
		if (mistakes.length > 0) {
			return { move: mistakes[Math.floor(random() * mistakes.length)].move, blunder: true };
		}
	}
	return { move: best.move, blunder: false };
}
