import { describe, expect, it } from 'vitest';
import { createRandom } from '$lib/game/random';
import { BIRD_KINDS } from '../birds';
import { FuryWorld } from '../furyWorld';
import { groundMax } from '../terrain';
import { FIRST_GENERATED_LEVEL, generateLevel } from './generate';
import { PREPARED_LEVEL_COUNT, levelAt, levelIdAt } from './index';
import {
	LANDMARK_KINDS,
	MAX_LEVEL_PIECES,
	MAX_SQUAD,
	validateLevel,
	type LevelData
} from './schema';

/** Generated levels checked in detail: the first fifty past the prepared ones, plus a far-off stretch */
const NUMBERS = [
	...Array.from({ length: 50 }, (_, index) => FIRST_GENERATED_LEVEL + index),
	...Array.from({ length: 10 }, (_, index) => 480 + index * 7)
];
const levels = NUMBERS.map((number) => generateLevel(number));

describe('generated levels', () => {
	it('start right after the prepared levels', () => {
		expect(FIRST_GENERATED_LEVEL).toBe(PREPARED_LEVEL_COUNT + 1);
		expect(levelAt(PREPARED_LEVEL_COUNT).id).toBe(levelIdAt(PREPARED_LEVEL_COUNT));
		expect(levelAt(PREPARED_LEVEL_COUNT).id).toBe('level-16');
		expect(levelAt(0).id).toBe('level-01');
	});

	it('are the same every time for the same level number, and differ between numbers', () => {
		expect(generateLevel(21)).toEqual(generateLevel(21));
		expect(levelAt(20)).toBe(levelAt(20));
		const layouts = new Set(levels.map((level) => JSON.stringify([level.blocks, level.domes])));
		expect(layouts.size).toBe(levels.length);
	});

	it.each(levels.map((level) => [level.id, level] as const))('%s passes validation', (_, level) => {
		const result = validateLevel(level);
		expect(result.ok ? [] : result.errors).toEqual([]);
		expect(level.domes.length).toBeGreaterThanOrEqual(1);
		expect(level.birds.length).toBeGreaterThanOrEqual(3);
		expect(level.birds.length).toBeLessThanOrEqual(MAX_SQUAD);
		const pieces = level.blocks.length + level.domes.length + (level.landmarks?.length ?? 0);
		expect(pieces).toBeLessThanOrEqual(MAX_LEVEL_PIECES);
	});

	it.each(levels.map((level) => [level.id, level] as const))(
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

	it('keep every piece on or above the ground, hills included', () => {
		for (const level of levels) {
			const pieces = [
				...level.blocks.map((b) => ({ left: b.x - b.w / 2, right: b.x + b.w / 2, y: b.y })),
				...level.domes.map((d) => ({ left: d.x - d.size / 2, right: d.x + d.size / 2, y: d.y }))
			];
			for (const piece of pieces) {
				const ground = groundMax(level.hills, piece.left, piece.right);
				expect(piece.y).toBeGreaterThanOrEqual(ground - 1e-9);
			}
		}
	});

	it('use the whole cast: every bird, new shapes, new landmarks, hills and plateaus', () => {
		const birds = new Set(levels.flatMap((level) => level.birds));
		for (const kind of BIRD_KINDS) expect(birds.has(kind), kind).toBe(true);

		const shapes = new Set(levels.flatMap((level) => level.blocks.map((block) => block.shape)));
		for (const shape of ['pillar', 'tire', 'crate', 'barrel', 'spire', 'box'] as const) {
			expect(shapes.has(shape), shape).toBe(true);
		}

		const landmarks = new Set(
			levels.flatMap((level) => (level.landmarks ?? []).map((landmark) => landmark.kind))
		);
		for (const kind of LANDMARK_KINDS) expect(landmarks.has(kind), kind).toBe(true);

		const withHills = levels.filter((level) => (level.hills?.length ?? 0) > 0);
		expect(withHills.length).toBeGreaterThan(levels.length / 2);
		// A plateau lifts a whole fortress: some pieces stand above the flat ground
		const lifted = levels.some((level) =>
			level.blocks.some((block) => block.y >= 0.5 && block.y < 2)
		);
		expect(lifted).toBe(true);
	});

	it('get harder: more stone further in', () => {
		const stoneShare = (batch: LevelData[]) => {
			const blocks = batch.flatMap((level) => level.blocks);
			return blocks.filter((block) => block.material === 'stone').length / blocks.length;
		};
		expect(stoneShare(levels.slice(40, 50))).toBeGreaterThan(stoneShare(levels.slice(0, 10)));
	});
});
