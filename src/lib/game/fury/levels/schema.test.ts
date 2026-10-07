import { describe, expect, it } from 'vitest';
import { validateLevel, type LevelData } from './schema';

const valid: LevelData = {
	version: 1,
	id: 'level-01',
	width: 22,
	birds: ['flamingo'],
	blocks: [{ material: 'wood', shape: 'box', x: 12, y: 0, w: 0.4, h: 2 }],
	domes: [{ x: 14, y: 0, size: 1 }]
};

function errorsOf(data: unknown): string[] {
	const result = validateLevel(data);
	return result.ok ? [] : result.errors;
}

const hill = { x: 12, w: 5, h: 1, flat: 2 };

describe('hills, shapes and landmarks', () => {
	it('accepts a level with a hill under its blocks', () => {
		const onHill = {
			...valid,
			hills: [hill],
			blocks: [{ ...valid.blocks[0], y: 1 }],
			domes: [{ x: 16, y: 0, size: 0.8 }]
		};
		expect(errorsOf(onHill)).toEqual([]);
	});

	it('rejects a block that sinks into a hill, and one that overhangs its slope', () => {
		expect(errorsOf({ ...valid, hills: [hill] })).toContain('blocks[0] is below the ground');
		const overhang = {
			...valid,
			hills: [{ x: 10.5, w: 4, h: 1, flat: 1 }],
			blocks: [{ ...valid.blocks[0], x: 11.4, y: 0, w: 1 }]
		};
		expect(errorsOf(overhang)).toContain('blocks[0] is below the ground');
	});

	it('rejects hills that are malformed, too tall, near the slingshot, outside or overlapping', () => {
		expect(errorsOf({ ...valid, hills: [{ x: 12 }] })).toContain(
			'hills[0] needs numeric x, w, h and flat'
		);
		expect(errorsOf({ ...valid, hills: [{ ...hill, h: 9 }] })).toContain(
			'hills[0].h must be 0.3 to 3 meters'
		);
		expect(errorsOf({ ...valid, hills: [{ ...hill, w: 2 }] })).toContain(
			'hills[0].w must be larger than flat'
		);
		expect(errorsOf({ ...valid, hills: [{ ...hill, x: 6 }] })).toContain(
			'hills[0] reaches too close to the slingshot'
		);
		expect(errorsOf({ ...valid, hills: [{ ...hill, x: 21 }] })).toContain(
			'hills[0] is outside the field'
		);
		const overlapping = {
			...valid,
			hills: [hill, { ...hill, x: 15 }],
			blocks: [],
			domes: [{ x: 20, y: 0, size: 1 }]
		};
		expect(errorsOf(overlapping)).toContain('hills[0] overlaps another hill');
	});

	it('allows at most five hills', () => {
		const many = Array.from({ length: 6 }, (_, index) => ({
			x: 6 + index * 2.6,
			w: 2.4,
			h: 0.5,
			flat: 0.5
		}));
		const level = { ...valid, hills: many, blocks: [], domes: [{ x: 21, y: 0.5, size: 0.6 }] };
		expect(errorsOf(level)).toContain('a level has at most 5 hills');
	});

	it('accepts the new shapes and landmarks, and keeps the round ones round', () => {
		const shapes = ['pillar', 'tire'].map((shape, index) => ({
			material: 'wood',
			shape,
			x: 10 + index * 2,
			y: 0,
			w: shape === 'tire' ? 0.8 : 0.5,
			h: shape === 'tire' ? 0.8 : 2
		}));
		const landmarks = (['radar', 'pylon', 'watchtower', 'bunker'] as const).map((kind, index) => ({
			kind,
			x: [13.5, 15.5, 17.5, 20.2][index],
			y: 0
		}));
		const level = { ...valid, blocks: shapes, landmarks, domes: [{ x: 11, y: 0, size: 0.8 }] };
		expect(errorsOf(level)).toEqual([]);
		const lopsided = { ...shapes[1], h: 1 };
		expect(errorsOf({ ...valid, blocks: [lopsided] })).toContain(
			'blocks[0] is round, so w and h must be equal'
		);
	});

	it('accepts three-digit level ids for the generated levels', () => {
		expect(errorsOf({ ...valid, id: 'level-100' })).toEqual([]);
		expect(errorsOf({ ...valid, id: 'level-1' })).toContain('id must look like level-01');
	});
});
