/*
 * The player's movement: run with acceleration (and a sprint after a run-up), jump with coyote
 * time and a short jump buffer, a variable jump height (let go of jump early and the rise is cut
 * short), one mustache twirl jump in the air, and a slam: hang for a moment, then dive straight
 * down. Pure and deterministic, so the physics can be unit tested and the level validator can
 * replay it.
 */
import { moveBody, type Body } from './collision';
import { PHYSICS, PLAYER_H, PLAYER_W, STEP, TWIRL_S, type Physics } from './config';
import { tileAt, type LevelData } from './level';

export interface Input {
	/** -1 left, 0 none, 1 right */
	move: -1 | 0 | 1;
	/** Jump button is down right now */
	jumpHeld: boolean;
	/** Jump button went down since the last step */
	jumpPressed: boolean;
	/** Slam button went down since the last step */
	slamPressed?: boolean;
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
	/** Mustache twirl jumps left before landing again */
	airJumps: number;
	/** Seconds left of the twirl animation */
	twirl: number;
	/** Seconds spent running in one direction; past the run-up the player sprints */
	runTime: number;
	/** The slam: hanging in the air for a moment, then diving straight down */
	slam: 'none' | 'hang' | 'dive';
	/** Seconds left of the slam's hang */
	slamTimer: number;
}

export type PlayerEvent = 'jump' | 'airJump' | 'land' | 'bump' | 'sprint' | 'slam' | 'slamLand';

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
		facing: 1,
		airJumps: 1,
		twirl: 0,
		runTime: 0,
		slam: 'none',
		slamTimer: 0
	};
}

function approach(value: number, target: number, amount: number): number {
	if (value < target) return Math.min(target, value + amount);
	return Math.max(target, value - amount);
}

/**
 * Whether the player, falling, will touch down within the given seconds. A jump pressed that close
 * to the floor is kept for the landing (the jump buffer) instead of spending the twirl.
 */
function landingSoon(player: Player, level: LevelData, seconds: number): boolean {
	if (player.vy <= 0) return false;
	const feet = player.y + player.h;
	const below = feet + player.vy * seconds + 0.05;
	const left = Math.floor(player.x + 0.01);
	const right = Math.floor(player.x + player.w - 0.01);
	for (let row = Math.floor(feet); row <= Math.floor(below); row++) {
		if (row < feet - 0.01) continue;
		for (let column = left; column <= right; column++) {
			const kind = tileAt(level, column, row);
			if (kind === 'solid' || kind === 'oneway') return true;
		}
	}
	return false;
}

/** Whether the run-up is done and the player is going faster than a normal run */
export function isSprinting(player: Player, physics: Physics = PHYSICS): boolean {
	return player.runTime >= physics.sprintAfter && Math.abs(player.vx) > physics.maxSpeed;
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
	player.twirl = Math.max(0, player.twirl - dt);

	// The slam starts in the air, hangs for a moment, then dives; there is no steering until it lands
	if (input.slamPressed && !player.onGround && player.slam === 'none') {
		player.slam = 'hang';
		player.slamTimer = physics.slamHang;
		player.canCut = false;
		player.runTime = 0;
		events.push('slam');
	}
	if (player.slam === 'hang') {
		player.vx = 0;
		player.vy = 0;
		player.slamTimer -= dt;
		if (player.slamTimer > 0) return events;
		player.slam = 'dive';
	}
	const diving = player.slam === 'dive';

	// Running; holding one direction on the ground long enough turns it into a sprint
	const move = diving ? 0 : input.move;
	if (move === 0 || move !== player.facing) player.runTime = 0;
	else if (player.onGround) player.runTime += dt;
	const sprinting = player.runTime >= physics.sprintAfter;
	if (sprinting && player.runTime - dt < physics.sprintAfter) events.push('sprint');

	if (diving) {
		player.vx = 0;
	} else if (move !== 0) {
		const accel = player.onGround ? physics.groundAccel : physics.airAccel;
		const top = sprinting ? physics.sprintSpeed : physics.maxSpeed;
		// Faster than the top speed (sprint momentum carried into a jump) only fades gently
		const coasting = Math.abs(player.vx) > top && Math.sign(player.vx) === move;
		player.vx = approach(player.vx, move * top, (coasting ? physics.airFriction : accel) * dt);
		player.facing = move;
	} else {
		const drag = player.onGround ? physics.groundFriction : physics.airFriction;
		player.vx = approach(player.vx, 0, drag * dt);
	}

	// Coyote time and the jump buffer
	if (player.onGround) player.coyote = physics.coyote;
	else player.coyote = Math.max(0, player.coyote - dt);
	player.buffer = input.jumpPressed ? physics.jumpBuffer : Math.max(0, player.buffer - dt);

	if (!diving && player.buffer > 0 && player.coyote > 0) {
		player.vy = -physics.jumpSpeed;
		player.coyote = 0;
		player.buffer = 0;
		player.onGround = false;
		player.canCut = true;
		events.push('jump');
	} else if (
		!diving &&
		input.jumpPressed &&
		!player.onGround &&
		player.airJumps > 0 &&
		!landingSoon(player, level, physics.jumpBuffer)
	) {
		// The mustache twirl: one more, slightly smaller jump in the air
		player.airJumps -= 1;
		player.vy = -physics.airJumpSpeed;
		player.buffer = 0;
		player.canCut = true;
		player.twirl = TWIRL_S;
		events.push('airJump');
	}

	// Variable height: letting go of jump while still rising cuts the rise short
	if (player.canCut && !input.jumpHeld && player.vy < -physics.jumpCutSpeed) {
		player.vy = -physics.jumpCutSpeed;
	}

	player.vy = diving
		? physics.slamSpeed
		: Math.min(physics.maxFall, player.vy + physics.gravity * dt);

	const wasOnGround = player.onGround;
	const result = moveBody(level, player, dt);
	player.onGround = result.landed;
	if (result.hitWall) player.runTime = 0;
	if (result.landed) {
		player.canCut = false;
		player.airJumps = 1;
		if (player.slam === 'dive') {
			player.slam = 'none';
			events.push('slamLand');
		}
		if (!wasOnGround) events.push('land');
	}
	if (result.bumped) events.push('bump');
	return events;
}
