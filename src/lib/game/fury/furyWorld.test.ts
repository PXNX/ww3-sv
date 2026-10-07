import { describe, expect, it } from 'vitest';
import { createRandom } from '$lib/game/random';
import {
	DOME_MATERIAL,
	FuryWorld,
	GRACE_STEPS,
	MATERIALS,
	MAX_BODIES,
	MAX_EFFECTS,
	domeVertices,
	impactDamage
} from './furyWorld';
import { EGG_RADIUS } from './birds';
import { launchVelocity } from './launch';
import type { LevelBlock, LevelData, LevelDome } from './levels/schema';
import { BLOCK_POINTS, DOME_POINTS } from './rules';

function level(blocks: LevelBlock[], domes: LevelDome[]): LevelData {
	return { version: 1, id: 'level-99', width: 24, birds: ['flamingo'], blocks, domes };
}

function run(world: FuryWorld, steps: number) {
	for (let i = 0; i < steps; i++) world.step();
}

const farDome: LevelDome = { x: 23, y: 0, size: 0.8 };

describe('impact damage', () => {
	it('ignores impulses at or below the threshold', () => {
		expect(impactDamage(2, 2)).toBe(0);
		expect(impactDamage(1, 2)).toBe(0);
		expect(impactDamage(0, 2)).toBe(0);
		expect(impactDamage(Number.NaN, 2)).toBe(0);
	});

	it('counts only the part above the threshold, scaled by the hitter', () => {
		expect(impactDamage(5, 2)).toBe(3);
		expect(impactDamage(5, 2, 1.5)).toBe(5.5);
	});

	it('orders the materials: ice breaks first, stone last', () => {
		const breakingImpulse = (spec: { threshold: number; hp: number }) => spec.threshold + spec.hp;
		expect(breakingImpulse(MATERIALS.ice)).toBeLessThan(breakingImpulse(MATERIALS.wood));
		expect(breakingImpulse(MATERIALS.wood)).toBeLessThan(breakingImpulse(MATERIALS.stone));
		expect(MATERIALS.ice.friction).toBeLessThan(MATERIALS.wood.friction);
		expect(DOME_MATERIAL.threshold).toBeLessThan(MATERIALS.wood.threshold);
	});

	it('gives domes a flat base and a pointed top', () => {
		const vertices = domeVertices(1);
		expect(Math.min(...vertices.map((v) => v.y))).toBe(0);
		expect(Math.max(...vertices.map((v) => v.y))).toBeCloseTo(1.1);
	});
});

