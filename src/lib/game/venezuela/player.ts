/*
 * The player's movement: run with acceleration, jump with coyote time and a short jump buffer,
 * and a variable jump height (let go of jump early and the rise is cut short). Pure and
 * deterministic, so the physics can be unit tested and the level validator can replay it.
 */
import { moveBody, type Body } from './collision';
import { PHYSICS, PLAYER_H, PLAYER_W, STEP, type Physics } from './config';
import type { LevelData } from './level';

export interface Input {
	/** -1 left, 0 none, 1 right */
	move: -1 | 0 | 1;
	/** Jump button is down right now */
	jumpHeld: boolean;
	/** Jump button went down since the last step */
	jumpPressed: boolean;
}

export const NO_INPUT: Input = { move: 0, jumpHeld: false, jumpPressed: false };

export interface Player extends Body {
	onGround: boolean;
	/** Seconds left in which a jump still counts although the ground is gone */
	coyote: number;
	/** Seconds left in which an earlier jump press still counts */
	buffer: number;
	/** The current rise can still be cut short by letting go of jump */
	canCut: boolean;
	facing: 1 | -1;
}

export type PlayerEvent = 'jump' | 'land' | 'bump';

/** A player standing on the ground with the left edge of the box at x and feet at the given y */
export function createPlayer(x: number, feetY: number): Player {
	return {
		x,
		y: feetY - PLAYER_H,
		w: PLAYER_W,
		h: PLAYER_H,
		vx: 0,
		vy: 0,
		onGround: false,
		coyote: 0,
		buffer: 0,
		canCut: false,
		facing: 1
	};
}

function approach(value: number, target: number, amount: number): number {
	if (value < target) return Math.min(target, value + amount);
	return Math.max(target, value - amount);
}

/** Advances the player by one step and reports what happened */
export function stepPlayer(
	player: Player,
	input: Input,
	level: LevelData,
	physics: Physics = PHYSICS,
	dt: number = STEP
): PlayerEvent[] {
	const events: PlayerEvent[] = [];

	// Running
	if (input.move !== 0) {
		const accel = player.onGround ? physics.groundAccel : physics.airAccel;
		player.vx = approach(player.vx, input.move * physics.maxSpeed, accel * dt);
		player.facing = input.move;
	} else {
		const drag = player.onGround ? physics.groundFriction : physics.airFriction;
		player.vx = approach(player.vx, 0, drag * dt);
	}

	// Coyote time and the jump buffer
	if (player.onGround) player.coyote = physics.coyote;
	else player.coyote = Math.max(0, player.coyote - dt);
	player.buffer = input.jumpPressed ? physics.jumpBuffer : Math.max(0, player.buffer - dt);

	if (player.buffer > 0 && player.coyote > 0) {
		player.vy = -physics.jumpSpeed;
		player.coyote = 0;
		player.buffer = 0;
		player.onGround = false;
		player.canCut = true;
		events.push('jump');
	}

	// Variable height: letting go of jump while still rising cuts the rise short
	if (player.canCut && !input.jumpHeld && player.vy < -physics.jumpCutSpeed) {
		player.vy = -physics.jumpCutSpeed;
	}

	player.vy = Math.min(physics.maxFall, player.vy + physics.gravity * dt);

	const wasOnGround = player.onGround;
	const result = moveBody(level, player, dt);
	player.onGround = result.landed;
	if (result.landed) {
		player.canCut = false;
		if (!wasOnGround) events.push('land');
	}
	if (result.bumped) events.push('bump');
	return events;
}
