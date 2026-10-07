/* Shared helpers for the Drone Wall unit tests */
import { SOLDIERS, type SoldierKind } from './config';
import { ROAD, pointAt } from './path';
import type { Soldier } from './state';

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

export const STEP_MS = 1000 / 60;
