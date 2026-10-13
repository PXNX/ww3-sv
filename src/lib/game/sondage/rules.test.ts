import { describe, expect, it } from 'vitest';
import { createBoard, isLand, type Board, type Side } from './board';
import { decide, finalScore, majority, share, TOTAL_ROUNDS } from './rules';

/** A board where the first `you` land tiles are yours and the next `rival` are the rival's */
function boardWith(you: number, rival: number): Board {
	const board = createBoard();
	let i = 0;
	for (const cell of board.cells) {
		if (!isLand(cell)) continue;
		const owner: Side | null = i < you ? 'you' : i < you + rival ? 'rival' : null;
		cell.owner = owner;
		i += 1;
	}
	return board;
}

describe('majority and share', () => {
	it('needs more than half of the 55 départements', () => {
		expect(majority(55)).toBe(28);
		expect(majority(54)).toBe(28);
	});

	it('measures the map share of each side', () => {
		const board = boardWith(11, 22);
		expect(share(board, 'you')).toBeCloseTo(0.2);
		expect(share(board, 'rival')).toBeCloseTo(0.4);
	});
});

describe('decide', () => {
	it('keeps the race open below the majority', () => {
		expect(decide(boardWith(27, 20), 6, true)).toBeNull();
		expect(decide(boardWith(27, 27), 6, false)).toBeNull();
	});

	it('calls the rival the winner as soon as she crosses the threshold, before the last round', () => {
		expect(decide(boardWith(10, 28), 7, false)).toEqual({
			winner: 'rival',
			reason: 'majority',
			early: true
		});
	});

	it('calls the player the winner the same way', () => {
		expect(decide(boardWith(28, 10), 3, false)).toEqual({
			winner: 'you',
			reason: 'majority',
			early: true
		});
	});

	it('crossing the threshold in the last round is not early', () => {
		expect(decide(boardWith(28, 10), TOTAL_ROUNDS, false)?.early).toBe(false);
	});

	it('decides on the larger share after the last round, a tie goes to the rival', () => {
		expect(decide(boardWith(20, 15), TOTAL_ROUNDS, false)).toBeNull();
		expect(decide(boardWith(20, 15), TOTAL_ROUNDS, true)).toEqual({
			winner: 'you',
			reason: 'final',
			early: false
		});
		expect(decide(boardWith(15, 20), TOTAL_ROUNDS, true)?.winner).toBe('rival');
		expect(decide(boardWith(18, 18), TOTAL_ROUNDS, true)?.winner).toBe('rival');
	});
});

describe('finalScore', () => {
	it('pays tiles, flips and, for a win, a bonus for rounds saved', () => {
		const win = { winner: 'you', reason: 'majority', early: true } as const;
		const lose = { winner: 'rival', reason: 'majority', early: true } as const;
		expect(finalScore(win, 28, 10, 5)).toBe(280 + 30 + 250 + 100);
		expect(finalScore(lose, 20, 10, 5)).toBe(200 + 30);
	});
});
