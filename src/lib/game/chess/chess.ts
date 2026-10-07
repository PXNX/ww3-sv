/*
 * Pure chess rules for 4D Chess: board, legal move generation (castling, en passant, promotion),
 * check, checkmate and the automatic draws. Squares are indexes 0 to 63 with 0 = a8 (top left),
 * so index = row * 8 + column and row 0 is the black back rank. The player is always White.
 */

export type Color = 'w' | 'b';
export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
export type PromotionType = 'q' | 'r' | 'b' | 'n';

export interface Piece {
	type: PieceType;
	color: Color;
}

export type Square = number;
export type Board = (Piece | null)[];

export interface Castling {
	wK: boolean;
	wQ: boolean;
	bK: boolean;
	bQ: boolean;
}

export interface Position {
	board: Board;
	turn: Color;
	castling: Castling;
	/** Square a pawn just skipped over with a double step, where it can be captured en passant */
	enPassant: Square | null;
	/** Half moves since the last capture or pawn move (the fifty-move rule counts to 100) */
	halfmoveClock: number;
	fullmove: number;
}

export type MoveFlag = 'double' | 'en-passant' | 'castle-king' | 'castle-queen';

export interface Move {
	from: Square;
	to: Square;
	piece: PieceType;
	captured?: PieceType;
	promotion?: PromotionType;
	flag?: MoveFlag;
}

export type GameStatus =
	| { kind: 'playing'; check: boolean }
	| { kind: 'checkmate'; winner: Color }
	| { kind: 'draw'; reason: DrawReason };

export type DrawReason = 'stalemate' | 'insufficient-material' | 'fifty-moves' | 'repetition';

export const PIECE_VALUE: Record<PieceType, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

export const opposite = (color: Color): Color => (color === 'w' ? 'b' : 'w');
export const rowOf = (square: Square): number => square >> 3;
export const colOf = (square: Square): number => square & 7;
export const squareAt = (row: number, col: number): Square => row * 8 + col;

/** Algebraic name of a square, for example 'e4' */
export function squareName(square: Square): string {
	return `${'abcdefgh'[colOf(square)]}${8 - rowOf(square)}`;
}

export function parseSquare(name: string): Square | null {
	if (!/^[a-h][1-8]$/.test(name)) return null;
	return squareAt(8 - Number(name[1]), 'abcdefgh'.indexOf(name[0]));
}

const BACK_RANK: PieceType[] = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];

export function initialPosition(): Position {
	const board: Board = Array.from({ length: 64 }, () => null);
	for (let col = 0; col < 8; col++) {
		board[squareAt(0, col)] = { type: BACK_RANK[col], color: 'b' };
		board[squareAt(1, col)] = { type: 'p', color: 'b' };
		board[squareAt(6, col)] = { type: 'p', color: 'w' };
		board[squareAt(7, col)] = { type: BACK_RANK[col], color: 'w' };
	}
	return {
		board,
		turn: 'w',
		castling: { wK: true, wQ: true, bK: true, bQ: true },
		enPassant: null,
		halfmoveClock: 0,
		fullmove: 1
	};
}

/**
 * Builds a position from a board written as 8 strings of 8 characters (top row first). Upper case
 * is White, lower case is Black, '.' is empty. Used by tests and by custom set-ups.
 */
export function positionFromRows(
	rows: readonly string[],
	turn: Color = 'w',
	options: { castling?: Partial<Castling>; enPassant?: Square | null } = {}
): Position {
	const board: Board = Array.from({ length: 64 }, () => null);
	rows.forEach((line, row) => {
		for (let col = 0; col < 8; col++) {
			const letter = line[col];
			if (!letter || letter === '.') continue;
			board[squareAt(row, col)] = {
				type: letter.toLowerCase() as PieceType,
				color: letter === letter.toUpperCase() ? 'w' : 'b'
			};
		}
	});
	return {
		board,
		turn,
		castling: { wK: false, wQ: false, bK: false, bQ: false, ...options.castling },
		enPassant: options.enPassant ?? null,
		halfmoveClock: 0,
		fullmove: 1
	};
}

const KNIGHT_STEPS = [
	[-2, -1],
	[-2, 1],
	[-1, -2],
	[-1, 2],
	[1, -2],
	[1, 2],
	[2, -1],
	[2, 1]
];
const KING_STEPS = [
	[-1, -1],
	[-1, 0],
	[-1, 1],
	[0, -1],
	[0, 1],
	[1, -1],
	[1, 0],
	[1, 1]
];
const DIAGONALS = [
	[-1, -1],
	[-1, 1],
	[1, -1],
	[1, 1]
];
const STRAIGHTS = [
	[-1, 0],
	[1, 0],
	[0, -1],
	[0, 1]
];

const inside = (row: number, col: number) => row >= 0 && row < 8 && col >= 0 && col < 8;

export function findKing(board: Board, color: Color): Square {
	return board.findIndex((piece) => piece?.type === 'k' && piece.color === color);
}