describe('physics world', () => {
	it('leaves a resting stack alone: resting weight never counts as damage', () => {
		const world = new FuryWorld(
			level(
				[
					{ material: 'ice', shape: 'box', x: 12, y: 0, w: 2, h: 0.5 },
					{ material: 'stone', shape: 'box', x: 12, y: 0.5, w: 1, h: 1 },
					{ material: 'stone', shape: 'box', x: 12, y: 1.5, w: 1, h: 1 }
				],
				[{ x: 12, y: 2.5, size: 1 }]
			),
			createRandom(1)
		);
		run(world, 240);
		expect(world.blocksDestroyed).toBe(0);
		expect(world.domesDestroyed).toBe(0);
		expect(world.isAtRest()).toBe(true);
	});

	it('breaks ice when a stone block falls on it, and scores it', () => {
		const world = new FuryWorld(
			level(
				[
					{ material: 'ice', shape: 'box', x: 12, y: 0, w: 1, h: 0.5 },
					{ material: 'stone', shape: 'box', x: 12, y: 4, w: 1, h: 1 }
				],
				[farDome]
			),
			createRandom(1)
		);
		run(world, 120);
		expect(world.blocksDestroyed).toBe(1);
		expect(world.pieces.some((piece) => piece.kind === 'block' && piece.material === 'ice')).toBe(
			false
		);
		expect(world.destructionPoints).toBe(BLOCK_POINTS.ice);
		expect(world.drainEvents()).toContainEqual({
			type: 'block-destroyed',
			material: 'ice',
			points: BLOCK_POINTS.ice
		});
	});

	it('breaks a dome that topples off its perch onto the ground', () => {
		const world = new FuryWorld(
			level(
				[{ material: 'wood', shape: 'box', x: 12, y: 0, w: 0.4, h: 2 }],
				[{ x: 12.5, y: 2, size: 1 }]
			),
			createRandom(1)
		);
		run(world, 240);
		expect(world.domesDestroyed).toBe(1);
		expect(world.domesRemaining).toBe(0);
		expect(world.destructionPoints).toBeGreaterThanOrEqual(DOME_POINTS);
	});

	it('smashes a dome hit by a bird, after a wobble', () => {
		const world = new FuryWorld(level([], [{ x: 10, y: 0, size: 1 }]), createRandom(1));
		run(world, GRACE_STEPS);
		world.launch('pelican', launchVelocity({ angle: 0, power: 0.8 }));
		for (let i = 0; i < 90 && world.domesDestroyed === 0; i++) world.step();
		expect(world.domesDestroyed).toBe(1);
		// The dome wobbles in place, then bursts into golden sparkles
		expect(world.effects.some((effect) => effect.kind === 'dome')).toBe(true);
		expect(world.drainEvents()).toContainEqual({ type: 'dome-destroyed', remaining: 0 });
	});

	it('splits a flying flamingo into three, only once and only before it hits', () => {
		const world = new FuryWorld(level([], [farDome]), createRandom(1));
		world.launch('flamingo', launchVelocity({ angle: 0.6, power: 0.8 }));
		run(world, 10);
		expect(world.useAbility()).toBe(true);
		const birds = world.pieces.filter((piece) => piece.kind === 'bird');
		expect(birds).toHaveLength(3);
		expect(world.useAbility()).toBe(false);
		expect(world.bodyCount).toBeLessThanOrEqual(MAX_BODIES);
	});

	it('offers no ability to a pelican or to a bird that already hit something', () => {
		const world = new FuryWorld(level([], [farDome]), createRandom(1));
		world.launch('pelican', launchVelocity({ angle: 0.5, power: 0.6 }));
		expect(world.useAbility()).toBe(false);
		const flamingo = world.launch('flamingo', launchVelocity({ angle: -0.5, power: 0.3 }));
		run(world, 60);
		expect(flamingo.hasHit).toBe(true);
		expect(world.useAbility()).toBe(false);
	});

	it('removes the previous turn’s birds when the next one launches', () => {
		const world = new FuryWorld(level([], [farDome]), createRandom(1));
		world.launch('flamingo', launchVelocity({ angle: 0.6, power: 0.8 }));
		run(world, 10);
		world.useAbility();
		world.launch('pelican', launchVelocity({ angle: 0.6, power: 0.8 }));
		expect(world.pieces.filter((piece) => piece.kind === 'bird')).toHaveLength(1);
	});

	it('bursts into a small explosion the first time a pelican hits something hard', () => {
		const world = new FuryWorld(level([], [{ x: 10, y: 0, size: 1 }]), createRandom(1));
		run(world, GRACE_STEPS);
		world.launch('pelican', launchVelocity({ angle: 0, power: 0.8 }));
		run(world, 30);
		expect(
			world.effects.some(
				(effect) =>
					(effect.kind === 'puff' || effect.kind === 'shard') && effect.tone === 'explosion'
			)
		).toBe(true);
	});

	it('finishes a bird that comes to rest', () => {
		const world = new FuryWorld(level([], [farDome]), createRandom(1));
		world.launch('pelican', launchVelocity({ angle: 0.3, power: 0.3 }));
		expect(world.birdsDone()).toBe(false);
		run(world, 400);
		expect(world.birdsDone()).toBe(true);
	});

	it('keeps the number of effects capped', () => {
		const blocks: LevelBlock[] = Array.from({ length: 12 }, (_, index) => ({
			material: 'ice',
			shape: 'crate',
			x: 9 + index * 1.1,
			y: 0,
			w: 1,
			h: 1
		}));
		// A row of stone blocks dropped onto the crates makes a lot of splinters at once
		for (let index = 0; index < 12; index++) {
			blocks.push({ material: 'stone', shape: 'box', x: 9 + index * 1.1, y: 5, w: 1, h: 1 });
		}
		const world = new FuryWorld(level(blocks, [farDome]), createRandom(1));
		for (let i = 0; i < 90; i++) {
			world.step();
			expect(world.effects.length).toBeLessThanOrEqual(MAX_EFFECTS);
		}
		expect(world.blocksDestroyed).toBeGreaterThan(6);
	});
});

const speedOf = (body: { getLinearVelocity(): { x: number; y: number } }) => {
	const velocity = body.getLinearVelocity();
	return Math.hypot(velocity.x, velocity.y);
};

