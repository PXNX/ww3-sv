import { describe, expect, it } from 'vitest';
import { PHYSICS, STEP, jumpHeight } from './config';
import { NO_INPUT, createPlayer, stepPlayer, type Input, type Player } from './player';
import { levelFrom } from './testLevel';

const FLOOR = '######################';
/** A floor (top at row 8) that ends after column 5, with a pit beyond it */
const LEDGE = '######';

const flat = levelFrom([FLOOR, FLOOR]);
const ledge = levelFrom([LEDGE, LEDGE]);

function settled(level = flat, x = 3): Player {
	const player = createPlayer(x, 8);
	for (let i = 0; i < 5; i++) stepPlayer(player, NO_INPUT, level);
	return player;
}

const run = (move: -1 | 1): Input => ({ move, jumpHeld: false, jumpPressed: false });

describe('running', () => {
	it('accelerates to the top speed and no further', () => {
		const player = settled();
		for (let i = 0; i < 40; i++) stepPlayer(player, run(1), flat);
		expect(player.vx).toBeCloseTo(PHYSICS.maxSpeed, 5);
		expect(player.facing).toBe(1);
	});

	it('slows to a stop when nothing is held', () => {
		const player = settled();
		for (let i = 0; i < 20; i++) stepPlayer(player, run(1), flat);
		for (let i = 0; i < 20; i++) stepPlayer(player, NO_INPUT, flat);
		expect(player.vx).toBe(0);
	});

	it('faces the way it runs', () => {
		const player = settled(flat, 10);
		stepPlayer(player, run(-1), flat);
		expect(player.facing).toBe(-1);
	});

	it('stands still on the ground without sinking or drifting', () => {
		const player = settled();
		const { x, y } = player;
		for (let i = 0; i < 60; i++) stepPlayer(player, NO_INPUT, flat);
		expect(player.x).toBe(x);
		expect(player.y).toBeCloseTo(y, 3);
		expect(player.onGround).toBe(true);
	});
});

describe('jumping', () => {
	const press: Input = { move: 0, jumpHeld: true, jumpPressed: true };
	const hold: Input = { move: 0, jumpHeld: true, jumpPressed: false };

	it('leaves the ground with the jump speed and reports it', () => {
		const player = settled();
		const events = stepPlayer(player, press, flat);
		expect(events).toContain('jump');
		expect(player.onGround).toBe(false);
		expect(player.vy).toBeLessThan(-15);
	});

	it('lands again and reports it', () => {
		const player = settled();
		stepPlayer(player, press, flat);
		let landed = false;
		for (let i = 0; i < 90 && !landed; i++)
			landed = stepPlayer(player, NO_INPUT, flat).includes('land');
		expect(landed).toBe(true);
		expect(player.onGround).toBe(true);
	});

	it('cannot jump a second time in the air', () => {
		const player = settled();
		stepPlayer(player, press, flat);
		for (let i = 0; i < 10; i++) stepPlayer(player, hold, flat);
		const events = stepPlayer(player, press, flat);
		expect(events).not.toContain('jump');
	});

	it('remembers a jump pressed just before landing (jump buffer)', () => {
		const player = settled();
		stepPlayer(player, press, flat);
		let pressed = false;
		let jumpedAfterPress = false;
		for (let i = 0; i < 120; i++) {
			// One press, a few frames above the floor on the way down
			const press1 = !pressed && player.vy > 0 && player.y + player.h > 7.8;
			if (press1) pressed = true;
			const events = stepPlayer(player, press1 ? press : NO_INPUT, flat);
			if (pressed && !press1 && events.includes('jump')) jumpedAfterPress = true;
		}
		expect(pressed).toBe(true);
		expect(jumpedAfterPress).toBe(true);
	});

	it('forgets a jump pressed too long before landing', () => {
		const player = settled();
		stepPlayer(player, press, flat);
		let pressed = false;
		let jumpedAfterPress = false;
		for (let i = 0; i < 120; i++) {
			const press1 = !pressed && player.vy > 0 && player.y + player.h < 6.5;
			if (press1) pressed = true;
			const events = stepPlayer(player, press1 ? press : pressed ? NO_INPUT : hold, flat);
			if (pressed && !press1 && events.includes('jump')) jumpedAfterPress = true;
		}
		expect(pressed).toBe(true);
		expect(jumpedAfterPress).toBe(false);
	});

	describe('variable height', () => {
		/** How high (in tiles) a jump goes when the button is held for the given number of steps */
		function apex(holdSteps: number): number {
			const player = settled();
			const startY = player.y;
			let top = startY;
			for (let i = 0; i < 90; i++) {
				const input: Input = {
					move: 0,
					jumpHeld: i < holdSteps,
					jumpPressed: i === 0
				};
				stepPlayer(player, input, flat);
				top = Math.min(top, player.y);
			}
			return startY - top;
		}

		it('a held jump reaches the full height', () => {
			const height = apex(60);
			expect(height).toBeGreaterThan(jumpHeight() - 0.15);
			expect(height).toBeLessThan(jumpHeight() + 0.15);
		});

		it('letting go early makes a short hop', () => {
			const tap = apex(2);
			expect(tap).toBeGreaterThan(0.2);
			expect(tap).toBeLessThan(1);
		});

		it('the longer the button is held, the higher the jump (never lower)', () => {
			const heights = [1, 3, 6, 10, 14, 60].map(apex);
			for (let i = 1; i < heights.length; i++) {
				expect(heights[i]).toBeGreaterThanOrEqual(heights[i - 1] - 1e-9);
			}
			expect(heights[heights.length - 1]).toBeGreaterThan(heights[0] * 2);
		});

		it('letting go on the way down changes nothing', () => {
			const full = apex(60);
			const releasedAtApex = apex(25);
			expect(releasedAtApex).toBeCloseTo(full, 1);
		});
	});
});

describe('coyote time', () => {
	/** Runs off the ledge, waits the given number of steps in the air, then presses jump */
	function jumpAfterLeaving(wait: number) {
		const player = createPlayer(4.5, 8);
		for (let i = 0; i < 5; i++) stepPlayer(player, NO_INPUT, ledge);
		let guard = 0;
		while (player.onGround && guard++ < 200) stepPlayer(player, run(1), ledge);
		expect(player.onGround).toBe(false);
		for (let i = 0; i < wait; i++) stepPlayer(player, run(1), ledge);
		const events = stepPlayer(player, { move: 1, jumpHeld: true, jumpPressed: true }, ledge);
		return { jumped: events.includes('jump'), player };
	}

	it('still allows a jump right after running off a ledge', () => {
		expect(jumpAfterLeaving(0).jumped).toBe(true);
		expect(jumpAfterLeaving(3).jumped).toBe(true);
	});

	it('allows the jump right up to the end of the coyote window', () => {
		const lastGood = Math.floor(PHYSICS.coyote / STEP) - 2;
		expect(jumpAfterLeaving(lastGood).jumped).toBe(true);
	});

	it('refuses the jump once the window has passed', () => {
		const tooLate = Math.ceil(PHYSICS.coyote / STEP) + 2;
		expect(jumpAfterLeaving(tooLate).jumped).toBe(false);
	});

	it('a coyote jump gives the full jump, not a weaker one', () => {
		const { player } = jumpAfterLeaving(3);
		expect(player.vy).toBeLessThan(-15);
	});

	it('is used up by a normal jump: no coyote jump after jumping', () => {
		const player = settled();
		stepPlayer(player, { move: 0, jumpHeld: true, jumpPressed: true }, flat);
		expect(player.coyote).toBe(0);
	});
});
