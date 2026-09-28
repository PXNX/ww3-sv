import { describe, expect, it } from 'vitest';
import { createRandom } from '../random';
import {
	applyMove,
	canMove,
	COMBO_BONUS,
	createGame,
	DEFAULT_SIZE,
	destroyMinesNear,
	DIRECTIONS,
	emptyCells,
	isGameOver,
	isMergeState,
	MAX_TIER,
	MINE_BONUS,
	MINE_INTERVAL,
	scoreMove,
	shipValue,
	slide,
	spawnShip,
	useSubmarine,
	type Board,
	type Direction,
	type MergeState
} from './mergeBoard';

/**
 * Boards are written as rows of space-separated cells: a digit is a ship tier, M a mine and
 * . an empty cell. Tiles get ids 1, 2, 3 and so on in reading order.
 */
function parse(rows: string[]): Board {
	let id = 1;
	return rows.map((row) =>
		row.split(' ').map((token) => {
			if (token === '.') return null;
			if (token === 'M') return { id: id++, kind: 'mine' as const };
			return { id: id++, kind: 'ship' as const, tier: Number(token) };
		})
	);
}

function show(board: Board): string[] {
	return board.map((row) =>
		row.map((cell) => (cell === null ? '.' : cell.kind === 'mine' ? 'M' : cell.tier)).join(' ')
	);
}

function stateFrom(rows: string[], overrides: Partial<MergeState> = {}): MergeState {
	const board = parse(rows);
	const tiles = board.flat().filter((cell) => cell !== null);
	return {
		size: board.length,
		board,
		score: 0,
		moves: 0,
		highestTier: Math.max(0, ...tiles.map((tile) => (tile.kind === 'ship' ? tile.tier : 0))),
		submarines: 1,
		minesDestroyed: 0,
		nextId: tiles.length + 1,
		...overrides
	};
}

function slid(rows: string[], direction: Direction): string[] {
	return show(slide(parse(rows), direction).board);
}

function tileCount(board: Board): number {
	return board.flat().filter((cell) => cell !== null).length;
}

describe('slide and merge', () => {
	it('slides ships as far as possible in each direction', () => {
		const rows = ['. . .', '. 1 .', '. . .'];
		expect(slid(rows, 'left')).toEqual(['. . .', '1 . .', '. . .']);
		expect(slid(rows, 'right')).toEqual(['. . .', '. . 1', '. . .']);
		expect(slid(rows, 'up')).toEqual(['. 1 .', '. . .', '. . .']);
		expect(slid(rows, 'down')).toEqual(['. . .', '. . .', '. 1 .']);
	});

	it('merges two ships of the same tier into the next tier', () => {
		expect(slid(['1 . 1 .', '. . . .', '. . . .', '. . . .'], 'left')[0]).toBe('2 . . .');
		expect(slid(['3 3 . .', '. . . .', '. . . .', '. . . .'], 'right')[0]).toBe('. . . 4');
	});

	it('does not merge ships of different tiers', () => {
		expect(slid(['1 . 2 .', '. . . .', '. . . .', '. . . .'], 'left')[0]).toBe('1 2 . .');
	});

	it('merges each ship at most once per move, like classic 2048', () => {
		const row = (cells: string) => [cells, '. . . .', '. . . .', '. . . .'];
		expect(slid(row('1 1 1 1'), 'left')[0]).toBe('2 2 . .');
		expect(slid(row('1 1 1 1'), 'right')[0]).toBe('. . 2 2');
		// A freshly merged ship does not merge again with an equal ship behind it
		expect(slid(row('1 1 2 .'), 'left')[0]).toBe('2 2 . .');
		expect(slid(row('2 1 1 .'), 'left')[0]).toBe('2 2 . .');
		expect(slid(row('2 2 2 .'), 'left')[0]).toBe('3 2 . .');
		// Merges resolve from the wall outward
		expect(slid(row('1 1 1 .'), 'left')[0]).toBe('2 1 . .');
		expect(slid(row('1 1 1 .'), 'right')[0]).toBe('. . 1 2');
	});

	it('merges columns when sliding up and down', () => {
		const rows = ['1 2 .', '1 . .', '1 2 .'];
		expect(slid(rows, 'up')).toEqual(['2 3 .', '1 . .', '. . .']);
		expect(slid(rows, 'down')).toEqual(['. . .', '1 . .', '2 3 .']);
	});

	it('reports every merge with the kept and absorbed ships', () => {
		const board = parse(['. 2 . 2', '. . . .', '. . . .', '. . . .']);
		const result = slide(board, 'left');
		expect(result.merges).toEqual([
			{ row: 0, col: 0, tier: 3, keptId: 1, absorbedId: 2, absorbedFrom: { row: 0, col: 3 } }
		]);
		// The kept ship keeps its id so the view can animate it sliding
		expect(result.board[0][0]).toEqual({ id: 1, kind: 'ship', tier: 3 });
	});

	it('never merges two Mega-Tankers', () => {
		const top = `${MAX_TIER} ${MAX_TIER} .`;
		const result = slide(parse([top, '. . .', '. . .']), 'left');
		expect(result.changed).toBe(false);
		expect(result.merges).toEqual([]);
	});

	it('reports whether the board changed', () => {
		expect(slide(parse(['1 . .', '. . .', '. . .']), 'left').changed).toBe(false);
		expect(slide(parse(['1 . .', '. . .', '. . .']), 'right').changed).toBe(true);
		expect(slide(parse(['1 2 .', '. . .', '. . .']), 'left').changed).toBe(false);
	});

	it('does not modify the input board', () => {
		const board = parse(['1 1 .', '. . .', '. . .']);
		const before = structuredClone(board);
		slide(board, 'right');
		expect(board).toEqual(before);
	});
});

