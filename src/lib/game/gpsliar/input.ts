/*
 * Steering input as pure functions. The keyboard steers in eight directions (arrows or WASD), a
 * finger or mouse steers toward the pointer: the farther from the boat, the harder it pushes, up to
 * full speed at a fixed distance.
 */
import type { Vec } from './lie.js';

const KEY_DIRECTIONS: Record<string, Vec> = {
	ArrowUp: { x: 0, y: -1 },
	KeyW: { x: 0, y: -1 },
	ArrowDown: { x: 0, y: 1 },
	KeyS: { x: 0, y: 1 },
	ArrowLeft: { x: -1, y: 0 },
	KeyA: { x: -1, y: 0 },
	ArrowRight: { x: 1, y: 0 },
	KeyD: { x: 1, y: 0 }
};

/** Whether a key code steers the boat */
export function isSteerKey(code: string): boolean {
	return code in KEY_DIRECTIONS;
}

/** The steering for the keys held down; opposite keys cancel out */
export function keyVector(held: ReadonlySet<string>): Vec {
	let x = 0;
	let y = 0;
	for (const code of held) {
		const direction = KEY_DIRECTIONS[code];
		if (!direction) continue;
		x += direction.x;
		y += direction.y;
	}
	const length = Math.hypot(x, y);
	return length > 1 ? { x: x / length, y: y / length } : { x, y };
}

/** Distance from the boat, in sea units, at which a pointer steers at full speed */
export const POINTER_FULL_AT = 1.6;
/** Closer than this the pointer does not steer at all, so a resting finger does not jitter the boat */
export const POINTER_DEAD_ZONE = 0.25;

/** The steering for a pointer at an offset (sea units) from the boat */
export function pointerVector(dx: number, dy: number): Vec {
	const distance = Math.hypot(dx, dy);
	if (distance < POINTER_DEAD_ZONE) return { x: 0, y: 0 };
	const power = Math.min(1, distance / POINTER_FULL_AT);
	return { x: (dx / distance) * power, y: (dy / distance) * power };
}
