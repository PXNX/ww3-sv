import { describe, expect, it } from 'vitest';
import { BLOCK_BOOSTERS, BOOST_SECONDS, noBoosts, physicsFor } from './boosters';
import {
	PHYSICS,
	SCORE_BOOSTER,
	SCORE_FULL_AREPA,
	SPRING_SPEED,
	SPRING_SPEED_HELD,
	STARTING_HEARTS,
	VIEW_W
} from './config';
import { cameraTarget } from './camera';
import { overlaps } from './collision';
import { tileAt } from './level';
import { RAW_LEVELS, levelAt } from './levels';
import { NO_INPUT, type Input } from './player';
import { createPlatform, platformAt, platformSweepBox, PLATFORM_W } from './platforms';
import { analyzeReach } from './reach';
import { levelFrom } from './testLevel';
import { createWorld, stepWorld, type World, type WorldEvent } from './world';

const FLOOR = '#'.repeat(30);
const RIGHT: Input = { move: 1, jumpHeld: false, jumpPressed: false };
const JUMP: Input = { move: 0, jumpHeld: true, jumpPressed: true };

function steps(world: World, count: number, input: Input = NO_INPUT): WorldEvent[] {
	const events: WorldEvent[] = [];
	for (let i = 0; i < count; i++) events.push(...stepWorld(world, input));
	return events;
}

const types = (events: WorldEvent[]) => events.map((event) => event.type);

/** The rows of a world on a flat floor are listed top to bottom, the last one right above the floor */
const FLOOR_TOP = 8;

function worldOf(...rows: string[]) {
	return createWorld(levelFrom([...rows.map((row) => row.padEnd(30, '.')), FLOOR, FLOOR]));
}

/** A level of nothing but air, for barges to float in */
const open = () => levelFrom(['.'.repeat(20)]);

function stand(world: World, x: number) {
	const { player } = world;
	player.x = x + 0.5 - player.w / 2;
	player.y = FLOOR_TOP - player.h;
	player.vx = 0;
	player.vy = 0;
	player.onGround = true;
}

/** Stands under the block in column x and jumps into it */
function bumpFrom(world: World, x: number) {
	stand(world, x);
	return steps(world, 40, JUMP);
}

describe('the level format', () => {
	it('reads springs, barges and mystery blocks', () => {
		const level = levelFrom(['..P.s..~..:..A.T.B.M.G', FLOOR]);
		expect(level.springs).toEqual([{ x: 4, y: 8 }]);
		expect(level.platforms).toEqual([
			{ x: 7, y: 8, axis: 'x' },
			{ x: 10, y: 8, axis: 'y' }
		]);
		expect(level.blocks.map((block) => block.kind)).toEqual(['arepa', 'turbo', 'boots', 'star']);
		// Blocks are solid, springs and barges are not
		expect(tileAt(level, 13, 8)).toBe('solid');
		expect(tileAt(level, 4, 8)).toBe('empty');
		expect(tileAt(level, 7, 8)).toBe('empty');
	});
});