describe('mines', () => {
	it('never move, and block ships from passing', () => {
		const rows = ['. 1 M . 1', '. . . . .', '. . . . .', '. . . . .', '. . . . .'];
		expect(slid(rows, 'left')[0]).toBe('1 . M 1 .');
		expect(slid(rows, 'right')[0]).toBe('. 1 M . 1');
	});

	it('keep ships of the same tier on either side from merging', () => {
		const rows = ['1 M 1', '. . .', '. . .'];
		expect(slide(parse(rows), 'left').changed).toBe(false);
		expect(slide(parse(rows), 'right').changed).toBe(false);
		expect(slide(parse(rows), 'left').merges).toEqual([]);
	});

	it('block columns as well as rows', () => {
		expect(
			slid(
				['.', 'M', '1'].map((row) => `${row} . .`),
				'up'
			)
		).toEqual(['. . .', 'M . .', '1 . .']);
	});

	it('are destroyed by a merge in an orthogonally adjacent cell', () => {
		const state = stateFrom(['. 1 1', 'M M .', '. . .']);
		const outcome = applyMove(state, 'left', createRandom(1));
		// The merge lands at the top left; the mine below it is destroyed, the diagonal one is not
		expect(outcome.destroyedMines).toEqual([{ row: 1, col: 0, id: 3 }]);
		expect(outcome.state.board[1][0]?.kind).not.toBe('mine');
		expect(outcome.state.board[1][1]).toEqual({ id: 4, kind: 'mine' });
		expect(outcome.state.minesDestroyed).toBe(1);
	});

	it('are not destroyed by a merge that is only diagonally adjacent', () => {
		const board = parse(['. . .', '. M .', '. . .']);
		expect(destroyMinesNear(board, [{ row: 0, col: 0 }]).destroyed).toEqual([]);
		expect(destroyMinesNear(board, [{ row: 0, col: 1 }]).destroyed).toHaveLength(1);
	});

	it('can all be destroyed by one merge', () => {
		const board = parse(['. M .', 'M . M', '. M .']);
		const result = destroyMinesNear(board, [{ row: 1, col: 1 }]);
		expect(result.destroyed).toHaveLength(4);
		expect(show(result.board)).toEqual(['. . .', '. . .', '. . .']);
	});

	it('are dropped after every fifth board-changing move', () => {
		const random = createRandom(2024);
		let state = createGame(random);
		const dropMoves: number[] = [];
		while (state.moves < 20) {
			const direction = DIRECTIONS.find((d) => slide(state.board, d).changed);
			if (!direction) break;
			const outcome = applyMove(state, direction, random);
			if (outcome.droppedMine) {
				dropMoves.push(outcome.state.moves);
				const { row, col } = outcome.droppedMine;
				expect(outcome.state.board[row][col]?.kind).toBe('mine');
			}
			state = outcome.state;
		}
		expect(state.moves).toBe(20);
		expect(MINE_INTERVAL).toBe(5);
		expect(dropMoves).toEqual([5, 10, 15, 20]);
	});

	it('are not dropped when a no-op move is attempted', () => {
		const state = stateFrom(['1 . .', '. . .', '. . .'], { moves: MINE_INTERVAL - 1 });
		const outcome = applyMove(state, 'left', createRandom(3));
		expect(outcome.droppedMine).toBeNull();
		expect(outcome.state.moves).toBe(MINE_INTERVAL - 1);
	});
});

