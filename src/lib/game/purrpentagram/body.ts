/*
 * A cat's body as a little physical object: a spring that pulls it towards where it wants to be
 * (the laser dot, its seat), a hop under gravity for startles and pounces, and a squash-and-stretch
 * spring for the jelly of the landing. Pure and deterministic; the renderer only reads the numbers.
 */

export interface Body {
	/** Offset from the seat */
	x: number;
	y: number;
	vx: number;
	vy: number;
	/** Height above the floor and its speed (positive up) */
	z: number;
	vz: number;
	/** Squash (negative) or stretch (positive) of the jelly spring, and its speed */
	sq: number;
	sqv: number;
	/** Breathing phase in radians */
	phase: number;
}

export function createBody(): Body {
	return { x: 0, y: 0, vx: 0, vy: 0, z: 0, vz: 0, sq: 0, sqv: 0, phase: 0 };
}

const SPRING = 55;
const DAMPING = 8.5;
const GRAVITY = 1900;
const JELLY_SPRING = 220;
const JELLY_DAMPING = 13;
/** Hops this fast or slower do not count as a landing */
const LANDING_MIN = 60;

export interface BodyTarget {
	x: number;
	y: number;
	/** Where the jelly spring rests: a dozing cat sinks into a loaf, a hiding one flattens */
	squash: number;
}

export const REST_TARGET: BodyTarget = { x: 0, y: 0, squash: 0 };

/** Takes off: a vertical speed in units per second and an optional sideways push; the crouch comes first */
export function hop(body: Body, vz: number, vx = 0, vy = 0): void {
	if (body.z > 1) {
		// Already in the air: the hop only adds a little height
		body.vz = Math.max(body.vz, vz * 0.5);
		return;
	}
	body.vz = vz;
	body.vx += vx;
	body.vy += vy;
	// The crouch before the jump shows as a short squash
	body.sq = -Math.min(0.22, vz / 2600);
	body.sqv = 0;
}

/**
 * Advances the body by dtMs. Returns the landing speed (units per second) when it came down this
 * step, otherwise 0, so the caller can raise dust and a thump.
 */
export function stepBody(body: Body, dtMs: number, target: BodyTarget, purr = 0): number {
	const dt = Math.min(dtMs, 50) / 1000;
	body.vx += (SPRING * (target.x - body.x) - DAMPING * body.vx) * dt;
	body.vy += (SPRING * (target.y - body.y) - DAMPING * body.vy) * dt;
	body.x += body.vx * dt;
	body.y += body.vy * dt;

	let landed = 0;
	if (body.z > 0 || body.vz > 0) {
		body.vz -= GRAVITY * dt;
		body.z += body.vz * dt;
		if (body.z <= 0) {
			landed = body.vz < -LANDING_MIN ? -body.vz : 0;
			body.z = 0;
			body.vz = 0;
			// The landing squashes the jelly, harder for a harder landing
			body.sq = -Math.min(0.3, landed / 1800);
			body.sqv = 0;
		}
	}

	body.sqv += (JELLY_SPRING * (target.squash - body.sq) - JELLY_DAMPING * body.sqv) * dt;
	body.sq += body.sqv * dt;
	body.phase = (body.phase + dt * (6 + purr * 4)) % (Math.PI * 2);
	return landed;
}

/** The scale to draw a body with: taller and thinner when stretched, wider and flatter when squashed */
export function bodyScale(body: Body, purr = 0): { x: number; y: number } {
	// Fast upward travel stretches the cat, a fall stretches it a little less
	const flight = body.z > 0 ? Math.max(-0.12, Math.min(0.22, body.vz / 2600)) : 0;
	const breath = Math.sin(body.phase) * 0.018 * purr;
	const y = Math.max(0.55, 1 + body.sq + flight + breath);
	// A squashed jelly keeps its volume: what it loses in height it gains in width
	return { x: Math.min(1.6, 1 / Math.sqrt(y)), y };
}
