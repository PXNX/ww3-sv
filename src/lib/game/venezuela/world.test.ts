import { describe, expect, it } from 'vitest';
import {
	INVULNERABLE_S,
	SCORE_BARREL,
	SCORE_FLAG,
	SCORE_PER_HEART,
	SCORE_STOMP,
	STARTING_HEARTS
} from './config';
import { helicopterAt } from './enemies';
import { NO_INPUT, type Input } from './player';
import { levelFrom } from './testLevel';
import { createWorld, flagBox, starsFor, stepWorld, type World, type WorldEvent } from './world';

const FLOOR = '#'.repeat(30);
const RIGHT: Input = { move: 1, jumpHeld: false, jumpPressed: false };

/** A world on a flat floor (top at row 8); the start is at column 2, row 7 */
function worldOf(row: string) {
	return createWorld(levelFrom([row.padEnd(30, '.'), FLOOR, FLOOR]));
}

function steps(world: World, count: number, input: Input = NO_INPUT): WorldEvent[] {
	const events: WorldEvent[] = [];
	for (let i = 0; i < count; i++) events.push(...stepWorld(world, input));
	return events;
}

const types = (events: WorldEvent[]) => events.map((event) => event.type);

describe('a new world', () => {
	it('starts playing with full hearts, no score and the player on the floor', () => {
		const world = worldOf('..P........................');
		steps(world, 5);
		expect(world.status).toBe('playing');
		expect(world.hearts).toBe(STARTING_HEARTS);
		expect(world.score).toBe(0);
		expect(world.player.onGround).toBe(true);
		expect(world.player.x).toBeCloseTo(2.15, 1);
	});
});

describe('barrels', () => {
	it('are collected by touching them, once, and score', () => {
		const world = worldOf('..P.o.......................');
		const events = steps(world, 60, RIGHT);
		expect(world.collected).toEqual([true]);
		expect(world.barrelsCollected).toBe(1);
		expect(world.score).toBe(SCORE_BARREL);
		expect(types(events).filter((type) => type === 'barrel')).toHaveLength(1);
		// Walking back over the spot does not score again
		steps(world, 90, { move: -1, jumpHeld: false, jumpPressed: false });
		expect(world.score).toBe(SCORE_BARREL);
	});
});

describe('goons', () => {
	it('are squashed by landing on them from above, with a bounce and points', () => {
		const world = worldOf('..P.....e...................');
		steps(world, 3);
		const goon = world.walkers[0];
		world.player.x = goon.x;
		world.player.y = goon.y - world.player.h + 0.1;
		world.player.vy = 6;
		world.player.onGround = false;
		const events = stepWorld(world, NO_INPUT);
		expect(types(events)).toContain('stomp');
		expect(goon.alive).toBe(false);
		expect(world.goonsStomped).toBe(1);
		expect(world.score).toBe(SCORE_STOMP);
		expect(world.player.vy).toBeLessThan(0);
		expect(world.hearts).toBe(STARTING_HEARTS);
	});

	it('bounce is higher while jump is held', () => {
		const bounceWith = (jumpHeld: boolean) => {
			const world = worldOf('..P.....e...................');
			steps(world, 3);
			const goon = world.walkers[0];
			world.player.x = goon.x;
			world.player.y = goon.y - world.player.h + 0.1;
			world.player.vy = 6;
			world.player.onGround = false;
			stepWorld(world, { move: 0, jumpHeld, jumpPressed: false });
			return world.player.vy;
		};
		expect(bounceWith(true)).toBeLessThan(bounceWith(false));
	});

	it('cost a heart when touched from the side, and the hit grants a moment of invulnerability', () => {
		const world = worldOf('..P.....e...................');
		steps(world, 3);
		const goon = world.walkers[0];
		world.player.x = goon.x - 0.5;
		world.player.y = goon.y + goon.h - world.player.h;
		world.player.vy = 0;
		const events = stepWorld(world, NO_INPUT);
		expect(types(events)).toContain('hurt');
		expect(world.hearts).toBe(STARTING_HEARTS - 1);
		expect(world.invuln).toBeGreaterThan(INVULNERABLE_S - 0.1);
		expect(goon.alive).toBe(true);
	});

	it('cannot hurt again while invulnerable, but can once it has worn off', () => {
		const world = worldOf('..P.....e...................');
		steps(world, 3);
		const goon = world.walkers[0];
		const touch = () => {
			world.player.x = goon.x - 0.5;
			world.player.y = goon.y + goon.h - world.player.h;
			world.player.vy = 0;
			stepWorld(world, NO_INPUT);
		};
		touch();
		touch();
		touch();
		expect(world.hearts).toBe(STARTING_HEARTS - 1);
		world.invuln = 0;
		touch();
		expect(world.hearts).toBe(STARTING_HEARTS - 2);
	});
});