describe('moves', () => {
	it('spawn a Rowboat or a Fishing Boat after a move that changes the board', () => {
		const state = stateFrom(['1 . .', '. . .', '. . .']);
		const outcome = applyMove(state, 'right', createRandom(4));
		expect(outcome.changed).toBe(true);
		expect(outcome.spawned).not.toBeNull();
		expect(tileCount(outcome.state.board)).toBe(2);
		const { row, col, tier } = outcome.spawned!;
		expect(outcome.state.board[row][col]).toEqual({ id: state.nextId, kind: 'ship', tier });
		expect([1, 2]).toContain(tier);
		expect(outcome.state.nextId).toBe(state.nextId + 1);
		expect(outcome.state.moves).toBe(1);
	});

	it('do not spawn anything when nothing changes', () => {
		const state = stateFrom(['1 2 .', 'M . .', '. . .'], { score: 30, moves: 3 });
		const outcome = applyMove(state, 'left', createRandom(5));
		expect(outcome.changed).toBe(false);
		expect(outcome.spawned).toBeNull();
		expect(outcome.state).toBe(state);
		expect(outcome.score.total).toBe(0);
	});

	it('spawn Rowboats most of the time and Fishing Boats occasionally', () => {
		const random = createRandom(6);
		const counts = { 1: 0, 2: 0 } as Record<number, number>;
		for (let i = 0; i < 2000; i++) {
			const spawned = spawnShip(parse(['. .', '. .']), random, 1)!;
			counts[spawned.tier]++;
		}
		expect(Object.keys(counts)).toEqual(['1', '2']);
		expect(counts[2]).toBeGreaterThan(0);
		expect(counts[1]).toBeGreaterThan(counts[2] * 4);
	});

	it('flag the creation of a Mega-Tanker and track the highest tier', () => {
		const below = MAX_TIER - 1;
		const state = stateFrom([`${below} ${below} .`, '. . .', '. . .']);
		const outcome = applyMove(state, 'left', createRandom(7));
		expect(outcome.createdMegaTanker).toBe(true);
		expect(outcome.state.highestTier).toBe(MAX_TIER);
		const smaller = applyMove(stateFrom(['1 1 .', '. . .', '. . .']), 'left', createRandom(7));
		expect(smaller.createdMegaTanker).toBe(false);
		expect(smaller.state.highestTier).toBe(2);
	});

	it('are deterministic for the same seed', () => {
		const play = (seed: number) => {
			const random = createRandom(seed);
			let state = createGame(random);
			for (const direction of ['left', 'up', 'right', 'down', 'left', 'up'] as const) {
				state = applyMove(state, direction, random).state;
			}
			return state;
		};
		expect(play(11)).toEqual(play(11));
	});
});

describe('scoring', () => {
	it('uses the value of each newly created ship', () => {
		expect(shipValue(2)).toBe(4);
		expect(shipValue(3)).toBe(8);
		const outcome = applyMove(stateFrom(['1 1 .', '. . .', '. . .']), 'left', createRandom(8));
		expect(outcome.score).toEqual({ shipPoints: 4, comboBonus: 0, mineBonus: 0, total: 4 });
		expect(outcome.state.score).toBe(4);
	});

	it('adds a bonus for double merges in one move', () => {
		const state = stateFrom(['1 1 2 2', '. . . .', '. . . .', '. . . .'], { score: 100 });
		const outcome = applyMove(state, 'left', createRandom(9));
		expect(show(outcome.state.board)[0].startsWith('2 3')).toBe(true);
		expect(outcome.score.shipPoints).toBe(shipValue(2) + shipValue(3));
		expect(outcome.score.comboBonus).toBe(COMBO_BONUS);
		expect(outcome.state.score).toBe(100 + 12 + COMBO_BONUS);
		// Three merges in one move earn the bonus twice
		expect(scoreMove([{ tier: 2 }, { tier: 2 }, { tier: 2 }], 0).comboBonus).toBe(2 * COMBO_BONUS);
	});

	it('adds a bonus for each destroyed mine', () => {
		const state = stateFrom(['M . M', '1 . 1', 'M . .']);
		const outcome = applyMove(state, 'left', createRandom(10));
		expect(outcome.destroyedMines).toHaveLength(2);
		expect(outcome.score).toEqual({
			shipPoints: 4,
			comboBonus: 0,
			mineBonus: 2 * MINE_BONUS,
			total: 4 + 2 * MINE_BONUS
		});
	});
});

