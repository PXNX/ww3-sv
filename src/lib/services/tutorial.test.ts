import { describe, expect, it } from 'vitest';
import { tutorialTapHits } from './tutorial.js';

const spot = { left: 100, top: 100, right: 200, bottom: 160 };

describe('tutorialTapHits', () => {
	it('counts a tap on the highlighted control', () => {
		expect(tutorialTapHits({ x: 0, y: 0 }, true, spot)).toBe(true);
	});

	it('counts a tap inside the spotlight even when a Start overlay took the event', () => {
		expect(tutorialTapHits({ x: 150, y: 130 }, false, spot)).toBe(true);
	});

	it('ignores taps outside the spotlight', () => {
		expect(tutorialTapHits({ x: 20, y: 20 }, false, spot)).toBe(false);
	});

	it('counts a tap on the visible 6px spotlight border', () => {
		expect(tutorialTapHits({ x: 96, y: 130 }, false, spot)).toBe(true);
	});

	it('ignores taps on the edges when there is no spotlight to measure', () => {
		expect(tutorialTapHits({ x: 150, y: 130 }, false, null)).toBe(false);
	});
});
