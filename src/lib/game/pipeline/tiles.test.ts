import { describe, expect, it } from 'vitest';
import {
	EAST,
	NORTH,
	ROTATIONS,
	SOUTH,
	TILE_KINDS,
	WEST,
	hasOpening,
	opposite,
	openings,
	rotateOnce,
	rotationsFor
} from './tiles';

describe('pipe tiles', () => {
	it('has the expected openings before rotation', () => {
		expect(openings('straight', 0)).toEqual([NORTH, SOUTH]);
		expect(openings('elbow', 0)).toEqual([NORTH, EAST]);
		expect(openings('tee', 0)).toEqual([NORTH, EAST, SOUTH]);
		expect(openings('cross', 0)).toEqual([NORTH, EAST, SOUTH, WEST]);
	});

	it('rotates openings clockwise by a quarter turn', () => {
		expect(openings('straight', 1)).toEqual([EAST, WEST]);
		expect(openings('elbow', 1)).toEqual([EAST, SOUTH]);
		expect(openings('elbow', 2)).toEqual([SOUTH, WEST]);
		expect(openings('elbow', 3)).toEqual([NORTH, WEST]);
		expect(openings('tee', 1)).toEqual([EAST, SOUTH, WEST]);
	});

	it('returns to the start after four quarter turns', () => {
		let rotation = ROTATIONS[0];
		const seen = [rotation];
		for (let i = 0; i < 4; i++) {
			rotation = rotateOnce(rotation);
			seen.push(rotation);
		}
		expect(seen).toEqual([0, 1, 2, 3, 0]);
	});

	it('agrees between hasOpening and openings for every kind and rotation', () => {
		for (const kind of TILE_KINDS) {
			for (const rotation of ROTATIONS) {
				const open = openings(kind, rotation);
				for (const direction of [NORTH, EAST, SOUTH, WEST]) {
					expect(hasOpening(kind, rotation, direction)).toBe(open.includes(direction));
				}
			}
		}
	});

	it('finds the rotations that open towards the required directions', () => {
		expect(rotationsFor('straight', [NORTH, SOUTH])).toEqual([0, 2]);
		expect(rotationsFor('straight', [NORTH, EAST])).toEqual([]);
		expect(rotationsFor('elbow', [SOUTH, WEST])).toEqual([2]);
		expect(rotationsFor('tee', [NORTH, SOUTH])).toEqual([0, 2]);
		expect(rotationsFor('cross', [EAST, WEST])).toEqual([0, 1, 2, 3]);
	});

	it('can connect any pair of directions with a tee', () => {
		const all = [NORTH, EAST, SOUTH, WEST];
		for (const a of all) {
			for (const b of all) {
				if (a !== b) expect(rotationsFor('tee', [a, b]).length).toBeGreaterThan(0);
			}
		}
	});

	it('knows opposite directions', () => {
		expect(opposite(NORTH)).toBe(SOUTH);
		expect(opposite(EAST)).toBe(WEST);
		expect(opposite(SOUTH)).toBe(NORTH);
		expect(opposite(WEST)).toBe(EAST);
	});
});
