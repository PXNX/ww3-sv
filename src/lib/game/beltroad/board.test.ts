import { describe, expect, it } from 'vitest';
import {
	DEBT_PER_MOVE,
	PORTS,
	coveredCount,
	debtFor,
	decodeRoute,
	dragStroke,
	emptyPaths,
	encodeRoute,
	isConnected,
	isSolved,
	movesForStars,
	ownerGrid,
	parFor,
	samePaths,
	solutionPaths,
	startStroke,
	starsFor,
	stepStroke,
	stepToward,
	validate,
	validateLevel,
	type Cell,
	type Level,
	type Paths
} from './board';

/** 3x3: Shanghai joins the top corners, Piraeus runs the rest of the board in a U */
const MINI: Level = {
	id: 'mini',
	tier: 'easy',
	width: 3,
	height: 3,
	pairs: [
		{ port: 'shanghai', a: [0, 0], b: [0, 2] },
		{ port: 'piraeus', a: [1, 0], b: [2, 0] }
	],
	solution: ['RR', 'RRDLL']
};

const route = (...cells: Cell[]) => cells;
const SHANGHAI = 0;
const PIRAEUS = 1;

describe('routes as steps', () => {
	it('decodes and encodes routes', () => {
		const cells = decodeRoute([1, 0], 'RRDLL');
		expect(cells).toEqual([
			[1, 0],
			[1, 1],
			[1, 2],
			[2, 2],
			[2, 1],
			[2, 0]
		]);
		expect(encodeRoute(cells)).toBe('RRDLL');
		expect(decodeRoute([2, 2], 'UUL')).toEqual([
			[2, 2],
			[1, 2],
			[0, 2],
			[0, 1]
		]);
		expect(() => decodeRoute([0, 0], 'X')).toThrow();
		expect(() =>
			encodeRoute([
				[0, 0],
				[2, 2]
			])
		).toThrow();
	});
});

describe('scoring', () => {
	it('par is one stroke per route', () => {
		expect(parFor(MINI)).toBe(2);
	});

	it('gives three stars near par, two within double par, otherwise one', () => {
		expect(starsFor(4, 4)).toBe(3);
		expect(starsFor(movesForStars(6, 3), 6)).toBe(3);
		expect(starsFor(movesForStars(6, 3) + 1, 6)).toBe(2);
		expect(starsFor(12, 6)).toBe(2);
		expect(starsFor(13, 6)).toBe(1);
		expect(starsFor(200, 6)).toBe(1);
		expect(movesForStars(3, 3)).toBe(4);
		expect(movesForStars(3, 2)).toBe(6);
	});

	it('always leaves some slack for three stars and a wider band for two', () => {
		for (let par = 2; par <= 9; par++) {
			expect(movesForStars(par, 3)).toBeGreaterThan(par);
			expect(movesForStars(par, 2)).toBeGreaterThan(movesForStars(par, 3));
		}
	});

	it('debt rises with every move', () => {
		expect(debtFor(0)).toBe(0);
		expect(debtFor(1)).toBe(DEBT_PER_MOVE);
		expect(debtFor(4)).toBe(4 * DEBT_PER_MOVE);
		expect(debtFor(-3)).toBe(0);
	});
});

describe('validator', () => {
	it('accepts the stored solution', () => {
		const result = validate(MINI, solutionPaths(MINI));
		expect(result).toEqual({
			uncovered: [],
			overlapping: [],
			broken: [],
			unconnected: [],
			solved: true
		});
		expect(isSolved(MINI, solutionPaths(MINI))).toBe(true);
	});

	it('accepts a route written from either port', () => {
		const reversed: Paths = [
			route([0, 2], [0, 1], [0, 0]),
			route([2, 0], [2, 1], [2, 2], [1, 2], [1, 1], [1, 0])
		];
		expect(isSolved(MINI, reversed)).toBe(true);
	});

	it('rejects an empty board and lists every cell as uncovered', () => {
		const result = validate(MINI, emptyPaths(MINI));
		expect(result.solved).toBe(false);
		expect(result.uncovered).toHaveLength(9);
		expect(result.unconnected).toEqual([0, 1]);
	});

	it('requires full coverage even when every pair is connected', () => {
		// Piraeus takes the short way: connected, but four cells stay empty
		const paths: Paths = [route([0, 0], [0, 1], [0, 2]), route([1, 0], [2, 0])];
		const result = validate(MINI, paths);
		expect(result.unconnected).toEqual([]);
		expect(result.overlapping).toEqual([]);
		expect(result.uncovered).toHaveLength(4);
		expect(result.solved).toBe(false);
	});

	it('rejects overlapping routes', () => {
		const paths: Paths = [
			route([0, 0], [0, 1], [0, 2]),
			route([1, 0], [1, 1], [0, 1], [0, 2], [1, 2], [2, 2], [2, 1], [2, 0])
		];
		const result = validate(MINI, paths);
		expect(result.overlapping).toEqual([
			[0, 1],
			[0, 2]
		]);
		expect(result.broken).toEqual([PIRAEUS]);
		expect(result.solved).toBe(false);
	});

	it('rejects a route that passes over a foreign port', () => {
		const paths: Paths = [route([0, 0], [1, 0], [1, 1], [0, 1], [0, 2]), route([1, 0], [2, 0])];
		const result = validate(MINI, paths);
		expect(result.broken).toContain(SHANGHAI);
		expect(result.solved).toBe(false);
	});

	it('rejects a route with a gap and a route that stops short of its port', () => {
		const gap: Paths = [route([0, 0], [0, 2]), solutionPaths(MINI)[PIRAEUS]];
		expect(validate(MINI, gap).broken).toEqual([SHANGHAI]);
		expect(isConnected(MINI, gap, SHANGHAI)).toBe(false);
		const short: Paths = [route([0, 0], [0, 1]), solutionPaths(MINI)[PIRAEUS]];
		expect(validate(MINI, short).unconnected).toEqual([SHANGHAI]);
		expect(validate(MINI, short).uncovered).toEqual([[0, 2]]);
	});

	it('rejects routes that leave the grid', () => {
		const paths: Paths = [route([0, 0], [0, 1], [0, 2], [0, 3]), solutionPaths(MINI)[PIRAEUS]];
		expect(validate(MINI, paths).broken).toEqual([SHANGHAI]);
	});

	it('counts and maps covered cells', () => {
		const paths: Paths = [route([0, 0], [0, 1]), []];
		expect(coveredCount(MINI, paths)).toBe(2);
		expect([...ownerGrid(MINI, paths)]).toEqual([0, 0, -1, -1, -1, -1, -1, -1, -1]);
	});
});

