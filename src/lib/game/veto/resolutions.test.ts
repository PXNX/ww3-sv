import { describe, expect, it } from 'vitest';
import { createRandom } from '../random.js';
import { RECENT_MEMORY } from './config.js';
import {
	RESOLUTION_COUNT,
	formatDraftNumber,
	generateResolution,
	resolutionKey
} from './resolutions.js';

describe('resolution generator', () => {
	it('has more than thirty draft texts', () => {
		expect(RESOLUTION_COUNT).toBeGreaterThanOrEqual(30);
	});

	it('names the message of every draft with a two-digit number', () => {
		expect(resolutionKey(0)).toBe('veto_res_01');
		expect(resolutionKey(RESOLUTION_COUNT - 1)).toBe(`veto_res_${RESOLUTION_COUNT}`);
	});

	it('is deterministic for a seed', () => {
		const a = createRandom(21);
		const b = createRandom(21);
		for (let i = 0; i < 30; i++) expect(generateResolution(a)).toEqual(generateResolution(b));
	});

	it('picks valid drafts with four-digit numbers', () => {
		const random = createRandom(4);
		for (let i = 0; i < 300; i++) {
			const { index, number } = generateResolution(random);
			expect(Number.isInteger(index)).toBe(true);
			expect(index).toBeGreaterThanOrEqual(0);
			expect(index).toBeLessThan(RESOLUTION_COUNT);
			expect(number).toBeGreaterThanOrEqual(1000);
			expect(number).toBeLessThanOrEqual(9999);
		}
	});

	it('never repeats a draft within the memory window', () => {
		const random = createRandom(8);
		const recent: number[] = [];
		for (let i = 0; i < 500; i++) {
			const { index } = generateResolution(random, recent);
			expect(recent.slice(-RECENT_MEMORY)).not.toContain(index);
			recent.push(index);
		}
	});

	it('reaches every draft over a long game', () => {
		const random = createRandom(2);
		const recent: number[] = [];
		const seen = new Set<number>();
		for (let i = 0; i < 2000; i++) {
			const { index } = generateResolution(random, recent);
			seen.add(index);
			recent.push(index);
		}
		expect(seen.size).toBe(RESOLUTION_COUNT);
	});

	it('still picks something when every draft was shown recently', () => {
		const everything = Array.from({ length: RESOLUTION_COUNT * 2 }, (_, i) => i % RESOLUTION_COUNT);
		const { index } = generateResolution(createRandom(1), everything);
		expect(index).toBeGreaterThanOrEqual(0);
		expect(index).toBeLessThan(RESOLUTION_COUNT);
	});

	it('prints the draft number like a council document', () => {
		expect(formatDraftNumber(4821)).toBe('S/RES/4821');
	});
});
