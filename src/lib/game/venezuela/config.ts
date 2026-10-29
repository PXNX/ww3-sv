/*
 * Constants for El Presidente. Every length is in tiles and every time in seconds, so the physics
 * reads like a spec ("a full jump is about 2.8 tiles high") and the renderer only has to scale.
 */

/** Every level is exactly this many rows tall; the camera only scrolls sideways */
export const LEVEL_ROWS = 10;
/** Tiles visible across the playfield on a squarish screen: the least the view ever shows */
export const VIEW_W = 14;
/** A wide landscape screen shows more of the level, up to this many tiles across */
export const VIEW_W_MAX = 20;
export const VIEW_H = LEVEL_ROWS;

/** One fixed logic step (the loop runs at 60 steps per second) */
export const STEP = 1 / 60;

export const STARTING_HEARTS = 3;

export interface Physics {
	/** Top running speed, tiles per second */
	maxSpeed: number;
	groundAccel: number;
	groundFriction: number;
	airAccel: number;
	airFriction: number;
	gravity: number;
	maxFall: number;
	/** Upward speed at the start of a jump */
	jumpSpeed: number;
	/** Letting go of jump caps the upward speed at this, which is what makes the jump variable */
	jumpCutSpeed: number;
	/** Seconds after leaving a ledge during which a jump still works (coyote time) */
	coyote: number;
	/** Seconds a jump press is remembered while still in the air above the floor */
	jumpBuffer: number;
	/** Upward speed after stomping a goon; higher while jump is held */
	stompBounce: number;
	stompBounceHeld: number;
	/** Upward speed of the mustache twirl, the one extra jump allowed in the air */
	airJumpSpeed: number;
	/** Seconds of running in one direction on the ground before the sprint kicks in */
	sprintAfter: number;
	/** Top running speed while sprinting, tiles per second */
	sprintSpeed: number;
	/** Seconds the slam hangs in the air before diving */
	slamHang: number;
	/** Falling speed of the slam dive */
	slamSpeed: number;
}

export const PHYSICS: Physics = {
	maxSpeed: 6.5,
	groundAccel: 60,
	groundFriction: 55,
	airAccel: 38,
	airFriction: 8,
	gravity: 55,
	maxFall: 20,
	jumpSpeed: 17.5,
	jumpCutSpeed: 7,
	coyote: 0.1,
	jumpBuffer: 0.1,
	stompBounce: 9,
	stompBounceHeld: 14,
	airJumpSpeed: 14,
	sprintAfter: 0.7,
	sprintSpeed: 9.5,
	slamHang: 0.12,
	slamSpeed: 26
};

/** A slam landing squashes every grounded goon this many tiles to either side */
export const SLAM_RADIUS = 2.6;
/** Seconds the mustache twirl animation of the air jump lasts */
export const TWIRL_S = 0.4;

/** Height of a full jump in tiles, v squared over two g */
export function jumpHeight(physics: Physics = PHYSICS): number {
	return (physics.jumpSpeed * physics.jumpSpeed) / (2 * physics.gravity);
}

export const PLAYER_W = 0.7;
export const PLAYER_H = 0.95;

export const GOON_W = 0.8;
export const GOON_H = 0.8;
export const GOON_SPEED = 1.6;
export const JUMPER_SPEED = 1.1;
export const JUMPER_PERIOD = 1.7;
export const JUMPER_HOP = 10.5;

/** Seconds of invulnerability after losing a heart */
export const INVULNERABLE_S = 1.6;
/** Seconds a stomped goon stays visible, squashed */
export const SQUASH_S = 0.45;

/** Upward speed of a spring pad, and of one with jump held (about 4.8 and 6.1 tiles high) */
export const SPRING_SPEED = 23;
export const SPRING_SPEED_HELD = 26;

export const SCORE_BARREL = 100;
/** A booster out of a mystery block; an arepa for someone with full hearts is worth more */
export const SCORE_BOOSTER = 150;
export const SCORE_FULL_AREPA = 300;
/** Points for a squashed goon, multiplied by the combo (goons squashed without touching ground) */
export const SCORE_STOMP = 200;
export const SCORE_FLAG = 500;
export const SCORE_PER_HEART = 250;
