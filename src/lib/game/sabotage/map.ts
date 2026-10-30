/*
 * Tile maps for Gig Saboteur: parsing the ASCII levels, circle-against-tiles movement, line of
 * sight, ray casting for vision cones and a small path finder for guards that go and look.
 *
 * Legend: # wall, f fence (blocks walking, not sight), . grass, : paved, , shadow, b bush (hides the
 * player), D door (walkable, blocks sight), x crate (solid, blocks sight), T sabotage target (solid),
 * E exit, S player start (paved).
 */

export type Tile =
	'wall' | 'fence' | 'floor' | 'paved' | 'shadow' | 'bush' | 'door' | 'crate' | 'target' | 'exit';

export interface Vec {
	x: number;
	y: number;
}

export interface Grid {
	width: number;
	height: number;
	/** Row by row: index = y * width + x */
	tiles: Tile[];
}

export interface ParsedMap {
	grid: Grid;
	/** Tile centres */
	start: Vec;
	exit: Vec;
	targets: Vec[];
}

const LEGEND: Record<string, Tile> = {
	'#': 'wall',
	f: 'fence',
	'.': 'floor',
	':': 'paved',
	',': 'shadow',
	b: 'bush',
	D: 'door',
	x: 'crate',
	T: 'target',
	E: 'exit',
	S: 'paved'
};

export function parseMap(rows: readonly string[]): ParsedMap {
	if (rows.length === 0) throw new Error('Empty map');
	const width = rows[0].length;
	const tiles: Tile[] = [];
	const targets: Vec[] = [];
	let start: Vec | null = null;
	let exit: Vec | null = null;
	rows.forEach((row, y) => {
		if (row.length !== width)
			throw new Error(`Row ${y} has ${row.length} tiles, expected ${width}`);
		[...row].forEach((char, x) => {
			const tile = LEGEND[char];
			if (!tile) throw new Error(`Unknown tile "${char}" at ${x},${y}`);
			tiles.push(tile);
			const centre = { x: x + 0.5, y: y + 0.5 };
			if (char === 'S') {
				if (start) throw new Error('More than one start');
				start = centre;
			} else if (char === 'E') {
				if (exit) throw new Error('More than one exit');
				exit = centre;
			} else if (char === 'T') {
				targets.push(centre);
			}
		});
	});
	if (!start) throw new Error('No start');
	if (!exit) throw new Error('No exit');
	return { grid: { width, height: rows.length, tiles }, start, exit, targets };
}

export function tileAt(grid: Grid, tx: number, ty: number): Tile {
	if (tx < 0 || ty < 0 || tx >= grid.width || ty >= grid.height) return 'wall';
	return grid.tiles[ty * grid.width + tx];
}

export const tileUnder = (grid: Grid, pos: Vec): Tile =>
	tileAt(grid, Math.floor(pos.x), Math.floor(pos.y));

/** Blocks walking */
export const isSolid = (tile: Tile): boolean =>
	tile === 'wall' || tile === 'fence' || tile === 'crate' || tile === 'target';

/** Blocks sight (doors are walkable but opaque) */
export const isOpaque = (tile: Tile): boolean =>
	tile === 'wall' || tile === 'crate' || tile === 'door';

export const isWalkable = (tile: Tile): boolean => !isSolid(tile);

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Longest stretch moved in one go: anything longer is split so a circle cannot jump over a wall */
const MAX_MOVE = 0.2;

/** Moves a circle by (dx, dy), pushing it out of solid tiles so it slides along walls */
export function moveCircle(grid: Grid, pos: Vec, dx: number, dy: number, radius: number): Vec {
	const pieces = Math.max(1, Math.ceil(Math.hypot(dx, dy) / MAX_MOVE));
	let at = pos;
	for (let piece = 0; piece < pieces; piece++) {
		at = moveCirclePiece(grid, at, dx / pieces, dy / pieces, radius);
	}
	return at;
}

function moveCirclePiece(grid: Grid, pos: Vec, dx: number, dy: number, radius: number): Vec {
	let x = pos.x + dx;
	let y = pos.y + dy;
	for (let pass = 0; pass < 3; pass++) {
		let moved = false;
		const x0 = Math.floor(x - radius);
		const x1 = Math.floor(x + radius);
		const y0 = Math.floor(y - radius);
		const y1 = Math.floor(y + radius);
		for (let ty = y0; ty <= y1; ty++) {
			for (let tx = x0; tx <= x1; tx++) {
				if (!isSolid(tileAt(grid, tx, ty))) continue;
				const nearX = clamp(x, tx, tx + 1);
				const nearY = clamp(y, ty, ty + 1);
				const offX = x - nearX;
				const offY = y - nearY;
				const dist2 = offX * offX + offY * offY;
				if (dist2 >= radius * radius) continue;
				if (dist2 > 1e-9) {
					const dist = Math.sqrt(dist2);
					x += (offX / dist) * (radius - dist);
					y += (offY / dist) * (radius - dist);
				} else {
					// The centre is inside the tile: leave by the nearest side
					const left = x - tx;
					const right = tx + 1 - x;
					const top = y - ty;
					const bottom = ty + 1 - y;
					const least = Math.min(left, right, top, bottom);
					if (least === left) x = tx - radius;
					else if (least === right) x = tx + 1 + radius;
					else if (least === top) y = ty - radius;
					else y = ty + 1 + radius;
				}
				moved = true;
			}
		}
		if (!moved) break;
	}
	return { x, y };
}

