import { describe, expect, it } from 'vitest';
import { createRandom } from '$lib/game/random';
import { FuryWorld } from '../furyWorld';
import { LEVELS, loadLevels } from './index';
import { LEVEL_VERSION, MAX_LEVEL_PIECES, validateLevel, type LevelData } from './schema';

const files = import.meta.glob<unknown>('./level-*.json', { eager: true, import: 'default' });

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

describe('level files', () => {
	it('ships fifteen levels, numbered in order', () => {
		expect(Object.keys(files)).toHaveLength(15);
		expect(LEVELS.map((level) => level.id)).toEqual(
			Array.from({ length: 15 }, (_, index) => `level-${String(index + 1).padStart(2, '0')}`)
		);
	});

	it.each(Object.entries(files))('%s passes validation', (path, data) => {
		const result = validateLevel(data);
		expect(result.ok ? [] : result.errors).toEqual([]);
		if (!result.ok) return;
		const level = result.level;
		expect(path).toBe(`./${level.id}.json`);
		expect(level.version).toBe(LEVEL_VERSION);
		expect(level.domes.length).toBeGreaterThanOrEqual(1);
		expect(level.birds.length).toBeGreaterThanOrEqual(1);
		expect(level.blocks.length + level.domes.length).toBeLessThanOrEqual(MAX_LEVEL_PIECES);
	});

	it.each(LEVELS.map((level) => [level.id, level] as const))(
		'%s stands still on its own for three seconds',
		(_, level) => {
			const world = new FuryWorld(level, createRandom(1));
			const start = world.pieces.map((piece) => piece.body.getPosition().clone());
			for (let i = 0; i < 180; i++) world.step();
			expect(world.blocksDestroyed + world.domesDestroyed).toBe(0);
			const moved = world.pieces.map((piece, index) =>
				piece.body.getPosition().clone().sub(start[index]).length()
			);
			expect(Math.max(...moved)).toBeLessThan(0.2);
		}
	);
});

describe('validateLevel', () => {
	it('accepts a well-formed level', () => {
		expect(errorsOf(valid)).toEqual([]);
	});

	it('requires the current version and a proper id', () => {
		expect(errorsOf({ ...valid, version: 2 })).toContain(`version must be ${LEVEL_VERSION}`);
		expect(errorsOf({ ...valid, id: 'first' })).toContain('id must look like level-01');
	});

	it('requires at least one golden dome and a bird squad', () => {
		expect(errorsOf({ ...valid, domes: [] })).toContain('a level needs at least one golden dome');
		expect(errorsOf({ ...valid, birds: [] })).toContain('the bird squad is empty');
		expect(errorsOf({ ...valid, birds: ['eagle'] })).toContain(
			'the bird squad contains an unknown bird'
		);
	});

	it('enforces the block-count limit', () => {
		const blocks = Array.from({ length: MAX_LEVEL_PIECES }, (_, index) => ({
			material: 'wood',
			shape: 'box',
			x: 9,
			y: index * 0.3,
			w: 0.3,
			h: 0.3
		}));
		expect(errorsOf({ ...valid, blocks, domes: [{ x: 20, y: 0, size: 1 }] })).toContain(
			`blocks plus domes exceed the limit of ${MAX_LEVEL_PIECES}`
		);
	});

	it('rejects overlapping, floating-under-ground and misplaced pieces', () => {
		const overlap = { ...valid, domes: [{ x: 12, y: 1, size: 1 }] };
		expect(errorsOf(overlap)).toContain('blocks[0] overlaps domes[0]');
		const buried = { ...valid, blocks: [{ ...valid.blocks[0], y: -1 }] };
		expect(errorsOf(buried)).toContain('blocks[0] is below the ground');
		const tooClose = { ...valid, blocks: [{ ...valid.blocks[0], x: 4 }] };
		expect(errorsOf(tooClose)).toContain('blocks[0] is too close to the slingshot');
		const outside = { ...valid, blocks: [{ ...valid.blocks[0], x: 30 }] };
		expect(errorsOf(outside)).toContain('blocks[0] is outside the field');
	});

	it('rejects unknown materials and shapes, and malformed data', () => {
		const block = { ...valid.blocks[0], material: 'gold', shape: 'star' };
		const errors = errorsOf({ ...valid, blocks: [block] });
		expect(errors).toContain('blocks[0].material is invalid');
		expect(errors).toContain('blocks[0].shape is invalid');
		expect(errorsOf(null)).toEqual(['level is not an object']);
		expect(errorsOf({ ...valid, blocks: [{ x: 1 }] })).toContain(
			'blocks[0] needs numeric x, y, w and h'
		);
	});

	it('throws when a bundled file is invalid', () => {
		expect(() => loadLevels({ './level-01.json': { ...valid, domes: [] } })).toThrow(/golden dome/);
	});
});