describe('level definitions', () => {
	it('accepts a well formed level', () => {
		expect(validateLevel(MINI)).toEqual([]);
	});

	it('flags broken levels', () => {
		expect(validateLevel({ ...MINI, pairs: [] })).toContain('no pairs');
		expect(
			validateLevel({
				...MINI,
				pairs: [MINI.pairs[0], { port: 'shanghai', a: [1, 0], b: [2, 0] }]
			})
		).toContain('port shanghai twice');
		expect(
			validateLevel({
				...MINI,
				pairs: [MINI.pairs[0], { port: 'piraeus', a: [0, 0], b: [2, 0] }]
			})
		).toContain('two ports share 0,0');
		expect(
			validateLevel({
				...MINI,
				pairs: [MINI.pairs[0], { port: 'piraeus', a: [1, 0], b: [3, 0] }]
			})
		).toContain('piraeus port outside the grid');
		expect(validateLevel({ ...MINI, solution: ['RR'] })).toContain('solution is missing pairs');
	});

	it('knows nine distinct ports', () => {
		expect(new Set(PORTS).size).toBe(9);
	});
});

describe('starting a stroke', () => {
	it('starts on a port, and starts that route over', () => {
		const first = startStroke(MINI, emptyPaths(MINI), [0, 0]);
		expect(first?.pair).toBe(SHANGHAI);
		expect(first?.paths[SHANGHAI]).toEqual([[0, 0]]);
		const again = startStroke(MINI, solutionPaths(MINI), [0, 2]);
		expect(again?.pair).toBe(SHANGHAI);
		// Pressing the far port starts from there, so the route is rewritten the other way round
		expect(again?.paths[SHANGHAI]).toEqual([[0, 2]]);
		expect(again?.paths[PIRAEUS]).toEqual(solutionPaths(MINI)[PIRAEUS]);
	});

	it('continues a route from a cell in its middle, cutting the rest off', () => {
		const started = startStroke(MINI, solutionPaths(MINI), [1, 2]);
		expect(started?.pair).toBe(PIRAEUS);
		expect(started?.paths[PIRAEUS]).toEqual(route([1, 0], [1, 1], [1, 2]));
	});

	it('does nothing on an empty cell or off the board', () => {
		expect(startStroke(MINI, emptyPaths(MINI), [1, 1])).toBeNull();
		expect(startStroke(MINI, emptyPaths(MINI), [5, 5])).toBeNull();
	});
});

