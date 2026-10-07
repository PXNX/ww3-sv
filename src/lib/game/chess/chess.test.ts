import { describe, expect, it } from 'vitest';
import {
	applyMove,
	gameStatus,
	initialPosition,
	isInCheck,
	legalMoves,
	moveFromText,
	moveToText,
	parseSquare,
	positionFromRows,
	positionKey,
	squareName,
	type Position
} from './chess';

/** Counts the move sequences of the given length, the standard way to verify move generation */
function perft(position: Position, depth: number): number {
	if (depth === 0) return 1;
	return legalMoves(position).reduce(
		(sum, move) => sum + perft(applyMove(position, move), depth - 1),
		0
	);
}

const play = (position: Position, ...texts: string[]) =>
	texts.reduce((current, text) => {
		const move = moveFromText(current, text);
		if (!move) throw new Error(`illegal move ${text}`);
		return applyMove(current, move);
	}, position);

describe('squares', () => {
	it('names squares from a8 at index 0 to h1 at index 63', () => {
		expect(squareName(0)).toBe('a8');
		expect(squareName(63)).toBe('h1');
		expect(parseSquare('e4')).toBe(36);
		expect(parseSquare('i9')).toBeNull();
	});
});

describe('move generation', () => {
	it('matches the known perft counts from the starting position', () => {
		const start = initialPosition();
		expect(perft(start, 1)).toBe(20);
		expect(perft(start, 2)).toBe(400);
		expect(perft(start, 3)).toBe(8902);
	});

	it('handles castling, en passant and promotion (Kiwipete position)', () => {
		const kiwipete = positionFromRows(
			[
				'r...k..r',
				'p.ppqpb.',
				'bn..pnp.',
				'...PN...',
				'.p..P...',
				'..N..Q.p',
				'PPPBBPPP',
				'R...K..R'
			],
			'w',
			{ castling: { wK: true, wQ: true, bK: true, bQ: true } }
		);
		expect(perft(kiwipete, 1)).toBe(48);
		expect(perft(kiwipete, 2)).toBe(2039);
	});

	it('handles pins and en passant discovered checks (endgame position)', () => {
		const endgame = positionFromRows([
			'........',
			'..p.....',
			'...p....',
			'KP.....r',
			'.R...p.k',
			'........',
			'....P.P.',
			'........'
		]);
		expect(perft(endgame, 1)).toBe(14);
		expect(perft(endgame, 2)).toBe(191);
		expect(perft(endgame, 3)).toBe(2812);
	});

	it('only lets a pinned piece move along the pin', () => {
		const pinned = positionFromRows([
			'....k...',
			'....r...',
			'........',
			'........',
			'........',
			'........',
			'....B...',
			'....K...'
		]);
		expect(legalMoves(pinned).filter((move) => move.piece === 'b')).toEqual([]);
	});

	it('offers all four promotions', () => {
		const promote = positionFromRows([
			'.......k',
			'P.......',
			'........',
			'........',
			'........',
			'........',
			'........',
			'K.......'
		]);
		const promotions = legalMoves(promote)
			.filter((move) => move.piece === 'p')
			.map((move) => move.promotion);
		expect(promotions.sort()).toEqual(['b', 'n', 'q', 'r']);
	});

	it('does not castle out of, through or into check', () => {
		const rows = [
			'....k...',
			'........',
			'........',
			'........',
			'........',
			'........',
			'........',
			'R...K..R'
		];
		const castling = { wK: true, wQ: true };
		const free = positionFromRows(rows, 'w', { castling });
		expect(legalMoves(free).filter((move) => move.flag?.startsWith('castle'))).toHaveLength(2);

		const rookOnF = positionFromRows(['....k.r.', ...rows.slice(1, 7), 'R...K..R'], 'w', {
			castling
		});
		const flags = legalMoves(rookOnF).map((move) => move.flag);
		expect(flags).not.toContain('castle-king');
		expect(flags).toContain('castle-queen');

		const inCheck = positionFromRows(
			[
				'....k...',
				'........',
				'........',
				'........',
				'........',
				'........',
				'........',
				'R...K..R'
			].map((row, index) => (index === 3 ? '....r...' : row)),
			'w',
			{ castling }
		);
		expect(isInCheck(inCheck)).toBe(true);
		expect(legalMoves(inCheck).some((move) => move.flag?.startsWith('castle'))).toBe(false);
	});

	it('captures en passant only directly after the double step', () => {
		let position = play(initialPosition(), 'e2e4', 'a7a6', 'e4e5', 'd7d5');
		expect(moveFromText(position, 'e5d6')?.flag).toBe('en-passant');
		position = play(position, 'e5d6');
		expect(position.board[parseSquare('d5')!]).toBeNull();

		const late = play(initialPosition(), 'e2e4', 'a7a6', 'e4e5', 'd7d5', 'h2h3', 'a6a5');
		expect(moveFromText(late, 'e5d6')).toBeNull();
	});
});

describe('game status', () => {
	it('detects fool’s mate', () => {
		const mated = play(initialPosition(), 'f2f3', 'e7e5', 'g2g4', 'd8h4');
		expect(gameStatus(mated)).toEqual({ kind: 'checkmate', winner: 'b' });
	});

	it('detects stalemate', () => {
		const stalemate = positionFromRows(
			[
				'k.......',
				'..Q.....',
				'.K......',
				'........',
				'........',
				'........',
				'........',
				'........'
			],
			'b'
		);
		expect(gameStatus(stalemate)).toEqual({ kind: 'draw', reason: 'stalemate' });
	});

	it('detects insufficient material and the fifty-move rule', () => {
		const bare = positionFromRows(
			[
				'k.......',
				'........',
				'........',
				'........',
				'........',
				'........',
				'........',
				'K.......'
			],
			'w'
		);
		expect(gameStatus(bare)).toEqual({ kind: 'draw', reason: 'insufficient-material' });

		const rooks = positionFromRows(
			[
				'k.......',
				'........',
				'........',
				'........',
				'........',
				'........',
				'........',
				'K......R'
			],
			'w'
		);
		expect(gameStatus({ ...rooks, halfmoveClock: 100 })).toEqual({
			kind: 'draw',
			reason: 'fifty-moves'
		});
		expect(gameStatus(rooks)).toEqual({ kind: 'playing', check: false });
	});

	it('detects a threefold repetition', () => {
		let position = initialPosition();
		const history = [positionKey(position)];
		for (const text of ['g1f3', 'g8f6', 'f3g1', 'f6g8', 'g1f3', 'g8f6', 'f3g1', 'f6g8']) {
			position = play(position, text);
			history.push(positionKey(position));
		}
		expect(gameStatus(position, history)).toEqual({ kind: 'draw', reason: 'repetition' });
		expect(gameStatus(position, history.slice(0, 5))).toEqual({ kind: 'playing', check: false });
	});
});

describe('move text', () => {
	it('round-trips moves, including promotions', () => {
		const start = initialPosition();
		const move = moveFromText(start, 'e2e4')!;
		expect(moveToText(move)).toBe('e2e4');
		expect(moveFromText(start, 'e2e5')).toBeNull();
		expect(moveFromText(start, 'nonsense')).toBeNull();
	});
});
