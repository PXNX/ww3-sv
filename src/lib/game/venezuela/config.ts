/*
 * Constants for El Presidente. Every length is in tiles and every time in seconds, so the physics
 * reads like a spec ("a full jump is about 2.8 tiles high") and the renderer only has to scale.
 */

/** Every level is exactly this many rows tall; the camera only scrolls sideways */
export const LEVEL_ROWS = 10;
/** Tiles visible across the playfield */
export const VIEW_W = 14;
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
	stompBounceHeld: 14
};

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

export const SCORE_BARREL = 100;
export const SCORE_STOMP = 200;
export const SCORE_FLAG = 500;
export const SCORE_PER_HEART = 250;
