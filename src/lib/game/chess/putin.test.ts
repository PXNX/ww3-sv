import { describe, expect, it } from 'vitest';
import { createRandom } from '../random';
import {
	applyMove,
	gameStatus,
	initialPosition,
	legalMoves,
	moveFromText,
	positionFromRows,
	type Position
} from './chess';
import { choosePutinMove } from './putin';

const afterE4 = () => {
	const start = initialPosition();
	return applyMove(start, moveFromText(start, 'e2e4')!);
};

describe('Putin', () => {
	it('has no move when he is checkmated', () => {
		const mated = positionFromRows(
			[
				'R.....k.',
				'R.......',
				'........',
				'........',
				'........',
				'........',
				'........',
				'K.......'
			],
			'b'
		);
		expect(choosePutinMove(mated, createRandom(1))).toBeNull();
	});

	it('always plays a legal move', () => {
		const random = createRandom(7);
		let position: Position = initialPosition();
		for (let ply = 0; ply < 40 && gameStatus(position).kind === 'playing'; ply++) {
			const choice = choosePutinMove(position, random)!;
			expect(legalMoves(position)).toContainEqual(choice.move);
			position = applyMove(position, choice.move);
		}
	});

	it('never misses a checkmate in one, even when he wants to blunder', () => {
		const backRank = positionFromRows(
			[
				'......k.',
				'.....ppp',
				'........',
				'........',
				'........',
				'........',
				'.....PPP',
				'r.....K.'
			],
			'b'
		);
		const choice = choosePutinMove(backRank, () => 0, { blunderChance: 1 })!;
		expect(choice.blunder).toBe(false);
		expect(gameStatus(applyMove(backRank, choice.move))).toEqual({
			kind: 'checkmate',
			winner: 'b'
		});
	});

	it('takes a free queen when he is not blundering', () => {
		const position = positionFromRows(
			[
				'....k...',
				'........',
				'........',
				'...q....',
				'........',
				'........',
				'........',
				'K..Q....'
			],
			'b'
		);
		const choice = choosePutinMove(position, () => 0.999, { blunderChance: 0 })!;
		expect(choice.blunder).toBe(false);
		expect(choice.move.captured).toBe('q');
	});

	it('plays rookie mistakes now and then, and none when the chance is zero', () => {
		const random = createRandom(11);
		let blunders = 0;
		for (let game = 0; game < 200; game++) {
			if (choosePutinMove(afterE4(), random, { blunderChance: 0.5 })!.blunder) blunders++;
		}
		expect(blunders).toBeGreaterThan(40);
		expect(blunders).toBeLessThan(160);

		for (let game = 0; game < 50; game++) {
			expect(choosePutinMove(afterE4(), random, { blunderChance: 0 })!.blunder).toBe(false);
		}
	});

	it('only blunders a pawn up to a minor piece, never a rook or the queen', () => {
		const random = createRandom(3);
		let blunders = 0;
		for (let game = 0; game < 200; game++) {
			const choice = choosePutinMove(afterE4(), random, { blunderChance: 1 })!;
			if (!choice.blunder) continue;
			blunders++;
			const after = applyMove(afterE4(), choice.move);
			const big = legalMoves(after).filter(
				(reply) => reply.captured === 'r' || reply.captured === 'q'
			);
			expect(big).toEqual([]);
		}
		expect(blunders).toBeGreaterThan(20);
	});
});
