import { describe, expect, it } from 'vitest';
import { createRandom, pickOne } from '#lib/game/random.js';
import { boardFromRows, createBoard, fitsAnywhere, type Board } from './board';
import { generateTray, placeableWeight, TRAY_SIZE } from './pieceGenerator';
import { PIECES, type Piece } from './pieces';

/** Nearly full: only the two-cell lines fit, in the top-left corner */
const NEARLY_FULL = boardFromRows([
	'..XXXXXX',
	'X.XXXXXX',
	'XX.XXXXX',
	'XXX.XXXX',
	'XXXX.XXX',
	'XXXXX.XX',
	'XXXXXX.X',
	'XXXXXXX.'
]);

// Enough for stable rates with a fixed seed, and fast enough under a loaded test run
const TRIALS = 1000;

function rateWithPlaceable(board: Board, makeTray: () => readonly Piece[]): number {
	const fits = new Set(PIECES.filter((piece) => fitsAnywhere(board, piece)));
	let hits = 0;
	for (let i = 0; i < TRIALS; i++) {
		if (makeTray().some((piece) => fits.has(piece))) hits++;
	}
	return hits / TRIALS;
}

describe('piece generator', () => {
	it('offers three pieces from the piece set', () => {
		const tray = generateTray(createBoard(), createRandom(1));
		expect(tray).toHaveLength(TRAY_SIZE);
		for (const piece of tray) expect(PIECES).toContain(piece);
	});

	it('is deterministic for a given seed', () => {
		const ids = (seed: number) => {
			const random = createRandom(seed);
			return Array.from({ length: 10 }, () =>
				generateTray(NEARLY_FULL, random).map((piece) => piece.id)
			);
		};
		expect(ids(7)).toEqual(ids(7));
		expect(ids(7)).not.toEqual(ids(8));
	});

	it('picks every piece on an empty board, where everything fits', () => {
		const random = createRandom(3);
		const counts = new Map<string, number>();
		for (let i = 0; i < TRIALS; i++) {
			for (const piece of generateTray(createBoard(), random)) {
				counts.set(piece.id, (counts.get(piece.id) ?? 0) + 1);
			}
		}
		const expected = (TRIALS * TRAY_SIZE) / PIECES.length;
		for (const piece of PIECES) {
			expect(counts.get(piece.id)).toBeGreaterThan(expected * 0.8);
			expect(counts.get(piece.id)).toBeLessThan(expected * 1.2);
		}
	});

	it('biases toward placeable pieces more strongly as the board fills', () => {
		expect(placeableWeight(createBoard())).toBe(1);
		expect(placeableWeight(NEARLY_FULL)).toBeGreaterThan(4);
	});

	it('offers a placeable piece on a nearly full board far more often than uniform picking', () => {
		const placeable = PIECES.filter((piece) => fitsAnywhere(NEARLY_FULL, piece));
		expect(placeable.map((piece) => piece.id).sort()).toEqual(['line-2-h', 'line-2-v']);

		const random = createRandom(11);
		const biased = rateWithPlaceable(NEARLY_FULL, () => generateTray(NEARLY_FULL, random));
		const uniformRandom = createRandom(11);
		const uniform = rateWithPlaceable(NEARLY_FULL, () =>
			Array.from({ length: TRAY_SIZE }, () => pickOne(uniformRandom, PIECES))
		);

		// Uniform picking gives about 30 percent; the bias should more than double that
		expect(uniform).toBeGreaterThan(0.25);
		expect(uniform).toBeLessThan(0.35);
		expect(biased).toBeGreaterThan(uniform * 2);
		// ...but it stays a bias, not a guarantee, so the game remains unpredictable and can end
		expect(biased).toBeLessThan(0.9);
	});

	it('still offers pieces that do not fit, and varied ones', () => {
		const random = createRandom(5);
		const seen = new Set<string>();
		for (let i = 0; i < 200; i++) {
			for (const piece of generateTray(NEARLY_FULL, random)) seen.add(piece.id);
		}
		expect(seen.size).toBe(PIECES.length);
	});
});