describe('mystery blocks', () => {
	// A block on row 5: its bottom edge is 1.05 tiles above the head of a player on the floor
	const blockWorld = (char = 'T') => worldOf(`.....${char}`, '', '');

	it('give their booster when bumped from below, once', () => {
		const world = blockWorld();
		const events = bumpFrom(world, 5);
		const given = events.filter((event) => event.type === 'booster');
		expect(given).toHaveLength(1);
		expect(world.boosts.turbo).toBeGreaterThan(BOOST_SECONDS.turbo - 1);
		expect(world.blocks[0].used).toBe(true);
		expect(world.score).toBe(SCORE_BOOSTER);
		// A second bump on the empty block gives nothing
		world.boosts.turbo = 0;
		const again = bumpFrom(world, 5);
		expect(again.filter((event) => event.type === 'booster')).toHaveLength(0);
		expect(world.boosts.turbo).toBe(0);
	});

	it('stay solid: they can be landed on', () => {
		const world = blockWorld();
		const block = world.blocks[0];
		world.player.x = block.x + 0.15;
		world.player.y = block.y - 3;
		world.player.vy = 0;
		steps(world, 60);
		expect(world.player.y + world.player.h).toBeCloseTo(block.y, 2);
		expect(world.player.onGround).toBe(true);
	});

	it('an arepa mends a heart, or pays out when the hearts are full', () => {
		const hurt = blockWorld('A');
		hurt.hearts = 1;
		bumpFrom(hurt, 5);
		expect(hurt.hearts).toBe(2);

		const full = blockWorld('A');
		bumpFrom(full, 5);
		expect(full.hearts).toBe(STARTING_HEARTS);
		expect(full.score).toBe(SCORE_FULL_AREPA);
	});

	it('every block character maps to a booster', () => {
		expect(Object.values(BLOCK_BOOSTERS).sort()).toEqual(['arepa', 'boots', 'star', 'turbo']);
	});
});

describe('timed boosters', () => {
	it('count down and run out', () => {
		const world = worldOf('..P');
		world.boosts.boots = 0.5;
		steps(world, 20);
		expect(world.boosts.boots).toBeGreaterThan(0);
		steps(world, 20);
		expect(world.boosts.boots).toBe(0);
	});

	it('turbo coffee makes the presidente faster and the boots make a jump higher', () => {
		expect(physicsFor(noBoosts())).toBe(PHYSICS);
		const turbo = physicsFor({ ...noBoosts(), turbo: 1 });
		expect(turbo.maxSpeed).toBeGreaterThan(PHYSICS.maxSpeed);
		expect(turbo.sprintSpeed).toBeGreaterThan(PHYSICS.sprintSpeed);
		const boots = physicsFor({ ...noBoosts(), boots: 1 });
		expect(boots.jumpSpeed).toBeGreaterThan(PHYSICS.jumpSpeed);
		const both = physicsFor({ turbo: 1, boots: 1, star: 0 });
		expect(both.maxSpeed).toBe(turbo.maxSpeed);
		expect(both.jumpSpeed).toBe(boots.jumpSpeed);
		// The same object every time, so no step allocates
		expect(physicsFor({ ...noBoosts(), boots: 3 })).toBe(boots);
	});

	it('the boots lift a jump visibly higher', () => {
		const apex = (boots: number) => {
			const world = worldOf('..P');
			steps(world, 5);
			world.boosts.boots = boots;
			const start = world.player.y;
			let top = start;
			stepWorld(world, JUMP);
			for (let i = 0; i < 90; i++) {
				stepWorld(world, { move: 0, jumpHeld: true, jumpPressed: false });
				top = Math.min(top, world.player.y);
			}
			return start - top;
		};
		expect(apex(5)).toBeGreaterThan(apex(0) * 1.3);
	});

	it('the golden mustache squashes a goon from the side and shrugs off barricades and fire', () => {
		const world = worldOf('..P.e....');
		world.boosts.star = 5;
		steps(world, 120, RIGHT);
		expect(world.goonsStomped).toBe(1);
		expect(world.hearts).toBe(STARTING_HEARTS);

		const barbed = worldOf('..P.^^^^');
		barbed.boosts.star = 5;
		steps(barbed, 90, RIGHT);
		expect(barbed.heartsLost).toBe(0);

		const plain = worldOf('..P.^^^^');
		steps(plain, 90, RIGHT);
		expect(plain.heartsLost).toBeGreaterThan(0);
	});

	it('the golden mustache does not save from a fall', () => {
		const level = levelFrom(['..P.....', '###..###', '###..###']);
		const world = createWorld(level);
		world.boosts.star = 9;
		for (let i = 0; i < 90 && world.heartsLost === 0; i++) stepWorld(world, RIGHT);
		expect(world.heartsLost).toBe(1);
	});
});

