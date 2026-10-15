import { describe, expect, it } from 'vitest';
import { isWaitKey, keyDirection, swipeDirection } from './input.js';

describe('maple input', () => {
	it('maps arrows and WASD to directions', () => {
		expect(keyDirection('ArrowUp')).toBe('up');
		expect(keyDirection('KeyA')).toBe('left');
		expect(keyDirection('KeyS')).toBe('down');
		expect(keyDirection('ArrowRight')).toBe('right');
		expect(keyDirection('KeyQ')).toBeNull();
	});

	it('waits on Space and the dot key', () => {
		expect(isWaitKey('Space')).toBe(true);
		expect(isWaitKey('Period')).toBe(true);
		expect(isWaitKey('Enter')).toBe(false);
	});

	it('turns a swipe into its dominant direction', () => {
		expect(swipeDirection(40, 10)).toBe('right');
		expect(swipeDirection(-40, 10)).toBe('left');
		expect(swipeDirection(5, 60)).toBe('down');
		expect(swipeDirection(5, -60)).toBe('up');
	});

	it('ignores taps and tiny drags', () => {
		expect(swipeDirection(0, 0)).toBeNull();
		expect(swipeDirection(10, -12)).toBeNull();
	});
});
