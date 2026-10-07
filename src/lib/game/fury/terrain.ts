/*
 * Hills for Magyar's Birds. A hill is a smooth bump in the ground with a flat top (so a fortress
 * can stand on it) and slopes that ease down to the flat ground on both sides. Hills never
 * overlap and never reach the slingshot. Pure functions, shared by the physics, the validator,
 * the level generator and the renderer.
 */

export interface LevelHill {
	/** Horizontal center */
	x: number;
	/** Total width including both slopes */
	w: number;
	/** Height of the flat top above the ground */
	h: number;
	/** Width of the flat top; the two slopes share the rest */
	flat: number;
}

export const MIN_HILL_HEIGHT = 0.3;
export const MAX_HILL_HEIGHT = 3;
export const MAX_HILLS = 5;
/** Distance between the sampled points of a sloped stretch of ground */
export const TERRAIN_STEP = 0.2;
/** The slingshot stands on level ground: hills keep this far to its right */
export const HILL_CLEARANCE_X = 4.5;

/** Ground height of one hill at x: flat top, smoothstep slopes down to zero */
function hillHeight(hill: LevelHill, x: number): number {
	const distance = Math.abs(x - hill.x);
	const topHalf = hill.flat / 2;
	const edgeHalf = hill.w / 2;
	if (distance <= topHalf) return hill.h;
	if (distance >= edgeHalf) return 0;
	const t = (edgeHalf - distance) / (edgeHalf - topHalf);
	return hill.h * t * t * (3 - 2 * t);
}

export function groundHeight(hills: readonly LevelHill[] | undefined, x: number): number {
	let height = 0;
	for (const hill of hills ?? []) height = Math.max(height, hillHeight(hill, x));
	return height;
}

/**
 * Highest ground under the span [left, right]. Every hill rises to its flat top and falls again,
 * so the highest point under a span is the top itself or one of the span's ends.
 */
export function groundMax(
	hills: readonly LevelHill[] | undefined,
	left: number,
	right: number
): number {
	let height = Math.max(groundHeight(hills, left), groundHeight(hills, right));
	for (const hill of hills ?? []) {
		const topLeft = hill.x - hill.flat / 2;
		const topRight = hill.x + hill.flat / 2;
		if (topRight >= left && topLeft <= right) height = Math.max(height, hill.h);
	}
	return height;
}

/** Points of the ground outline from fromX to toX, dense on the slopes and sparse elsewhere */
export function terrainPoints(
	hills: readonly LevelHill[] | undefined,
	fromX: number,
	toX: number
): { x: number; y: number }[] {
	const xs = new Set<number>([fromX, toX]);
	for (const hill of hills ?? []) {
		const start = hill.x - hill.w / 2;
		const end = hill.x + hill.w / 2;
		const count = Math.max(2, Math.ceil((end - start) / TERRAIN_STEP));
		for (let i = 0; i <= count; i++) xs.add(start + ((end - start) * i) / count);
		xs.add(hill.x - hill.flat / 2);
		xs.add(hill.x + hill.flat / 2);
	}
	return [...xs]
		.filter((x) => x >= fromX && x <= toX)
		.sort((a, b) => a - b)
		.map((x) => ({ x, y: groundHeight(hills, x) }));
}
