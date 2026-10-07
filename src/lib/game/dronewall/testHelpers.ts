/* Shared helpers for the Drone Wall unit tests */
import { FLYERS, LINE_Y, SOLDIERS, type FlyerKind, type SoldierKind } from './config';
import { ROAD, pointAt } from './path';
import type { Flyer, Soldier } from './state';

let nextId = 1000;

/** A soldier standing at a distance along the road */
export function soldierAt(
	progress: number,
	kind: SoldierKind = 'grunt',
	overrides: Partial<Soldier> = {}
): Soldier {
	const stats = SOLDIERS[kind];
	const sample = pointAt(ROAD, progress);
	return {
		id: nextId++,
		kind,
		progress,
		hp: stats.hp,
		maxHp: stats.hp,
		speed: stats.speed,
		lane: 0,
		x: sample.x,
		y: sample.y,
		slow: 1,
		hitMs: 0,
		...overrides
	};
}

/** An aerial enemy flying straight down at x, with its y given (the flight runs from y = -30 to the line) */
export function flyerAt(
	x: number,
	y: number,
	kind: FlyerKind = 'shahed',
	overrides: Partial<Flyer> = {}
): Flyer {
	const stats = FLYERS[kind];
	const length = LINE_Y + 30;
	return {
		id: nextId++,
		kind,
		air: true,
		hp: stats.hp,
		maxHp: stats.hp,
		speed: stats.speed,
		fromX: x,
		toX: x,
		progress: y + 30,
		length,
		phase: 0,
		x,
		y,
		hitMs: 0,
		...overrides
	};
}

export const STEP_MS = 1000 / 60;
