import { describe, expect, it } from 'vitest';
import { createBody } from './body';
import {
	canalCenterX,
	contactsFor,
	createCanal,
	digTiles,
	isDiggable,
	isSolidAt,
	isSolidTile,
	maxDepth,
	tileAt
} from './canal';
import { COLS, ROWS, SHIP_LENGTH, TILE } from './config';
import { createRandom } from '../random';
import { resolveBanks } from './physics';

describe('canal grid', () => {
	it('opens a channel of the requested width in the middle', () => {
		const canal = createCanal(6);
		const openInRow = (row: number) =>
			Array.from({ length: COLS }, (_, col) =>
				isSolidTile(canal, col, row) ? 0 : 1
			).reduce<number>((a, b) => a + b, 0);
		for (const row of [0, 10, ROWS - 1]) expect(openInRow(row)).toBe(6);
		expect(isSolidTile(canal, 0, 5)).toBe(true);
		expect(isSolidTile(canal, COLS / 2, 5)).toBe(false);
	});

	it('centres the channel', () => {
		expect(canalCenterX(8)).toBe(180);
		expect(canalCenterX(7)).toBe(170);
		expect(canalCenterX(3)).toBe(170);
	});

	it('treats the world sides as solid and the ends of the strip as open', () => {
		const canal = createCanal(6);
		expect(isSolidTile(canal, -1, 5)).toBe(true);
		expect(isSolidTile(canal, COLS, 5)).toBe(true);
		expect(isSolidTile(canal, 0, -1)).toBe(false);
		expect(isSolidTile(canal, 0, ROWS)).toBe(false);
	});

	it('never lets bumps close the channel below three tiles, and a straight ship always fits', () => {
		for (let seed = 1; seed < 30; seed++) {
			for (const width of [3, 4, 5, 6, 7, 8]) {
				const canal = createCanal(width, createRandom(seed));
				const shared = new Set<number>();
				for (let col = 0; col < COLS; col++) shared.add(col);
				for (let row = 0; row < ROWS; row++) {
					let open = 0;
					for (let col = 0; col < COLS; col++) {
						if (isSolidTile(canal, col, row)) shared.delete(col);
						else open++;
					}
					expect(open).toBeGreaterThanOrEqual(3);
					expect(open).toBeLessThanOrEqual(width);
				}
				// Rows of one column that is open all the way down: three such tiles beside each other
				expect(shared.size).toBeGreaterThanOrEqual(3);
			}
		}
	});

	it('keeps the first and last rows clean', () => {
		const canal = createCanal(8, createRandom(5));
		for (const row of [0, 1, 2, ROWS - 1]) {
			expect(isSolidTile(canal, 4, row)).toBe(true);
			expect(isSolidTile(canal, 9, row)).toBe(false);
		}
	});

	it('maps points to tiles', () => {
		expect(tileAt({ x: 39.9, y: 40 })).toEqual({ col: 1, row: 2 });
		const canal = createCanal(6);
		expect(isSolidAt(canal, { x: 10, y: 100 })).toBe(true);
		expect(isSolidAt(canal, { x: 180, y: 100 })).toBe(false);
	});
});

describe('digging', () => {
	it('clears the tapped tile and its four neighbours', () => {
		const canal = createCanal(6);
		const removed = digTiles(canal, 4, 10);
		expect(removed).toHaveLength(5);
		for (const { col, row } of removed) expect(isSolidTile(canal, col, row)).toBe(false);
		expect(isSolidTile(canal, 3, 9)).toBe(true);
	});

	it('does nothing on open water and cannot dig the bedrock columns', () => {
		const canal = createCanal(6);
		expect(digTiles(canal, 9, 10)).toEqual([]);
		expect(isDiggable(canal, 0, 10)).toBe(false);
		expect(isDiggable(canal, COLS - 1, 10)).toBe(false);
		expect(digTiles(canal, 0, 10)).toEqual([]);
		// A dig next to the bedrock leaves the bedrock column alone
		const removed = digTiles(canal, 1, 10);
		expect(removed.some((tile) => tile.col === 0)).toBe(false);
		expect(isSolidTile(canal, 0, 10)).toBe(true);
	});
});

describe('bank collision', () => {
	it('finds no contact for a ship floating in the middle', () => {
		const canal = createCanal(8);
		const body = createBody(180, 250, -Math.PI / 2);
		expect(contactsFor(canal, body)).toEqual([]);
		expect(maxDepth(canal, body)).toBe(0);
	});

	it('measures how deep a ship across the canal is dug into the banks', () => {
		const canal = createCanal(6);
		const body = createBody(180, 250, 0);
		const expected = (SHIP_LENGTH - 6 * TILE) / 2;
		expect(maxDepth(canal, body)).toBeCloseTo(expected, 3);
		const contacts = contactsFor(canal, body);
		expect(contacts.length).toBeGreaterThan(0);
		// Left end is pushed east, right end west
		expect(contacts.some((c) => c.normal.x === 1)).toBe(true);
		expect(contacts.some((c) => c.normal.x === -1)).toBe(true);
	});

	it('pushes the hull out of the bank where it was allowed no depth', () => {
		const canal = createCanal(6);
		const body = createBody(150, 250, -Math.PI / 2);
		// Vertical but shoved into the west bank
		body.x = 130;
		expect(maxDepth(canal, body)).toBeGreaterThan(0);
		resolveBanks(canal, body, 0);
		expect(maxDepth(canal, body)).toBeLessThan(0.05);
		expect(body.x).toBeGreaterThan(130);
	});

	it('lets a hull keep the depth it is allowed and no more', () => {
		const canal = createCanal(6);
		const body = createBody(180, 250, 0);
		const depth = maxDepth(canal, body);
		const x = body.x;
		resolveBanks(canal, body, depth + 0.5);
		expect(body.x).toBe(x);
		// A ship across the canal cannot be less embedded at both ends than half its excess length:
		// pressing it harder only settles it in the middle, without shaking it back and forth
		resolveBanks(canal, body, 0);
		const settled = { x: body.x, y: body.y, angle: body.angle };
		expect(Math.abs(settled.x - x)).toBeLessThan(2);
		resolveBanks(canal, body, 0);
		expect(Math.abs(body.x - settled.x)).toBeLessThan(0.5);
		expect(Math.abs(body.angle - settled.angle)).toBeLessThan(0.01);
	});

	it('turns the hull when only one corner touches a bank', () => {
		const canal = createCanal(8);
		const body = createBody(180, 250, -Math.PI / 2 + 0.2);
		// Slide the whole ship west until its stern end is in the bank on one side
		body.x = 122;
		const before = body.angle;
		resolveBanks(canal, body, 0);
		expect(maxDepth(canal, body)).toBeLessThan(0.05);
		expect(body.angle).not.toBe(before);
	});

	it('removing bank tiles removes the contact', () => {
		const canal = createCanal(6);
		const body = createBody(180, 250, 0);
		const before = maxDepth(canal, body);
		for (let row = 10; row <= 14; row++) {
			digTiles(canal, 3, row);
			digTiles(canal, 14, row);
		}
		expect(maxDepth(canal, body)).toBeLessThan(before);
	});
});
