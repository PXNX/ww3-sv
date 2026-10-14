import { describe, expect, it } from 'vitest';
import { MAX_FINGERS } from './config.js';
import { pluggingIds, pressHold, releaseHold } from './fingers.js';

describe('fingers', () => {
	it('keeps holds in the order they started and ignores a repeated press', () => {
		let held: number[] = [];
		held = pressHold(held, 4);
		held = pressHold(held, 2);
		held = pressHold(held, 4);
		expect(held).toEqual([4, 2]);
	});

	it('releases one hold and ignores unknown ones', () => {
		expect(releaseHold([1, 2, 3], 2)).toEqual([1, 3]);
		expect(releaseHold([1, 2, 3], 9)).toEqual([1, 2, 3]);
	});

	it('lets only the first three holds plug', () => {
		expect(MAX_FINGERS).toBe(3);
		expect(pluggingIds([1, 2, 3, 4])).toEqual([1, 2, 3]);
		expect(pluggingIds([1, 2])).toEqual([1, 2]);
	});

	it('hands the plug to the fourth finger when one lifts', () => {
		const held = releaseHold([1, 2, 3, 4], 2);
		expect(pluggingIds(held)).toEqual([1, 3, 4]);
	});

	it('does not change the list it is given', () => {
		const held = [1];
		pressHold(held, 2);
		expect(held).toEqual([1]);
	});
});
