/*
 * Slingshot aiming and trajectory math. The player pulls the pouch back from its rest point; the
 * launch direction is opposite to the pull and the power grows with the pull length. The dotted
 * preview integrates exactly like the physics engine (semi-implicit Euler at the fixed timestep),
 * so the dots lie on the path the bird really takes until it hits something.
 */

export interface Vec {
	x: number;
	y: number;
}

/** Launch direction in radians (counterclockwise from the positive x axis) and power from 0 to 1 */
export interface Aim {
	angle: number;
	power: number;
}

/** World gravity in meters per second squared (y points up) */
export const GRAVITY = -10;
/** The fixed physics timestep */
export const STEP_SECONDS = 1 / 60;

/** Where the slingshot stands on the ground, and where the pouch rests (the launch point) */
export const SLINGSHOT_X = 3;
export const POUCH: Vec = { x: SLINGSHOT_X, y: 2.3 };

/** How far the pouch can be pulled back, and the launch speed at full pull */
export const MAX_PULL = 2;
export const MAX_LAUNCH_SPEED = 17;
/** Below this power a release puts the bird back instead of launching it */
export const MIN_POWER = 0.12;

export const MIN_ANGLE = (-30 * Math.PI) / 180;
export const MAX_ANGLE = (85 * Math.PI) / 180;

/** The aim the keyboard starts from */
export const DEFAULT_AIM: Aim = { angle: (35 * Math.PI) / 180, power: 0.7 };

/** Keyboard steps: one arrow press turns by one degree or changes power by two percent */
export const KEY_ANGLE_STEP = Math.PI / 180;
export const KEY_POWER_STEP = 0.02;

/** How long the dotted preview reaches, in seconds of flight: normal and the accessibility setting */
export const PREVIEW_SECONDS = { normal: 0.45, long: 1.4 } as const;

const TAU = Math.PI * 2;

/** Wraps an angle into (-PI, PI] */
function wrap(angle: number): number {
	let wrapped = angle % TAU;
	if (wrapped <= -Math.PI) wrapped += TAU;
	if (wrapped > Math.PI) wrapped -= TAU;
	return wrapped;
}

/** Clamps an angle into the allowed range, snapping to the nearer end when it lies outside */
export function clampAngle(angle: number): number {
	const a = wrap(angle);
	if (a >= MIN_ANGLE && a <= MAX_ANGLE) return a;
	const toMin = Math.abs(wrap(a - MIN_ANGLE));
	const toMax = Math.abs(wrap(a - MAX_ANGLE));
	return toMin <= toMax ? MIN_ANGLE : MAX_ANGLE;
}

export function clampAim(aim: Aim): Aim {
	return {
		angle: clampAngle(aim.angle),
		power: Math.min(1, Math.max(0, Number.isFinite(aim.power) ? aim.power : 0))
	};
}

/** Turns a pull of the pouch (offset from its rest point) into an aim */
export function aimFromPull(pull: Vec): Aim {
	const length = Math.hypot(pull.x, pull.y);
	if (length < 1e-9) return { angle: DEFAULT_AIM.angle, power: 0 };
	return clampAim({ angle: Math.atan2(-pull.y, -pull.x), power: length / MAX_PULL });
}

/** Where the pouch sits for an aim, as an offset from its rest point */
export function pullFromAim(aim: Aim): Vec {
	const { angle, power } = clampAim(aim);
	return { x: -Math.cos(angle) * power * MAX_PULL, y: -Math.sin(angle) * power * MAX_PULL };
}

/** Initial velocity for an aim; speedFactor comes from the bird type */
export function launchVelocity(aim: Aim, speedFactor = 1): Vec {
	const { angle, power } = clampAim(aim);
	const speed = power * MAX_LAUNCH_SPEED * speedFactor;
	return { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed };
}

/** Keyboard aiming: changes angle and power by the given steps and keeps them in range */
export function adjustAim(aim: Aim, angleDelta: number, powerDelta: number): Aim {
	const angle = Math.min(MAX_ANGLE, Math.max(MIN_ANGLE, clampAngle(aim.angle) + angleDelta));
	return clampAim({ angle, power: aim.power + powerDelta });
}

export function previewSeconds(long: boolean): number {
	return long ? PREVIEW_SECONDS.long : PREVIEW_SECONDS.normal;
}

/**
 * Points along the flight path, integrated exactly like the engine does it: first the velocity,
 * then the position, once per fixed step. Returns one point every sampleEvery steps, for the
 * given number of seconds of flight (the start point itself is not included).
 */
export function trajectoryPoints(
	start: Vec,
	velocity: Vec,
	seconds: number,
	sampleEvery = 3,
	stepSeconds = STEP_SECONDS,
	gravity = GRAVITY
): Vec[] {
	const steps = Math.max(0, Math.round(seconds / stepSeconds));
	const every = Math.max(1, Math.floor(sampleEvery));
	const points: Vec[] = [];
	let x = start.x;
	let y = start.y;
	let vy = velocity.y;
	for (let step = 1; step <= steps; step++) {
		vy += gravity * stepSeconds;
		x += velocity.x * stepSeconds;
		y += vy * stepSeconds;
		if (step % every === 0) points.push({ x, y });
	}
	return points;
}

/** Continuous-time position after t seconds, useful to check the discrete preview against */
export function ballisticPosition(start: Vec, velocity: Vec, t: number, gravity = GRAVITY): Vec {
	return { x: start.x + velocity.x * t, y: start.y + velocity.y * t + 0.5 * gravity * t * t };
}
