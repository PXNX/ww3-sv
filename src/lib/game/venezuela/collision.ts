/*
 * Axis-separated AABB movement against the tile grid, shared by the player and the walking goons.
 * Solid tiles block from every side; catwalks ("one-way" tiles) only block a body that comes down
 * onto them from above, and so do the moving floors (hover barges) passed in separately.
 */
import { tileAt, type LevelData } from './level';

export interface Box {
	/** Top-left corner in tiles */
	x: number;
	y: number;
	w: number;
	h: number;
}

export interface Body extends Box {
	vx: number;
	vy: number;
}

export interface MoveResult {
	/** Blocked by a wall while moving sideways */
	hitWall: boolean;
	/** Landed on something this step */
	landed: boolean;
	/** Hit a ceiling this step */
	bumped: boolean;
}

/** Keeps a resting body a hair off the tile it touches, so contact does not flicker */
const SKIN = 1e-4;
/** How far below a catwalk's top the feet may start for it to still catch a falling body */
const ONE_WAY_TOLERANCE = 0.06;
/** The same for a moving floor (a hover barge), which may rise into the falling body a little */
const FLOOR_TOLERANCE = 0.15;

/** Moves a body by its own velocity for dt seconds, resolving collisions, X first and then Y */
export function moveBody(
	level: LevelData,
	body: Body,
	dt: number,
	floors: readonly Box[] = []
): MoveResult {
	const result: MoveResult = { hitWall: false, landed: false, bumped: false };

	// Sideways
	const dx = body.vx * dt;
	body.x += dx;
	if (dx !== 0) {
		const top = Math.floor(body.y + SKIN);
		const bottom = Math.floor(body.y + body.h - SKIN);
		const column = dx > 0 ? Math.floor(body.x + body.w) : Math.floor(body.x);
		for (let row = top; row <= bottom; row++) {
			if (tileAt(level, column, row) === 'solid') {
				body.x = dx > 0 ? column - body.w - SKIN : column + 1 + SKIN;
				body.vx = 0;
				result.hitWall = true;
				break;
			}
		}
	}

	// Up and down
	const previousBottom = body.y + body.h;
	const dy = body.vy * dt;
	body.y += dy;
	if (dy !== 0) {
		const left = Math.floor(body.x + SKIN);
		const right = Math.floor(body.x + body.w - SKIN);
		if (dy > 0) {
			const row = Math.floor(body.y + body.h);
			for (let column = left; column <= right; column++) {
				const kind = tileAt(level, column, row);
				if (kind === 'solid' || (kind === 'oneway' && previousBottom <= row + ONE_WAY_TOLERANCE)) {
					body.y = row - body.h - SKIN;
					body.vy = 0;
					result.landed = true;
					break;
				}
			}
			if (!result.landed) {
				for (const floor of floors) {
					if (body.x + body.w <= floor.x + SKIN || body.x >= floor.x + floor.w - SKIN) continue;
					if (previousBottom > floor.y + FLOOR_TOLERANCE || body.y + body.h < floor.y) continue;
					body.y = floor.y - body.h - SKIN;
					body.vy = 0;
					result.landed = true;
					break;
				}
			}
		} else {
			const row = Math.floor(body.y);
			for (let column = left; column <= right; column++) {
				if (tileAt(level, column, row) === 'solid') {
					body.y = row + 1 + SKIN;
					body.vy = 0;
					result.bumped = true;
					break;
				}
			}
		}
	}
	return result;
}

/** Whether two boxes overlap (touching edges do not count) */
export function overlaps(a: Box, b: Box): boolean {
	return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** Whether something solid (or a catwalk) is right under a body's feet */
export function standingOn(level: LevelData, body: Box): boolean {
	const row = Math.floor(body.y + body.h + 0.01);
	const left = Math.floor(body.x + SKIN);
	const right = Math.floor(body.x + body.w - SKIN);
	for (let column = left; column <= right; column++) {
		const kind = tileAt(level, column, row);
		if (kind === 'solid' || kind === 'oneway') return true;
	}
	return false;
}
