import { describe, expect, it } from 'vitest';
import { SWIPE_PX, TAP_SPLIT, createGesture, swipeCommand, tapCommand } from './input';

describe('swipeCommand', () => {
	it('stays quiet for a wobble smaller than the threshold', () => {
		expect(swipeCommand(SWIPE_PX - 1, 0)).toBeNull();
		expect(swipeCommand(5, -10)).toBeNull();
	});

	it('maps the dominant direction to a command', () => {
		expect(swipeCommand(-40, 5)).toBe('left');
		expect(swipeCommand(40, -5)).toBe('right');
		expect(swipeCommand(4, -40)).toBe('jump');
		expect(swipeCommand(-4, 40)).toBe('duck');
	});

	it('lets a sideways swipe win a tie, so a lane change never turns into a jump', () => {
		expect(swipeCommand(30, -30)).toBe('right');
	});
});

describe('tapCommand', () => {
	it('jumps above the runner and ducks at its height or below', () => {
		expect(tapCommand(0.1)).toBe('jump');
		expect(tapCommand(TAP_SPLIT - 0.01)).toBe('jump');
		expect(tapCommand(TAP_SPLIT)).toBe('duck');
		expect(tapCommand(0.95)).toBe('duck');
	});
});

describe('createGesture', () => {
	it('fires a swipe as soon as it is long enough, and only once', () => {
		const gesture = createGesture();
		expect(gesture.move(10, 0)).toBeNull();
		expect(gesture.move(SWIPE_PX, 2)).toBe('right');
		expect(gesture.move(90, 4)).toBeNull();
		expect(gesture.release(120, 4, 0.5)).toBeNull();
	});

	it('turns a press that never moved into a tap', () => {
		const gesture = createGesture();
		expect(gesture.move(2, 1)).toBeNull();
		expect(gesture.release(2, 1, 0.3)).toBe('jump');
		const low = createGesture();
		expect(low.release(0, 0, 0.9)).toBe('duck');
	});

	it('still reads a quick flick that ended before any move event', () => {
		const gesture = createGesture();
		expect(gesture.release(-60, 3, 0.9)).toBe('left');
	});
});