/** Whether any piece of `by` attacks the square (pins are ignored, as for the attack itself) */
export function isAttacked(board: Board, square: Square, by: Color): boolean {
	const row = rowOf(square);
	const col = colOf(square);

	// A pawn of `by` attacks diagonally forward, so it sits one step behind the square
	const pawnRow = row + (by === 'w' ? 1 : -1);
	for (const dc of [-1, 1]) {
		if (inside(pawnRow, col + dc)) {
			const piece = board[squareAt(pawnRow, col + dc)];
			if (piece?.color === by && piece.type === 'p') return true;
		}
	}

	for (const [dr, dc] of KNIGHT_STEPS) {
		if (!inside(row + dr, col + dc)) continue;
		const piece = board[squareAt(row + dr, col + dc)];
		if (piece?.color === by && piece.type === 'n') return true;
	}

	for (const [dr, dc] of KING_STEPS) {
		if (!inside(row + dr, col + dc)) continue;
		const piece = board[squareAt(row + dr, col + dc)];
		if (piece?.color === by && piece.type === 'k') return true;
	}

	const slides: [number[][], PieceType][] = [
		[DIAGONALS, 'b'],
		[STRAIGHTS, 'r']
	];
	for (const [directions, slider] of slides) {
		for (const [dr, dc] of directions) {
			let r = row + dr;
			let c = col + dc;
			while (inside(r, c)) {
				const piece = board[squareAt(r, c)];
				if (piece) {
					if (piece.color === by && (piece.type === slider || piece.type === 'q')) return true;
					break;
				}
				r += dr;
				c += dc;
			}
		}
	}
	return false;
}

export function isInCheck(position: Position, color: Color = position.turn): boolean {
	const king = findKing(position.board, color);
	return king >= 0 && isAttacked(position.board, king, opposite(color));
}

const PROMOTIONS: PromotionType[] = ['q', 'r', 'b', 'n'];

/** Moves that follow the piece's movement rules but may still leave the own king in check */
function pseudoLegalMoves(position: Position, onlyFrom?: Square): Move[] {
	const { board, turn, castling, enPassant } = position;
	const moves: Move[] = [];
	const enemy = opposite(turn);

	const squares = onlyFrom === undefined ? board.keys() : [onlyFrom];
	for (const from of squares) {
		const piece = board[from];
		if (!piece || piece.color !== turn) continue;
		const row = rowOf(from);
		const col = colOf(from);

		const add = (to: Square, extra: Partial<Move> = {}) => {
			const target = board[to];
			moves.push({
				from,
				to,
				piece: piece.type,
				...(target ? { captured: target.type } : {}),
				...extra
			});
		};

		if (piece.type === 'p') {
			const dir = turn === 'w' ? -1 : 1;
			const startRow = turn === 'w' ? 6 : 1;
			const lastRow = turn === 'w' ? 0 : 7;
			const addPawn = (to: Square, extra: Partial<Move> = {}) => {
				if (rowOf(to) === lastRow) {
					for (const promotion of PROMOTIONS) add(to, { ...extra, promotion });
				} else {
					add(to, extra);
				}
			};

			const one = squareAt(row + dir, col);
			if (inside(row + dir, col) && !board[one]) {
				addPawn(one);
				const two = squareAt(row + 2 * dir, col);
				if (row === startRow && !board[two]) add(two, { flag: 'double' });
			}
			for (const dc of [-1, 1]) {
				if (!inside(row + dir, col + dc)) continue;
				const to = squareAt(row + dir, col + dc);
				if (board[to]?.color === enemy) addPawn(to);
				else if (to === enPassant)
					moves.push({ from, to, piece: 'p', captured: 'p', flag: 'en-passant' });
			}
			continue;
		}

		if (piece.type === 'n' || piece.type === 'k') {
			for (const [dr, dc] of piece.type === 'n' ? KNIGHT_STEPS : KING_STEPS) {
				if (!inside(row + dr, col + dc)) continue;
				const to = squareAt(row + dr, col + dc);
				if (board[to]?.color !== turn) add(to);
			}
		} else {
			const directions =
				piece.type === 'b'
					? DIAGONALS
					: piece.type === 'r'
						? STRAIGHTS
						: [...DIAGONALS, ...STRAIGHTS];
			for (const [dr, dc] of directions) {
				let r = row + dr;
				let c = col + dc;
				while (inside(r, c)) {
					const to = squareAt(r, c);
					const target = board[to];
					if (target?.color === turn) break;
					add(to);
					if (target) break;
					r += dr;
					c += dc;
				}
			}
		}

		if (piece.type === 'k') {
			const home = turn === 'w' ? 60 : 4;
			if (from !== home || isAttacked(board, from, enemy)) continue;
			const [kingSide, queenSide] =
				turn === 'w' ? [castling.wK, castling.wQ] : [castling.bK, castling.bQ];
			const rook = (square: Square) => board[square]?.type === 'r' && board[square]?.color === turn;
			if (
				kingSide &&
				rook(home + 3) &&
				!board[home + 1] &&
				!board[home + 2] &&
				!isAttacked(board, home + 1, enemy) &&
				!isAttacked(board, home + 2, enemy)
			) {
				add(home + 2, { flag: 'castle-king' });
			}
			if (
				queenSide &&
				rook(home - 4) &&
				!board[home - 1] &&
				!board[home - 2] &&
				!board[home - 3] &&
				!isAttacked(board, home - 1, enemy) &&
				!isAttacked(board, home - 2, enemy)
			) {
				add(home - 2, { flag: 'castle-queen' });
			}
		}
	}
	return moves;
}

