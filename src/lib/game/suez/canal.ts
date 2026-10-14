/*
 * The canal: a grid of bank tiles with an open channel down the middle, plus the bank collision
 * for the ship. A hull point inside a bank tile is pushed out through the nearest open water, in
 * one of the four axis directions, which also copes with banks the excavator has chewed holes in.
 */
import { worldSamples, type Body, type Point } from './body';
import { COLS, ROWS, TILE } from './config';
import type { Random } from '../random';

export interface Canal {
	cols: number;
	rows: number;
	/** 1 for a bank tile, 0 for open water, row by row */
	solid: Uint8Array;
}

export interface Contact {
	/** The hull point that is inside a bank */
	point: Point;
	/** Unit direction that pushes it out by the shortest way */
	normal: Point;
	/** How far inside it is, measured along that direction */
	depth: number;
}

const MAX_SCAN = COLS;

export function createCanal(widthTiles: number, random?: Random, bankBump = 2): Canal {
	const width = Math.max(1, Math.min(COLS - 2, Math.floor(widthTiles)));
	const left = Math.floor((COLS - width) / 2);
	const solid = new Uint8Array(COLS * ROWS);
	// Banks creep into the channel here and there, but a straight ship always still fits
	const maxInset = random ? Math.max(0, Math.min(bankBump, Math.floor((width - 3) / 2))) : 0;
	let leftInset = 0;
	let rightInset = 0;
	for (let row = 0; row < ROWS; row++) {
		const calm = row < 3 || row >= ROWS - 6;
		if (random && !calm && maxInset > 0) {
			leftInset = wander(leftInset, maxInset, random);
			rightInset = wander(rightInset, maxInset, random);
			if (width - leftInset - rightInset < 3) rightInset = Math.max(0, width - 3 - leftInset);
		} else {
			leftInset = 0;
			rightInset = 0;
		}
		for (let col = 0; col < COLS; col++) {
			const open = col >= left + leftInset && col < left + width - rightInset;
			solid[row * COLS + col] = open ? 0 : 1;
		}
	}
	return { cols: COLS, rows: ROWS, solid };
}

function wander(value: number, max: number, random: Random): number {
	const roll = random();
	const next = roll < 0.2 ? value - 1 : roll > 0.8 ? value + 1 : value;
	return Math.max(0, Math.min(max, next));
}

/** x of the middle of the channel in the straight part of the canal */
export function canalCenterX(widthTiles: number): number {
	const width = Math.max(1, Math.min(COLS - 2, Math.floor(widthTiles)));
	const left = Math.floor((COLS - width) / 2);
	return (left + width / 2) * TILE;
}

/** Banks beyond the sides of the world are solid; above and below the strip is open water */
export function isSolidTile(canal: Canal, col: number, row: number): boolean {
	if (col < 0 || col >= canal.cols) return true;
	if (row < 0 || row >= canal.rows) return false;
	return canal.solid[row * canal.cols + col] === 1;
}

export function tileAt(point: Point): { col: number; row: number } {
	return { col: Math.floor(point.x / TILE), row: Math.floor(point.y / TILE) };
}

export function isSolidAt(canal: Canal, point: Point): boolean {
	const { col, row } = tileAt(point);
	return isSolidTile(canal, col, row);
}

/** The outermost columns are bedrock: the excavator cannot dig them */
export function isDiggable(canal: Canal, col: number, row: number): boolean {
	return col > 0 && col < canal.cols - 1 && isSolidTile(canal, col, row) && row >= 0;
}

/**
 * The excavator's bucket: clears the tapped tile and its four neighbours (bedrock stays).
 * Returns the tiles that were removed.
 */
export function digTiles(canal: Canal, col: number, row: number): { col: number; row: number }[] {
	const removed: { col: number; row: number }[] = [];
	if (!isDiggable(canal, col, row)) return removed;
	const spots = [
		[col, row],
		[col - 1, row],
		[col + 1, row],
		[col, row - 1],
		[col, row + 1]
	];
	for (const [c, r] of spots) {
		if (
			c > 0 &&
			c < canal.cols - 1 &&
			r >= 0 &&
			r < canal.rows &&
			canal.solid[r * canal.cols + c]
		) {
			canal.solid[r * canal.cols + c] = 0;
			removed.push({ col: c, row: r });
		}
	}
	return removed;
}

/** The shortest way out of the bank for a point that is inside a bank tile */
function exitOf(canal: Canal, point: Point): { normal: Point; depth: number } {
	const { col, row } = tileAt(point);
	let best = { normal: { x: 1, y: 0 }, depth: Infinity };
	const consider = (nx: number, ny: number, depth: number) => {
		if (depth < best.depth) best = { normal: { x: nx, y: ny }, depth };
	};
	for (let step = 1; step <= MAX_SCAN; step++) {
		if (!isSolidTile(canal, col + step, row)) {
			consider(1, 0, (col + step) * TILE - point.x);
			break;
		}
	}
	for (let step = 1; step <= MAX_SCAN; step++) {
		if (!isSolidTile(canal, col - step, row)) {
			consider(-1, 0, point.x - (col - step + 1) * TILE);
			break;
		}
	}
	for (let step = 1; step <= MAX_SCAN; step++) {
		if (!isSolidTile(canal, col, row + step)) {
			consider(0, 1, (row + step) * TILE - point.y);
			break;
		}
	}
	for (let step = 1; step <= MAX_SCAN; step++) {
		if (!isSolidTile(canal, col, row - step)) {
			consider(0, -1, point.y - (row - step + 1) * TILE);
			break;
		}
	}
	return best;
}

/** Every hull sample that is inside a bank, with the way out */
export function contactsFor(canal: Canal, body: Body): Contact[] {
	const contacts: Contact[] = [];
	for (const point of worldSamples(body)) {
		if (!isSolidAt(canal, point)) continue;
		const { normal, depth } = exitOf(canal, point);
		if (Number.isFinite(depth)) contacts.push({ point, normal, depth });
	}
	return contacts;
}

/** How deep the hull is in the banks: the deepest point, 0 when it floats clear */
export function maxDepth(canal: Canal, body: Body): number {
	let deepest = 0;
	for (const contact of contactsFor(canal, body)) deepest = Math.max(deepest, contact.depth);
	return deepest;
}