describe('spring pads', () => {
	const rise = (jumpHeld: boolean) => {
		const world = worldOf('..Ps....');
		steps(world, 5);
		let top = world.player.y;
		const start = top;
		const events: WorldEvent[] = [];
		// Walk onto the spring and keep going a little
		for (let i = 0; i < 70; i++) {
			events.push(...stepWorld(world, { move: i < 30 ? 1 : 0, jumpHeld, jumpPressed: false }));
			top = Math.min(top, world.player.y);
		}
		return { height: start - top, events };
	};

	it('fling the player up when walked onto', () => {
		const { height, events } = rise(false);
		expect(types(events)).toContain('spring');
		expect(height).toBeGreaterThan(4);
		expect(height).toBeLessThan((SPRING_SPEED * SPRING_SPEED) / (2 * PHYSICS.gravity) + 0.2);
	});

	it('fling higher while jump is held', () => {
		expect(rise(true).height).toBeGreaterThan(rise(false).height + 0.8);
		expect(SPRING_SPEED_HELD).toBeGreaterThan(SPRING_SPEED);
	});

	it('are cleared by a jump over them', () => {
		const world = worldOf('..Ps....');
		steps(world, 5);
		// Leaping from the tile next to it sails over the pad, which only catches a falling or walking body
		const events = [...steps(world, 1, { ...JUMP, move: 1 }), ...steps(world, 40, { ...RIGHT, jumpHeld: true })];
		expect(types(events)).not.toContain('spring');
	});
});

describe('hover barges', () => {
	const withBarge = (x: number, y: number, axis: 'x' | 'y') =>
		createWorld({ ...open(), platforms: [{ x, y, axis }] });

	it('move in a pure function of time, within their travel', () => {
		const platform = createPlatform(0, { x: 8, y: 7, axis: 'x' });
		const sweep = platformSweepBox(platform);
		for (let t = 0; t < 30; t += 0.25) {
			const at = platformAt(platform, t);
			expect(at.x).toBeGreaterThanOrEqual(sweep.x - 1e-9);
			expect(at.x + PLATFORM_W).toBeLessThanOrEqual(sweep.x + sweep.w + 1e-9);
			expect(at.y).toBe(7);
		}
		const lift = createPlatform(1, { x: 8, y: 5, axis: 'y' });
		const heights = Array.from({ length: 80 }, (_, i) => platformAt(lift, i * 0.1).y);
		expect(Math.min(...heights)).toBeCloseTo(3, 1);
		expect(Math.max(...heights)).toBeCloseTo(7, 1);
	});

	it('hold up a player landing on them, only from above', () => {
		const world = withBarge(6, 5, 'x');
		const barge = world.platforms[0];
		world.player.x = barge.x + 0.5;
		world.player.y = barge.y - world.player.h - 1;
		world.player.vy = 0;
		steps(world, 40);
		expect(world.player.onGround).toBe(true);
		expect(world.player.y + world.player.h).toBeCloseTo(world.platforms[0].y, 2);
		expect(world.riding).toBe(0);

		// From below it lets the player through
		const below = withBarge(6, 5, 'x');
		const plank = below.platforms[0];
		below.player.x = plank.x + 0.5;
		below.player.y = plank.y + 1.2;
		below.player.vy = -12;
		steps(below, 6);
		expect(below.player.y + below.player.h).toBeLessThan(plank.y + 1.3);
		expect(below.player.vy).toBeLessThan(0);
	});

	it('carry whoever stands on them', () => {
		const world = withBarge(6, 5, 'x');
		const barge = world.platforms[0];
		world.player.x = barge.x + 0.9;
		world.player.y = barge.y - world.player.h;
		steps(world, 5);
		expect(world.riding).toBe(0);
		const offsetAt = () => world.player.x - world.platforms[0].x;
		const before = offsetAt();
		const startX = world.player.x;
		steps(world, 90);
		expect(Math.abs(world.player.x - startX)).toBeGreaterThan(0.5);
		expect(offsetAt()).toBeCloseTo(before, 1);
		expect(world.player.onGround).toBe(true);
	});

	it('carry a rider up and down on a lift', () => {
		const world = withBarge(6, 5, 'y');
		const lift = world.platforms[0];
		world.player.x = lift.x + 0.5;
		world.player.y = lift.y - world.player.h;
		// The lift may be heading down at the start: let the rider settle onto it first
		steps(world, 10);
		let lowest = world.player.y;
		let highest = world.player.y;
		for (let i = 0; i < 400; i++) {
			stepWorld(world, NO_INPUT);
			expect(world.riding).toBe(0);
			expect(world.player.y + world.player.h).toBeCloseTo(world.platforms[0].y, 1);
			lowest = Math.max(lowest, world.player.y);
			highest = Math.min(highest, world.player.y);
		}
		expect(lowest - highest).toBeGreaterThan(3);
	});

	it('let the rider jump off', () => {
		const world = withBarge(6, 5, 'x');
		const barge = world.platforms[0];
		world.player.x = barge.x + 0.9;
		world.player.y = barge.y - world.player.h;
		steps(world, 5);
		const events = steps(world, 2, JUMP);
		expect(types(events)).toContain('jump');
		expect(world.player.onGround).toBe(false);
		expect(world.riding).toBeNull();
	});
});