describe('submarine', () => {
	it('removes the chosen mine and uses up the charge', () => {
		const state = stateFrom(['M 1 .', '. M .', '. . .']);
		const next = useSubmarine(state, { row: 1, col: 1 });
		expect(next).not.toBeNull();
		expect(show(next!.board)).toEqual(['M 1 .', '. . .', '. . .']);
		expect(next!.submarines).toBe(0);
		expect(state.board[1][1]?.kind).toBe('mine');
		expect(useSubmarine(next!, { row: 0, col: 0 })).toBeNull();
	});

	it('only targets mines', () => {
		const state = stateFrom(['M 1 .', '. . .', '. . .']);
		expect(useSubmarine(state, { row: 0, col: 1 })).toBeNull();
		expect(useSubmarine(state, { row: 0, col: 2 })).toBeNull();
		expect(useSubmarine(state, { row: 5, col: 5 })).toBeNull();
	});
});

describe('game over', () => {
	const stuck = ['1 2 3', '2 3 1', '3 1 2'];

	it('is not reached while ships can still slide or merge', () => {
		expect(isGameOver(stateFrom(['1 . .', '. . .', '. . .']))).toBe(false);
		expect(isGameOver(stateFrom(['1 2 3', '2 3 1', '3 1 1']))).toBe(false);
		expect(isGameOver(stateFrom(['1 2 3', '2 3 1', '3 2 2']))).toBe(false);
	});

	it('is reached when the board is full and nothing can slide or merge', () => {
		expect(canMove(parse(stuck))).toBe(false);
		expect(isGameOver(stateFrom(stuck))).toBe(true);
	});

	it('is reached when mines wall off the only empty cells', () => {
		const walled = ['1 M .', '2 3 M', '4 5 6'];
		expect(emptyCells(parse(walled))).toHaveLength(1);
		expect(isGameOver(stateFrom(walled, { submarines: 0 }))).toBe(true);
	});

	it('waits while the submarine could still clear a mine', () => {
		const full = ['1 2 3', '2 M 1', '3 1 2'];
		expect(canMove(parse(full))).toBe(false);
		expect(isGameOver(stateFrom(full, { submarines: 1 }))).toBe(false);
		expect(isGameOver(stateFrom(full, { submarines: 0 }))).toBe(true);
	});

	it('does not count two Mega-Tankers side by side as a possible merge', () => {
		const t = MAX_TIER;
		expect(isGameOver(stateFrom([`${t} ${t} 1`, '1 2 3', '2 3 1']))).toBe(true);
	});
});

describe('new games', () => {
	it('start with two ships on a five by five board and one submarine', () => {
		const state = createGame(createRandom(12));
		expect(state.size).toBe(DEFAULT_SIZE);
		expect(state.board).toHaveLength(DEFAULT_SIZE);
		expect(state.board.every((row) => row.length === DEFAULT_SIZE)).toBe(true);
		expect(tileCount(state.board)).toBe(2);
		expect(state).toMatchObject({ score: 0, moves: 0, submarines: 1, minesDestroyed: 0 });
		expect(isGameOver(state)).toBe(false);
	});

	it('support other board sizes and reject invalid ones', () => {
		expect(createGame(createRandom(13), 4).board).toHaveLength(4);
		expect(() => createGame(createRandom(13), 2)).toThrow();
		expect(() => createGame(createRandom(13), 4.5)).toThrow();
	});
});

describe('saved games', () => {
	it('accept a valid state', () => {
		const random = createRandom(14);
		const state = applyMove(createGame(random), 'left', random).state;
		expect(isMergeState(JSON.parse(JSON.stringify(state)))).toBe(true);
		expect(isMergeState(stateFrom(['M 1 .', '. 8 .', '. . .']))).toBe(true);
	});

	it('reject corrupted data', () => {
		const valid = stateFrom(['1 2 .', '. M .', '. . .']);
		const broken: unknown[] = [
			null,
			'text',
			{ ...valid, size: 2 },
			{ ...valid, board: valid.board.slice(1) },
			{ ...valid, score: -1 },
			{ ...valid, submarines: 5 },
			{ ...valid, nextId: 2 },
			{ ...valid, board: parse(['1 9 .', '. . .', '. . .']) },
			{
				...valid,
				board: [
					[{ id: 1, kind: 'ship', tier: 1 }, { id: 1, kind: 'mine' }, null],
					...valid.board.slice(1)
				]
			}
		];
		for (const value of broken) expect(isMergeState(value)).toBe(false);
	});
});
