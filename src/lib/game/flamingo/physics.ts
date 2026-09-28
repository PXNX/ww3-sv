/*
 * Flight physics for Flamingo Flight (requirements Section 8). The constants are fixed, so gap
 * reachability can be proven in tests. Everything is in world units and seconds: the playing
 * field is WORLD_WIDTH by WORLD_HEIGHT units, and y grows downwards.
 */

export const STEP_SECONDS = 1 / 60;
export const WORLD_WIDTH = 360;
export const WORLD_HEIGHT = 640;
/** Top edge of the ground band */
export const GROUND_Y = 584;

export const GRAVITY = 1500;
/** A flap sets the vertical speed to this value (negative is upwards) */
export const FLAP_VELOCITY = -430;
export const MAX_FALL_SPEED = 620;
/** Horizontal flying speed; the world scrolls past at this rate */
export const SCROLL_SPEED = 150;
export const FLAMINGO_RADIUS = 13;
/** Where the flamingo sits horizontally on screen */
export const FLAMINGO_SCREEN_X = 84;

export interface Body {
	y: number;
	vy: number;
}

/** Advances the vertical motion by one step: a flap resets the speed, otherwise gravity pulls */
export function integrate(body: Body, flap: boolean, dt = STEP_SECONDS): Body {
	const vy = flap ? FLAP_VELOCITY : Math.min(body.vy + GRAVITY * dt, MAX_FALL_SPEED);
	return { y: body.y + vy * dt, vy };
}

export interface Rect {
	x: number;
	y: number;
	width: number;
	height: number;
}

export function circleHitsRect(cx: number, cy: number, radius: number, rect: Rect): boolean {
	const nearestX = Math.min(Math.max(cx, rect.x), rect.x + rect.width);
	const nearestY = Math.min(Math.max(cy, rect.y), rect.y + rect.height);
	const dx = cx - nearestX;
	const dy = cy - nearestY;
	return dx * dx + dy * dy < radius * radius;
}