describe('hills', () => {
	const hill = { x: 15, w: 6, h: 1, flat: 3 };
	const hilly = (blocks: LevelBlock[], domes: LevelDome[]): LevelData => ({
		...level(blocks, domes),
		hills: [hill]
	});

	it('carries a stack on its flat top without damage', () => {
		const world = new FuryWorld(
			hilly(
				[
					{ material: 'wood', shape: 'box', x: 14.4, y: 1, w: 0.4, h: 1.2 },
					{ material: 'wood', shape: 'box', x: 15.6, y: 1, w: 0.4, h: 1.2 },
					{ material: 'wood', shape: 'box', x: 15, y: 2.2, w: 1.8, h: 0.4 }
				],
				[{ x: 15, y: 2.6, size: 0.9 }]
			),
			createRandom(1)
		);
		run(world, 240);
		expect(world.blocksDestroyed).toBe(0);
		expect(world.domesDestroyed).toBe(0);
		expect(world.isAtRest()).toBe(true);
	});

	it('does not count a dome standing on a hill as toppled', () => {
		const world = new FuryWorld(hilly([], [{ x: 15, y: 1, size: 1 }, farDome]), createRandom(1));
		run(world, 240);
		expect(world.domesDestroyed).toBe(0);
	});

	it('still breaks a dome that falls off a hill-top perch', () => {
		const world = new FuryWorld(
			hilly(
				[{ material: 'wood', shape: 'box', x: 15, y: 1, w: 0.4, h: 2 }],
				[{ x: 15.5, y: 3, size: 1 }]
			),
			createRandom(1)
		);
		run(world, 300);
		expect(world.domesDestroyed).toBe(1);
	});

	it('stops a block dropped on the slope above the flat ground', () => {
		const world = new FuryWorld(
			hilly([{ material: 'stone', shape: 'box', x: 15, y: 4, w: 1, h: 1 }], [farDome]),
			createRandom(1)
		);
		run(world, 240);
		const block = world.pieces.find((piece) => piece.kind === 'block');
		// It lands on the hill top (1 m up), not on the flat ground below
		expect(block?.body.getPosition().y).toBeGreaterThan(1.3);
		expect(block?.body.getPosition().y).toBeLessThan(1.7);
	});

	it('lets a flat level keep its single straight ground', () => {
		const world = new FuryWorld(
			level([{ material: 'wood', shape: 'box', x: 12, y: 3, w: 1, h: 1 }], [farDome]),
			createRandom(1)
		);
		run(world, 240);
		const block = world.pieces.find((piece) => piece.kind === 'block');
		expect(block?.body.getPosition().y).toBeCloseTo(0.5, 1);
	});
});

describe('new bird abilities', () => {
	it('lets the stork dash once, in flight, for a burst of speed', () => {
		const world = new FuryWorld(level([], [farDome]), createRandom(1));
		const bird = world.launch('stork', launchVelocity({ angle: 0.6, power: 0.8 }));
		run(world, 10);
		const before = speedOf(bird.body);
		expect(world.abilityBird()).toBe(bird);
		expect(world.useAbility()).toBe(true);
		expect(speedOf(bird.body)).toBeGreaterThan(before * 1.5);
		expect(world.useAbility()).toBe(false);
		expect(world.drainEvents()).toContainEqual({ type: 'ability', bird: 'stork' });
	});

	it('lets the falcon dive steeply downwards', () => {
		const world = new FuryWorld(level([], [farDome]), createRandom(1));
		const bird = world.launch('falcon', launchVelocity({ angle: 0.6, power: 0.8 }));
		run(world, 10);
		expect(world.useAbility()).toBe(true);
		const velocity = bird.body.getLinearVelocity();
		expect(velocity.x).toBeGreaterThan(0);
		expect(velocity.y).toBeLessThan(-8);
		expect(world.useAbility()).toBe(false);
	});

	it('lets the goose drop an egg, once, and the turn lasts until the egg has landed', () => {
		const world = new FuryWorld(level([], [farDome]), createRandom(1));
		const goose = world.launch('goose', launchVelocity({ angle: 0.6, power: 0.7 }));
		run(world, 12);
		expect(world.useAbility()).toBe(true);
		const birds = world.pieces.filter((piece) => piece.kind === 'bird');
		expect(birds).toHaveLength(2);
		const egg = birds.find((piece) => piece.kind === 'bird' && piece.egg);
		expect(egg?.kind === 'bird' && egg.radius).toBe(EGG_RADIUS);
		expect(goose.egg).toBe(false);
		// The egg falls faster than the goose and starts below it
		expect(egg!.body.getPosition().y).toBeLessThan(goose.body.getPosition().y);
		expect(egg!.body.getLinearVelocity().y).toBeLessThan(goose.body.getLinearVelocity().y);
		expect(world.useAbility()).toBe(false);
		expect(world.bodyCount).toBeLessThanOrEqual(MAX_BODIES);
		run(world, 900);
		expect(world.birdsDone()).toBe(true);
	});

	it('breaks stone with a dropped egg that a plain goose bump would not', () => {
		const stoneUnder = (drop: boolean) => {
			const world = new FuryWorld(
				level([{ material: 'stone', shape: 'box', x: 14, y: 0, w: 1.2, h: 0.5 }], [farDome]),
				createRandom(1)
			);
			run(world, GRACE_STEPS);
			const goose = world.launch('goose', { x: 0, y: 0 }, { x: 14, y: 6 });
			goose.body.setLinearVelocity({ x: 0, y: 0 });
			if (drop) {
				expect(world.useAbility()).toBe(true);
				goose.body.setPosition({ x: 20, y: 9 });
			}
			run(world, 120);
			return world.blocksDestroyed;
		};
		expect(stoneUnder(true)).toBe(1);
	});
});