describe('the view', () => {
	it('shows a wider stretch of the level on a wide screen and never past the ends', () => {
		const narrow = cameraTarget(50, 1, 100);
		const wide = cameraTarget(50, 1, 100, 20);
		expect(wide).toBeLessThan(narrow);
		expect(cameraTarget(99, 1, 100, 20)).toBe(80);
		expect(cameraTarget(99, 1, 100)).toBe(100 - VIEW_W);
	});
});

describe('the shipped levels use the new pieces sensibly', () => {
	describe.each(RAW_LEVELS.map((raw, index) => [raw.id, index] as const))('%s', (_id, index) => {
		const level = levelAt(index);

		it('keeps every barge and lift clear of solid tiles, with room for the rider above', () => {
			for (const [id, spot] of level.platforms.entries()) {
				const sweep = platformSweepBox(createPlatform(id, spot));
				const covered = { x: sweep.x, y: sweep.y - 1, w: sweep.w, h: sweep.h + 1 };
				for (let ty = Math.floor(covered.y); ty <= Math.floor(covered.y + covered.h - 1e-6); ty++) {
					for (let tx = Math.floor(covered.x); tx <= Math.floor(covered.x + covered.w - 1e-6); tx++) {
						if (tileAt(level, tx, ty) !== 'solid') continue;
						expect(
							overlaps(covered, { x: tx, y: ty, w: 1, h: 1 }),
							`barge at ${spot.x},${spot.y} hits ${tx},${ty}`
						).toBe(false);
					}
				}
			}
		});

		it('puts springs on firm ground with room to fly', () => {
			for (const spot of level.springs) {
				expect(['solid', 'oneway']).toContain(tileAt(level, spot.x, spot.y + 1));
				for (let up = 1; up <= 3; up++) expect(tileAt(level, spot.x, spot.y - up)).not.toBe('solid');
			}
		});

		it('puts every mystery block where a head can reach it from below', () => {
			for (const block of level.blocks) {
				// A head needs free air right under the block
				expect(tileAt(level, block.x, block.y + 1)).not.toBe('solid');
			}
		});
	});

	it('really needs the barges, the lift and the springs where they stand in the new levels', () => {
		const strip = (id: string, replace: Record<string, string>) => {
			const level = levelAt(RAW_LEVELS.findIndex((raw) => raw.id === id));
			const rows = level.rows.map((row) =>
				[...row].map((char) => replace[char] ?? char).join('')
			);
			return { ...level, rows, platforms: [], springs: [] };
		};
		expect(analyzeReach(strip('gantry', { '~': '.', ':': '.' })).goal).toBe(false);
		expect(analyzeReach(strip('gorge', { s: '.', '~': '.' })).goal).toBe(false);
	});
});
