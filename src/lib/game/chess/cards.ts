/*
 * Event cards for 4D Chess. Instead of moving a piece, the player may spend one of the three cards
 * dealt at the start of the match. Every card resolves deterministically from the position plus an
 * optional parameter (the chosen team or square), so a saved game can be replayed exactly. A card
 * that would do nothing, or that would leave the player's own king in check, is refused.
 */
import type { Random } from '../random';
import {
	findKing,
	isAttacked,
	opposite,
	parseSquare,
	PIECE_VALUE,
	rowOf,
	squareAt,
	type Board,
	type Color,
	type Piece,
	type PieceType,
	type Position,
	type Square
} from './chess';

export type CardId =
	| 'plague'
	| 'marriage-crisis'
	| 'gotcha-ball'
	| 'great-ball'
	| 'ultra-ball'
	| 'master-ball'
	| 'pawn-net'
	| 'farmer-revolution'
	| 'mercenaries'
	| 'rigged-election'
	| 'bear-hug';

/** A card being played; `param` is the team ('w' or 'b') for plague, or a square for a ball */
export interface CardPlay {
	id: CardId;
	param?: string;
}

export type CardKind = 'chaos' | 'capture' | 'boost' | 'trade-off';

export interface CardDefinition {
	id: CardId;
	kind: CardKind;
	/** Relative chance of being dealt; the powerful cards are rarer */
	weight: number;
	/** 'piece' cards are played by tapping an enemy piece on the board */
	target: 'none' | 'piece';
	/** Highest piece value a ball can catch */
	maxValue?: number;
}

export const HAND_SIZE = 3;

export const CARDS: readonly CardDefinition[] = [
	{ id: 'plague', kind: 'chaos', weight: 3, target: 'none' },
	{ id: 'marriage-crisis', kind: 'chaos', weight: 3, target: 'none' },
	{ id: 'gotcha-ball', kind: 'capture', weight: 4, target: 'piece', maxValue: 1 },
	{ id: 'great-ball', kind: 'capture', weight: 3, target: 'piece', maxValue: 3 },
	{ id: 'ultra-ball', kind: 'capture', weight: 2, target: 'piece', maxValue: 5 },
	{ id: 'master-ball', kind: 'capture', weight: 1, target: 'piece', maxValue: 9 },
	{ id: 'pawn-net', kind: 'capture', weight: 3, target: 'none' },
	{ id: 'farmer-revolution', kind: 'boost', weight: 2, target: 'none' },
	{ id: 'mercenaries', kind: 'trade-off', weight: 3, target: 'none' },
	{ id: 'rigged-election', kind: 'trade-off', weight: 3, target: 'none' },
	{ id: 'bear-hug', kind: 'trade-off', weight: 2, target: 'none' }
];

export function cardDefinition(id: CardId): CardDefinition {
	return CARDS.find((card) => card.id === id)!;
}

export const isCardId = (value: unknown): value is CardId =>
	CARDS.some((card) => card.id === value);

/** Deals `count` different cards, the rarer ones less often */
export function dealHand(random: Random, count = HAND_SIZE): CardId[] {
	const pool = [...CARDS];
	const hand: CardId[] = [];
	while (hand.length < count && pool.length > 0) {
		let roll = random() * pool.reduce((sum, card) => sum + card.weight, 0);
		const index = pool.findIndex((card) => (roll -= card.weight) < 0);
		hand.push(pool.splice(Math.max(index, 0), 1)[0].id);
	}
	return hand;
}

/** The part of a card that is decided by chance when it is played, so it can be saved */
export function rollCardParam(id: CardId, random: Random): string | undefined {
	return id === 'plague' ? (random() < 0.5 ? 'w' : 'b') : undefined;
}

/** Saved form of a played card, for example 'c:plague:b' or 'c:great-ball:e7' */
export function cardPlayToText({ id, param }: CardPlay): string {
	return param ? `c:${id}:${param}` : `c:${id}`;
}

export function cardPlayFromText(text: string): CardPlay | null {
	const [prefix, id, param] = text.split(':');
	if (prefix !== 'c' || !isCardId(id)) return null;
	return param ? { id, param } : { id };
}

const without = (board: Board, remove: (piece: Piece) => boolean): Board =>
	board.map((piece) => (piece && remove(piece) ? null : piece));

/** Free squares in the order the reinforcements march in: the given rows, in the given column order */
function freeSquares(board: Board, rows: readonly number[], columns: readonly number[]): Square[] {
	return rows.flatMap((row) =>
		columns.map((col) => squareAt(row, col)).filter((square) => board[square] === null)
	);
}

const KNIGHT_FIRST = [1, 6, 2, 5, 0, 7, 3, 4];
const IN_ORDER = [0, 1, 2, 3, 4, 5, 6, 7];

/** Rows in front of a team's army, nearest first */
const reinforcementRows = (color: Color, depth: number): number[] =>
	color === 'w' ? [5, 4, 3, 2].slice(0, depth) : [2, 3, 4, 5].slice(0, depth);