describe('hazards and helicopters', () => {
	it('a barbed barricade costs a heart and throws the player up', () => {
		const world = worldOf('..P.^.......................');
		steps(world, 3);
		world.player.x = 4.1;
		world.player.y = 8 - world.player.h - 0.001;
		const events = stepWorld(world, NO_INPUT);
		const hurt = events.find((event) => event.type === 'hurt');
		expect(hurt).toMatchObject({ cause: 'hazard' });
		expect(world.hearts).toBe(STARTING_HEARTS - 1);
		expect(world.player.vy).toBeLessThan(0);
	});

	it('being above a barricade is safe', () => {
		const world = worldOf('..P.^.......................');
		steps(world, 3);
		world.player.x = 4.1;
		world.player.y = 5;
		world.player.vy = 0;
		stepWorld(world, NO_INPUT);
		expect(world.hearts).toBe(STARTING_HEARTS);
	});

	it('a helicopter hurts from every side, stomping included', () => {
		const level = levelFrom(['..P.....h...................', '..............', FLOOR, FLOOR]);
		const world = createWorld(level);
		const position = helicopterAt(world.helis[0].heli, 0);
		world.player.x = position.x - world.player.w / 2;
		world.player.y = position.y - 1.1;
		world.player.vy = 4;
		world.player.onGround = false;
		const events = stepWorld(world, NO_INPUT);
		expect(events.find((event) => event.type === 'hurt')).toMatchObject({ cause: 'heli' });
		expect(types(events)).not.toContain('stomp');
	});
});

describe('hearts, falling and checkpoints', () => {
	it('falling into a pit costs a heart and puts the player back at the start', () => {
		const world = worldOf('..P........................');
		steps(world, 3);
		world.player.x = 12;
		world.player.y = world.level.height + 2;
		const events = stepWorld(world, NO_INPUT);
		expect(events.find((event) => event.type === 'hurt')).toMatchObject({ cause: 'fall' });
		expect(world.hearts).toBe(STARTING_HEARTS - 1);
		expect(world.player.x).toBeCloseTo(2.15, 1);
		expect(world.player.y).toBeLessThan(8);
		expect(world.invuln).toBeGreaterThan(0);
	});

	it('a lit checkpoint lamp becomes the place to come back to', () => {
		const world = worldOf('..P...C.....................');
		const events = steps(world, 90, RIGHT);
		expect(types(events)).toContain('checkpoint');
		expect(world.lit).toEqual([true]);
		world.player.y = world.level.height + 2;
		stepWorld(world, NO_INPUT);
		expect(world.player.x).toBeCloseTo(6.15, 1);
	});

	it('losing the last heart ends the run and freezes the world', () => {
		const world = worldOf('..P.....e...................');
		steps(world, 3);
		world.hearts = 1;
		const goon = world.walkers[0];
		world.player.x = goon.x - 0.5;
		world.player.y = goon.y + goon.h - world.player.h;
		world.player.vy = 0;
		const events = stepWorld(world, NO_INPUT);
		expect(types(events)).toContain('dead');
		expect(world.status).toBe('dead');
		const time = world.time;
		expect(stepWorld(world, RIGHT)).toEqual([]);
		expect(world.time).toBe(time);
	});

	it('dying by falling works the same', () => {
		const world = worldOf('..P........................');
		steps(world, 3);
		world.hearts = 1;
		world.player.y = world.level.height + 2;
		const events = stepWorld(world, NO_INPUT);
		expect(types(events)).toContain('dead');
		expect(world.status).toBe('dead');
	});
});

describe('the flag', () => {
	it('ends the level with a bonus for the hearts left', () => {
		const world = worldOf('..P.....................G..');
		steps(world, 3);
		const box = flagBox(world.level);
		world.player.x = box.x;
		const events = stepWorld(world, NO_INPUT);
		expect(types(events)).toContain('flag');
		expect(world.status).toBe('won');
		expect(world.score).toBe(SCORE_FLAG + STARTING_HEARTS * SCORE_PER_HEART);
	});

	it('is reached by running to it', () => {
		const world = worldOf('..P.........G..............');
		steps(world, 200, RIGHT);
		expect(world.status).toBe('won');
	});

	it('does not tick time after the level is won', () => {
		const world = worldOf('..P.........G..............');
		steps(world, 200, RIGHT);
		const time = world.time;
		steps(world, 10, RIGHT);
		expect(world.time).toBe(time);
	});
});

describe('star rating', () => {
	function won(world: World) {
		world.status = 'won';
		return world;
	}

	it('is nothing before the level is won', () => {
		expect(starsFor(worldOf('..P.o....................G'))).toBe(0);
	});

	it('is one star for finishing, one for every barrel, one for no lost heart', () => {
		const clean = won(worldOf('..P.o....................G'));
		clean.barrelsCollected = 1;
		expect(starsFor(clean)).toBe(3);

		const missed = won(worldOf('..P.o....................G'));
		expect(starsFor(missed)).toBe(2);

		const hurt = won(worldOf('..P.o....................G'));
		hurt.barrelsCollected = 1;
		hurt.heartsLost = 1;
		expect(starsFor(hurt)).toBe(2);

		const both = won(worldOf('..P.o....................G'));
		both.heartsLost = 2;
		expect(starsFor(both)).toBe(1);
	});
});

describe('slam and combos', () => {
	it('a slam landing squashes the grounded goons nearby, and the combo makes each worth more', () => {
		const world = worldOf('..P.e.e.............e........');
		steps(world, 3);
		world.player.x = 4.6;
		world.player.y = 4;
		world.player.onGround = false;
		stepWorld(world, { ...NO_INPUT, slamPressed: true });
		const events = steps(world, 60);
		const stomps = events.filter((event) => event.type === 'stomp');
		expect(types(events)).toContain('slamLand');
		expect(stomps).toHaveLength(2);
		expect(world.walkers.map((walker) => walker.alive)).toEqual([false, false, true]);
		expect(world.score).toBe(SCORE_STOMP + 2 * SCORE_STOMP);
		expect(world.combo).toBe(0);
	});
});
