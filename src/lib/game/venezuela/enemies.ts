/*
 * Enemy patterns. Rig-guard goons patrol a stretch of ground and turn around at walls, edges and
 * barricades; hopping goons do the same but hop on a timer. Helicopters follow a fixed pattern that
 * is a pure function of time (sweep, bob, telegraph, swoop, climb), so they can be dodged by
 * watching them and tested without simulating.
 */
import { moveBody, type Body } from './collision';
import {
	GOON_H,
	GOON_SPEED,
	GOON_W,
	JUMPER_HOP,
	JUMPER_PERIOD,
	JUMPER_SPEED,
	PHYSICS,
	STEP
} from './config';
import { tileAt, type LevelData, type Spot } from './level';

export type WalkerKind = 'goon' | 'jumper';

export interface Walker extends Body {
	id: number;
	kind: WalkerKind;
	/** Walking direction */
	dir: 1 | -1;
	onGround: boolean;
	alive: boolean;
	/** Seconds since it was stomped (only while not alive) */
	squashed: number;
	/** Seconds since the last hop (hopping goons) */
	clock: number;
}

export function createWalker(id: number, kind: WalkerKind, spot: Spot): Walker {
	return {
		id,
		kind,
		x: spot.x + (1 - GOON_W) / 2,
		y: spot.y + 1 - GOON_H,
		w: GOON_W,
		h: GOON_H,
		vx: 0,
		vy: 0,
		dir: -1,
		onGround: false,
		alive: true,
		squashed: 0,
		clock: 0
	};
}

/** Whether the next step in the walking direction would walk into a wall, off an edge or into a hazard */
function blockedAhead(level: LevelData, walker: Walker): boolean {
	const probeX = walker.dir > 0 ? walker.x + walker.w + 0.1 : walker.x - 0.1;
	const column = Math.floor(probeX);
	const feetRow = Math.floor(walker.y + walker.h - 0.05);
	if (tileAt(level, column, feetRow) === 'solid') return true;
	if (tileAt(level, column, feetRow) === 'hazard') return true;
	const below = tileAt(level, column, feetRow + 1);
	// An edge: nothing to stand on ahead (a hopping goon in the air does not care)
	return walker.onGround && below !== 'solid' && below !== 'oneway';
}

/** Advances one walker by one step; a squashed one just counts up its squash timer */
export function stepWalker(walker: Walker, level: LevelData, dt: number = STEP): void {
	if (!walker.alive) {
		walker.squashed += dt;
		return;
	}
	const speed = walker.kind === 'goon' ? GOON_SPEED : JUMPER_SPEED;
	walker.clock += dt;

	if (walker.onGround && blockedAhead(level, walker)) walker.dir = walker.dir === 1 ? -1 : 1;
	if (walker.onGround || walker.kind === 'goon') walker.vx = walker.dir * speed;
	else walker.vx = walker.dir * speed * 1.6;

	if (walker.kind === 'jumper' && walker.onGround && walker.clock >= JUMPER_PERIOD) {
		walker.vy = -JUMPER_HOP;
		walker.clock = 0;
		walker.onGround = false;
	}

	walker.vy = Math.min(PHYSICS.maxFall, walker.vy + PHYSICS.gravity * dt);
	const result = moveBody(level, walker, dt);
	if (result.hitWall) walker.dir = walker.dir === 1 ? -1 : 1;
	walker.onGround = result.landed;
}

export interface Helicopter {
	id: number;
	/** Center of its sweep in tiles */
	x: number;
	y: number;
	/** Half the width of the sweep */
	range: number;
	/** Seconds for one full sweep there and back */
	period: number;
	/** Offset into the pattern in seconds, so neighbours do not move in lockstep */
	phase: number;
}

export const HELI_RANGE = 2.5;
export const HELI_PERIOD = 4;
/** Seconds of one whole pattern: sweep, telegraph, swoop, hold, climb */
export const HELI_CYCLE = 6;
export const HELI_TELEGRAPH_AT = 4.2;
export const HELI_DIVE_AT = 4.8;
export const HELI_HOLD_AT = 5.3;
export const HELI_CLIMB_AT = 5.5;
/** How far the swoop dips below the sweep height */
export const HELI_DIVE_DEPTH = 2;
export const HELI_W = 1.1;
export const HELI_H = 0.7;

export type HeliMode = 'sweep' | 'telegraph' | 'dive' | 'climb';

export function createHelicopter(id: number, spot: Spot): Helicopter {
	return {
		id,
		x: spot.x + 0.5,
		y: spot.y + 0.5,
		range: HELI_RANGE,
		period: HELI_PERIOD,
		phase: (spot.x * 0.37) % 1
	};
}

function smooth(t: number): number {
	const clamped = Math.min(1, Math.max(0, t));
	return clamped * clamped * (3 - 2 * clamped);
}

/** Where the helicopter is (center) at a time, and what part of its pattern it is in */
export function helicopterAt(
	heli: Helicopter,
	time: number
): { x: number; y: number; mode: HeliMode } {
	const t = time + heli.phase * HELI_CYCLE;
	const sub = ((t % HELI_CYCLE) + HELI_CYCLE) % HELI_CYCLE;
	const x = heli.x + heli.range * Math.sin((2 * Math.PI * t) / heli.period);
	const bob = 0.18 * Math.sin((4 * Math.PI * t) / heli.period);

	let dip = 0;
	let mode: HeliMode = 'sweep';
	if (sub >= HELI_CLIMB_AT) {
		dip = HELI_DIVE_DEPTH * (1 - smooth((sub - HELI_CLIMB_AT) / (HELI_CYCLE - HELI_CLIMB_AT)));
		mode = 'climb';
	} else if (sub >= HELI_HOLD_AT) {
		dip = HELI_DIVE_DEPTH;
		mode = 'dive';
	} else if (sub >= HELI_DIVE_AT) {
		dip = HELI_DIVE_DEPTH * smooth((sub - HELI_DIVE_AT) / (HELI_HOLD_AT - HELI_DIVE_AT));
		mode = 'dive';
	} else if (sub >= HELI_TELEGRAPH_AT) {
		mode = 'telegraph';
	}
	// A telegraphing helicopter shakes, which is the warning
	const shake = mode === 'telegraph' ? 0.07 * Math.sin(sub * 70) : 0;
	return { x: x + shake, y: heli.y + bob + dip, mode };
}

/** The box a helicopter hurts with, centered on its position */
export function helicopterBox(position: { x: number; y: number }) {
	return {
		x: position.x - HELI_W / 2,
		y: position.y - HELI_H / 2,
		w: HELI_W,
		h: HELI_H
	};
}

/** Everything a helicopter can ever touch: its whole sweep and the deepest point of its swoop */
export function helicopterSweepBox(heli: Helicopter) {
	const top = heli.y - 0.18 - HELI_H / 2;
	const bottom = heli.y + 0.18 + HELI_DIVE_DEPTH + HELI_H / 2;
	return {
		x: heli.x - heli.range - HELI_W / 2,
		y: top,
		w: 2 * heli.range + HELI_W,
		h: bottom - top
	};
}
