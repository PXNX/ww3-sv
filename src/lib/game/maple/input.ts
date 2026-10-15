/*
 * Controls: arrow keys and WASD step the cart, Space (or the dot key) waits a tick, and a swipe
 * on the warehouse floor steps toward its dominant direction.
 */
import type { Dir } from './level.js';

const KEY_DIRECTIONS: Record<string, Dir> = {
	ArrowUp: 'up',
	KeyW: 'up',
	ArrowDown: 'down',
	KeyS: 'down',
	ArrowLeft: 'left',
	KeyA: 'left',
	ArrowRight: 'right',
	KeyD: 'right'
};

export function keyDirection(code: string): Dir | null {
	return KEY_DIRECTIONS[code] ?? null;
}

export function isWaitKey(code: string): boolean {
	return code === 'Space' || code === 'Period';
}

/** Shorter drags than this many pixels are taps, not swipes */
export const SWIPE_MIN_PX = 24;

/** The direction of a swipe, null when the finger barely moved */
export function swipeDirection(dx: number, dy: number, minimum = SWIPE_MIN_PX): Dir | null {
	if (Math.max(Math.abs(dx), Math.abs(dy)) < minimum) return null;
	if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? 'right' : 'left';
	return dy > 0 ? 'down' : 'up';
}