const RAY_STEP = 0.08;

/**
 * Distance a ray travels from `from` before an opaque tile stops it (up to maxDist). The tile the
 * ray starts in is ignored, so a camera mounted on a wall looks out of it; every other opaque tile
 * stops it, so a ray aimed along or into the wall ends at once. A ray that enters `endTile` counts as
 * arrived: someone standing in a doorway can be seen.
 */
function march(
	grid: Grid,
	from: Vec,
	angle: number,
	maxDist: number,
	endTile?: { tx: number; ty: number }
): number {
	const cos = Math.cos(angle);
	const sin = Math.sin(angle);
	const startX = Math.floor(from.x);
	const startY = Math.floor(from.y);
	for (let d = 0; d <= maxDist; d += RAY_STEP) {
		const tx = Math.floor(from.x + cos * d);
		const ty = Math.floor(from.y + sin * d);
		if (!isOpaque(tileAt(grid, tx, ty)) || (tx === startX && ty === startY)) continue;
		if (endTile && tx === endTile.tx && ty === endTile.ty) return maxDist;
		return d;
	}
	return maxDist;
}

export function castRay(grid: Grid, from: Vec, angle: number, maxDist: number): number {
	return march(grid, from, angle, maxDist);
}

export function hasLineOfSight(grid: Grid, from: Vec, to: Vec): boolean {
	const dist = Math.hypot(to.x - from.x, to.y - from.y);
	if (dist < 1e-6) return true;
	const angle = Math.atan2(to.y - from.y, to.x - from.x);
	const end = { tx: Math.floor(to.x), ty: Math.floor(to.y) };
	return march(grid, from, angle, dist, end) >= dist;
}

/** Whether a body of about 0.5 tiles wide can walk the straight line without touching a solid tile */
export function walkClear(grid: Grid, from: Vec, to: Vec): boolean {
	const dist = Math.hypot(to.x - from.x, to.y - from.y);
	const ux = dist > 0 ? (to.x - from.x) / dist : 0;
	const uy = dist > 0 ? (to.y - from.y) / dist : 0;
	for (let d = 0; d <= dist; d += 0.15) {
		for (const side of [-0.25, 0, 0.25]) {
			const x = from.x + ux * d - uy * side;
			const y = from.y + uy * d + ux * side;
			if (isSolid(tileAt(grid, Math.floor(x), Math.floor(y)))) return false;
		}
	}
	return true;
}

const NEIGHBOURS = [
	[1, 0],
	[-1, 0],
	[0, 1],
	[0, -1],
	[1, 1],
	[1, -1],
	[-1, 1],
	[-1, -1]
] as const;

/** Shortest walk between two points as tile centres (the start tile left out); null when walled off */
export function findPath(grid: Grid, from: Vec, to: Vec): Vec[] | null {
	const sx = Math.floor(from.x);
	const sy = Math.floor(from.y);
	const gx = Math.floor(to.x);
	const gy = Math.floor(to.y);
	if (!isWalkable(tileAt(grid, gx, gy))) return null;
	if (sx === gx && sy === gy) return [];
	const index = (x: number, y: number) => y * grid.width + x;
	const previous = new Map<number, number>();
	previous.set(index(sx, sy), -1);
	const queue: number[] = [index(sx, sy)];
	for (let head = 0; head < queue.length; head++) {
		const current = queue[head];
		const cx = current % grid.width;
		const cy = Math.floor(current / grid.width);
		if (cx === gx && cy === gy) break;
		for (const [dx, dy] of NEIGHBOURS) {
			const nx = cx + dx;
			const ny = cy + dy;
			if (!isWalkable(tileAt(grid, nx, ny)) || previous.has(index(nx, ny))) continue;
			// No cutting corners past a solid tile
			if (dx !== 0 && dy !== 0) {
				if (!isWalkable(tileAt(grid, cx + dx, cy)) || !isWalkable(tileAt(grid, cx, cy + dy)))
					continue;
			}
			previous.set(index(nx, ny), current);
			queue.push(index(nx, ny));
		}
	}
	if (!previous.has(index(gx, gy))) return null;
	const path: Vec[] = [];
	for (let at = index(gx, gy); at !== index(sx, sy); at = previous.get(at)!) {
		path.push({ x: (at % grid.width) + 0.5, y: Math.floor(at / grid.width) + 0.5 });
	}
	return path.reverse();
}

/** Every walkable tile reachable from the point, by four-way steps (used to check levels) */
export function reachableTiles(grid: Grid, from: Vec): Set<number> {
	const seen = new Set<number>();
	const start = Math.floor(from.y) * grid.width + Math.floor(from.x);
	const stack = [start];
	seen.add(start);
	while (stack.length > 0) {
		const current = stack.pop()!;
		const cx = current % grid.width;
		const cy = Math.floor(current / grid.width);
		for (const [dx, dy] of NEIGHBOURS.slice(0, 4)) {
			const nx = cx + dx;
			const ny = cy + dy;
			const at = ny * grid.width + nx;
			if (!isWalkable(tileAt(grid, nx, ny)) || seen.has(at)) continue;
			seen.add(at);
			stack.push(at);
		}
	}
	return seen;
}

/** Shortest signed difference between two angles, in (-PI, PI] */
export function angleDiff(a: number, b: number): number {
	let diff = (a - b) % (Math.PI * 2);
	if (diff > Math.PI) diff -= Math.PI * 2;
	if (diff <= -Math.PI) diff += Math.PI * 2;
	return diff;
}
