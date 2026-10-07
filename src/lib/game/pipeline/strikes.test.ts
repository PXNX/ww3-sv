import { describe, expect, it } from 'vitest';
import { createRandom } from '#lib/game/random.js';
import { computeFlow } from './pipeGrid';
import {
	pickStrikeKind,
	pickTargets,
	strikeInterval,
	waveSize,
	type StrikeConfig
} from './strikes';
import { gridFrom } from './testGrid';

const CONFIG: StrikeConfig = {
	firstDelayMs: 5000,
	startIntervalMs: 8000,
	minIntervalMs: 2000,
	rampMs: 60_000,
	warningMs: 2000,
	maxSimultaneous: 3,
	extraStrikeEveryMs: 30_000
};

const SNAKE = ['s0 s1 s1', 'e0 s1 e2', 's1 s1 s0'];

describe('strike schedule', () => {
	it('shortens the interval gradually down to the minimum', () => {
		expect(strikeInterval(CONFIG, 0)).toBe(8000);
		expect(strikeInterval(CONFIG, 30_000)).toBe(5000);
		expect(strikeInterval(CONFIG, 60_000)).toBe(2000);
		expect(strikeInterval(CONFIG, 600_000)).toBe(2000);
		expect(strikeInterval(CONFIG, -100)).toBe(8000);
		let previous = Infinity;
		for (let t = 0; t <= 90_000; t += 1000) {
			const interval = strikeInterval(CONFIG, t);
			expect(interval).toBeLessThanOrEqual(previous);
			previous = interval;
		}
	});

	it('grows the number of simultaneous strikes up to the cap', () => {
		expect(waveSize(CONFIG, 0)).toBe(1);
		expect(waveSize(CONFIG, 29_999)).toBe(1);
		expect(waveSize(CONFIG, 30_000)).toBe(2);
		expect(waveSize(CONFIG, 60_000)).toBe(3);
		expect(waveSize(CONFIG, 10_000_000)).toBe(3);
	});
});

describe('strike targeting', () => {
	it('picks distinct tiles and never broken or already targeted ones', () => {
		const grid = gridFrom(['s0 s1! s1', 'e0 s1 e2', 's1 s1! s0'], 0, 2);
		const flow = computeFlow(grid);
		const random = createRandom(3);
		for (let i = 0; i < 200; i++) {
			const targets = pickTargets(random, grid, flow, 4, new Set([0, 5]));
			expect(new Set(targets).size).toBe(targets.length);
			expect(targets).toHaveLength(4);
			for (const cell of targets) expect([1, 7, 0, 5]).not.toContain(cell);
		}
	});

	it('returns fewer targets when there are not enough candidates', () => {
		const grid = gridFrom(['s0! s1!', 's1 s0!'], 0, 0);
		expect(pickTargets(createRandom(1), grid, computeFlow(grid), 3, new Set())).toEqual([2]);
		expect(pickTargets(createRandom(1), grid, computeFlow(grid), 3, new Set([2]))).toEqual([]);
	});

	it('prefers tiles that carry oil', () => {
		const grid = gridFrom(SNAKE, 0, 2);
		const flow = computeFlow(grid);
		const random = createRandom(11);
		let flowing = 0;
		const rounds = 3000;
		for (let i = 0; i < rounds; i++) {
			const [cell] = pickTargets(random, grid, flow, 1, new Set());
			if (flow.filled[cell]) flowing++;
		}
		// Five flowing tiles at weight four against four dry tiles at weight one: about 83 percent
		expect(flowing / rounds).toBeGreaterThan(0.75);
		expect(flowing / rounds).toBeLessThan(0.9);
	});

	it('is deterministic for a seed', () => {
		const grid = gridFrom(SNAKE, 0, 2);
		const flow = computeFlow(grid);
		const a = pickTargets(createRandom(5), grid, flow, 3, new Set());
		expect(pickTargets(createRandom(5), grid, flow, 3, new Set())).toEqual(a);
	});

	it('sends both drones and rockets', () => {
		const random = createRandom(8);
		const kinds = new Set(Array.from({ length: 100 }, () => pickStrikeKind(random)));
		expect([...kinds].sort()).toEqual(['drone', 'rocket']);
	});
});