describe('drawing a route', () => {
	const begin = (cell: Cell, paths: Paths = emptyPaths(MINI)) => {
		const started = startStroke(MINI, paths, cell);
		if (!started) throw new Error('no stroke');
		return started;
	};

	it('grows into free cells', () => {
		const { paths, pair } = begin([1, 0]);
		const step = stepStroke(MINI, paths, pair, [1, 1]);
		expect(step.result).toBe('moved');
		expect(step.paths[PIRAEUS]).toEqual(route([1, 0], [1, 1]));
	});

	it('ignores cells that are not next to the tip or off the grid', () => {
		const { paths, pair } = begin([1, 0]);
		expect(stepStroke(MINI, paths, pair, [1, 2]).result).toBe('ignored');
		expect(stepStroke(MINI, paths, pair, [2, 1]).result).toBe('ignored');
		expect(stepStroke(MINI, paths, pair, [1, -1]).result).toBe('ignored');
		expect(stepStroke(MINI, emptyPaths(MINI), SHANGHAI, [0, 1]).result).toBe('ignored');
	});

	it('retracts when dragged back over its own line', () => {
		let { paths } = begin([1, 0]);
		paths = stepStroke(MINI, paths, PIRAEUS, [1, 1]).paths;
		paths = stepStroke(MINI, paths, PIRAEUS, [1, 2]).paths;
		const back = stepStroke(MINI, paths, PIRAEUS, [1, 1]);
		expect(back.result).toBe('retracted');
		expect(back.paths[PIRAEUS]).toEqual(route([1, 0], [1, 1]));
	});

	it('drops a whole loop when the tip meets its own line', () => {
		const tangled: Paths = [[], route([1, 0], [1, 1], [0, 1], [0, 2], [1, 2])];
		const touch = stepStroke(MINI, tangled, PIRAEUS, [1, 1]);
		expect(touch.result).toBe('retracted');
		expect(touch.paths[PIRAEUS]).toEqual(route([1, 0], [1, 1]));
	});

	it('cuts another route when dragged into it', () => {
		const meeting: Paths = [route([0, 0], [0, 1]), route([2, 0], [2, 1], [1, 1], [1, 2])];
		const into = stepStroke(MINI, meeting, SHANGHAI, [1, 1]);
		expect(into.result).toBe('cut');
		expect(into.paths[SHANGHAI]).toEqual(route([0, 0], [0, 1], [1, 1]));
		// The other route keeps the part before the cell and loses the rest
		expect(into.paths[PIRAEUS]).toEqual(route([2, 0], [2, 1]));
		expect(validate(MINI, into.paths).overlapping).toEqual([]);
	});

	it('cannot enter another pair port', () => {
		const { paths } = begin([0, 0]);
		const step = stepStroke(MINI, paths, SHANGHAI, [1, 0]);
		expect(step.result).toBe('blocked');
		expect(step.paths).toBe(paths);
	});

	it('connects on its own other port and then only retracts', () => {
		let paths = begin([0, 0]).paths;
		paths = stepStroke(MINI, paths, SHANGHAI, [0, 1]).paths;
		const done = stepStroke(MINI, paths, SHANGHAI, [0, 2]);
		expect(done.result).toBe('completed');
		expect(isConnected(MINI, done.paths, SHANGHAI)).toBe(true);
		expect(stepStroke(MINI, done.paths, SHANGHAI, [1, 2]).result).toBe('blocked');
		const back = stepStroke(MINI, done.paths, SHANGHAI, [0, 1]);
		expect(back.result).toBe('retracted');
		expect(isConnected(MINI, back.paths, SHANGHAI)).toBe(false);
	});

	it('draws a connected line even when the pointer skips cells', () => {
		const { paths, pair } = begin([1, 0]);
		const drag = dragStroke(MINI, paths, pair, [1, 2]);
		expect(drag.paths[PIRAEUS]).toEqual(route([1, 0], [1, 1], [1, 2]));
		expect(drag.results).toEqual(['moved', 'moved']);
		const around = dragStroke(MINI, drag.paths, pair, [2, 0]);
		expect(around.paths[PIRAEUS].at(-1)).toEqual([2, 0]);
		expect(isConnected(MINI, around.paths, PIRAEUS)).toBe(true);
	});

	it('stops dragging at a cell it cannot enter', () => {
		const { paths, pair } = begin([0, 0]);
		const drag = dragStroke(MINI, paths, pair, [2, 0]);
		expect(drag.results.at(-1)).toBe('blocked');
		expect(drag.paths[SHANGHAI].at(-1)).toEqual([0, 0]);
	});

	it('steps toward a target along the longer axis', () => {
		expect(stepToward([0, 0], [0, 3])).toEqual([0, 1]);
		expect(stepToward([0, 0], [3, 0])).toEqual([1, 0]);
		expect(stepToward([2, 2], [0, 1])).toEqual([1, 2]);
		expect(stepToward([2, 2], [3, 0])).toEqual([2, 1]);
	});

	it('draws the whole solution by strokes', () => {
		let paths = emptyPaths(MINI);
		solutionPaths(MINI).forEach((solution, index) => {
			const started = startStroke(MINI, paths, solution[0]);
			paths = started?.paths ?? paths;
			expect(started?.pair).toBe(index);
			for (const cell of solution.slice(1)) paths = dragStroke(MINI, paths, index, cell).paths;
		});
		expect(isSolved(MINI, paths)).toBe(true);
		expect(samePaths(paths, solutionPaths(MINI))).toBe(true);
	});

	it('compares paths', () => {
		expect(samePaths(emptyPaths(MINI), emptyPaths(MINI))).toBe(true);
		expect(samePaths(emptyPaths(MINI), solutionPaths(MINI))).toBe(false);
	});
});
