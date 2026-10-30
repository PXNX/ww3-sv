/*
 * Iceberg Curling (Greenland / Trump): sweep a curling stone against a "For Sale" sign.
 * The stone slides with momentum; seals slide out; a lost penguin drifts. 8 ends with stars.
 */
import type { Random } from '../random';

export interface CurlState {
	stone: { x: number; y: number; vx: number; vy: number };
	sweeps: number;
	ends: number;
	sealsHit: number;
	penguinLost: boolean;
	over: boolean;
	score: number;
}

export const ENDS_TOTAL = 8;
export const STAR_AT = 3;
export function createCurl(random: Random): CurlState {
	return {
		stone: { x: 0.15, y: 0.85, vx: 0.06, vy: -0.09 },
		sweeps: 3,
		ends: 0,
		sealsHit: 0,
		penguinLost: false,
		over: false,
		score: 0
	};
}
export function stepCurl(state: CurlState, dt: number, random: Random) {
	if (state.over) return;
	state.stone.x += state.stone.vx * dt;
	state.stone.y += state.stone.vy * dt;
	// Friction
	state.stone.vx *= 0.97;
	state.stone.vy *= 0.97;
	// Seals
	if (random() < 0.015) state.sealsHit++;
	if (state.stone.y < 0) state.stone.y = 0.01;
	if (state.stone.x < 0) state.stone.x = 0.01;
	if (state.stone.y < 0.1) {
		state.ends++;
		state.score += 120 + 30 * state.ends;
		state.stone.y = 0.85;
		state.stone.vx = 0.05 + 0.02 * random();
		if (state.ends >= ENDS_TOTAL) {
			state.over = true;
			state.score += 200 * STAR_AT;
		}
	}
}