/** Plays a move without checking it; returns a new position and leaves the old one untouched */
export function applyMove(position: Position, move: Move): Position {
	const board = position.board.slice();
	const color = position.turn;
	const moving = board[move.from]!;

	board[move.from] = null;
	if (move.flag === 'en-passant') {
		board[move.to + (color === 'w' ? 8 : -8)] = null;
	} else if (move.flag === 'castle-king') {
		board[move.to - 1] = board[move.to + 1];
		board[move.to + 1] = null;
	} else if (move.flag === 'castle-queen') {
		board[move.to + 1] = board[move.to - 2];
		board[move.to - 2] = null;
	}
	board[move.to] = move.promotion ? { type: move.promotion, color } : moving;

	const castling = { ...position.castling };
	if (move.piece === 'k') {
		if (color === 'w') castling.wK = castling.wQ = false;
		else castling.bK = castling.bQ = false;
	}
	// A rook leaving its corner, or being captured there, ends that side's castling right
	for (const square of [move.from, move.to]) {
		if (square === 63) castling.wK = false;
		if (square === 56) castling.wQ = false;
		if (square === 7) castling.bK = false;
		if (square === 0) castling.bQ = false;
	}

	return {
		board,
		turn: opposite(color),
		castling,
		enPassant: move.flag === 'double' ? (move.from + move.to) / 2 : null,
		halfmoveClock: move.piece === 'p' || move.captured ? 0 : position.halfmoveClock + 1,
		fullmove: position.fullmove + (color === 'b' ? 1 : 0)
	};
}

/** All legal moves for the side to move, or only those of the piece on `from` */
export function legalMoves(position: Position, from?: Square): Move[] {
	return pseudoLegalMoves(position, from).filter(
		(move) => !isInCheck(applyMove(position, move), position.turn)
	);
}

/** Compact text for a move, for example 'e2e4' or 'e7e8q'; used for saving a game */
export function moveToText(move: Move): string {
	return `${squareName(move.from)}${squareName(move.to)}${move.promotion ?? ''}`;
}

/** Finds the legal move written as text, or null when it is not legal in this position */
export function moveFromText(position: Position, text: string): Move | null {
	const match = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/.exec(text);
	if (!match) return null;
	const from = parseSquare(match[1]);
	const to = parseSquare(match[2]);
	if (from === null || to === null) return null;
	return (
		legalMoves(position, from).find(
			(move) => move.to === to && (move.promotion ?? '') === (match[3] ?? '')
		) ?? null
	);
}

/** Identity of a position for repetition: pieces, side to move, castling and en passant */
export function positionKey(position: Position): string {
	const pieces = position.board
		.map((piece) => (piece ? (piece.color === 'w' ? piece.type.toUpperCase() : piece.type) : '.'))
		.join('');
	const { wK, wQ, bK, bQ } = position.castling;
	const rights = `${wK ? 'K' : ''}${wQ ? 'Q' : ''}${bK ? 'k' : ''}${bQ ? 'q' : ''}`;
	return `${pieces} ${position.turn} ${rights || '-'} ${position.enPassant ?? '-'}`;
}

/** Neither side can possibly checkmate: bare kings, or a king and one minor piece against a king */
export function hasInsufficientMaterial(board: Board): boolean {
	const pieces = board.filter((piece): piece is Piece => piece !== null && piece.type !== 'k');
	if (pieces.length === 0) return true;
	return pieces.length === 1 && (pieces[0].type === 'n' || pieces[0].type === 'b');
}

/**
 * State of the game. `history` holds the keys of all earlier positions with the same side to move
 * (including the current one) so a threefold repetition can be detected.
 */
export function gameStatus(position: Position, history: readonly string[] = []): GameStatus {
	const check = isInCheck(position);
	if (legalMoves(position).length === 0) {
		return check
			? { kind: 'checkmate', winner: opposite(position.turn) }
			: { kind: 'draw', reason: 'stalemate' };
	}
	if (hasInsufficientMaterial(position.board))
		return { kind: 'draw', reason: 'insufficient-material' };
	if (position.halfmoveClock >= 100) return { kind: 'draw', reason: 'fifty-moves' };
	const key = positionKey(position);
	if (history.filter((entry) => entry === key).length >= 3) {
		return { kind: 'draw', reason: 'repetition' };
	}
	return { kind: 'playing', check };
}