function place(board: Board, squares: readonly Square[], count: number, piece: Piece): boolean {
	if (squares.length < count) return false;
	for (const square of squares.slice(0, count)) board[square] = piece;
	return true;
}

/** Enemy pieces a ball of this strength can catch; none of them is ever a king */
export function ballTargets(position: Position, maxValue: number): Square[] {
	const enemy = opposite(position.turn);
	return position.board.flatMap((piece, square) =>
		piece && piece.color === enemy && piece.type !== 'k' && PIECE_VALUE[piece.type] <= maxValue
			? [square]
			: []
	);
}

/** Squares the player can tap to play the card; empty for cards that need no target */
export function cardTargets(position: Position, id: CardId): Square[] {
	const card = cardDefinition(id);
	return card.target === 'piece' ? ballTargets(position, card.maxValue ?? 0) : [];
}

/** The mover's pieces that cost them something to play, such as the queen the mercenaries replace */
const owns = (board: Board, color: Color, type: PieceType) =>
	board.some((piece) => piece?.color === color && piece.type === type);

/** Castling needs the king and rook still on their home squares, which cards can break */
function sanitizedCastling(board: Board, castling: Position['castling']): Position['castling'] {
	const at = (square: Square, type: PieceType, color: Color) =>
		board[square]?.type === type && board[square]?.color === color;
	return {
		wK: castling.wK && at(60, 'k', 'w') && at(63, 'r', 'w'),
		wQ: castling.wQ && at(60, 'k', 'w') && at(56, 'r', 'w'),
		bK: castling.bK && at(4, 'k', 'b') && at(7, 'r', 'b'),
		bQ: castling.bQ && at(4, 'k', 'b') && at(0, 'r', 'b')
	};
}

/** The board a card leads to, or null when the card cannot be played here */
function cardBoard(position: Position, { id, param }: CardPlay): Board | null {
	const me = position.turn;
	const enemy = opposite(me);
	const board = position.board.slice();

	switch (id) {
		case 'plague': {
			if (param !== 'w' && param !== 'b') return null;
			return without(board, (piece) => piece.type === 'p' && piece.color === param);
		}
		case 'marriage-crisis':
			return without(board, (piece) => piece.type === 'q');
		case 'gotcha-ball':
		case 'great-ball':
		case 'ultra-ball':
		case 'master-ball': {
			const square = param ? parseSquare(param) : null;
			if (square === null || !cardTargets(position, id).includes(square)) return null;
			board[square] = { ...board[square]!, color: me };
			return board;
		}
		case 'pawn-net': {
			// The three enemy pawns closest to promoting, the most dangerous ones, defect
			const pawns = board
				.flatMap((piece, square) => (piece?.color === enemy && piece.type === 'p' ? [square] : []))
				.sort((a, b) => (enemy === 'b' ? rowOf(b) - rowOf(a) : rowOf(a) - rowOf(b)) || a - b)
				.slice(0, 3);
			for (const square of pawns) board[square] = { type: 'p', color: me };
			return board;
		}
		case 'farmer-revolution': {
			const squares = freeSquares(board, reinforcementRows(me, 4), IN_ORDER);
			return place(board, squares, 8, { type: 'p', color: me }) ? board : null;
		}
		case 'mercenaries': {
			if (!owns(board, me, 'q')) return null;
			const stripped = without(board, (piece) => piece.color === me && piece.type === 'q');
			const squares = freeSquares(stripped, reinforcementRows(me, 2), KNIGHT_FIRST);
			return place(stripped, squares, 2, { type: 'n', color: me }) ? stripped : null;
		}
		case 'rigged-election': {
			const pawns = board
				.flatMap((piece, square) => (piece?.color === me && piece.type === 'p' ? [square] : []))
				.sort((a, b) => (me === 'w' ? rowOf(a) - rowOf(b) : rowOf(b) - rowOf(a)) || a - b);
			if (pawns.length === 0) return null;
			board[pawns[0]] = { type: 'q', color: me };
			// The price: the other side gets a free knight
			const squares = freeSquares(board, reinforcementRows(enemy, 2), KNIGHT_FIRST);
			return place(board, squares, 1, { type: 'n', color: enemy }) ? board : null;
		}
		case 'bear-hug': {
			if (!owns(board, enemy, 'q')) return null;
			return without(
				board,
				(piece) =>
					(piece.color === enemy && piece.type === 'q') ||
					(piece.color === me && piece.type === 'r')
			);
		}
	}
}

/**
 * Plays a card for the side to move and hands the turn over, or returns null when the card is
 * refused: it would change nothing, is missing its target, or would leave the mover in check.
 */
export function applyCard(position: Position, play: CardPlay): Position | null {
	const board = cardBoard(position, play);
	if (!board || board.every((piece, square) => piece === position.board[square])) return null;

	const king = findKing(board, position.turn);
	if (king < 0 || isAttacked(board, king, opposite(position.turn))) return null;

	return {
		board,
		turn: opposite(position.turn),
		castling: sanitizedCastling(board, position.castling),
		enPassant: null,
		halfmoveClock: 0,
		fullmove: position.fullmove + (position.turn === 'b' ? 1 : 0)
	};
}
