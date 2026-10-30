/*
 * Starlink Kill Switch: Elon cuts the satellite links of drones before they reach a refinery.
 * A rocket rises on the left; star satellites float overhead; drones drift in from the right.
 * The player taps or swipes a link to cut it. Cut all before any drone hits the refinery.
 * Inspired by todo.md mode 7 (Starlink Kill Switch / killswitch).
 */
import type { Random } from '../random';

export interface Link {
	id: number;
	x: number;     // 0..1 along the drone's path
	y: number;     // 0..1 vertical, satellites at top
	cut: boolean;
}

export interface Drone {
	x: number;     // 0..1 from right to left
	y: number;
	links: Link[];
}

export interface KillState {
	time: number;       // seconds since start
	drones: Drone[];
	score: number;
	over: boolean;
	won: boolean;
	hits: number;        // drones that got through
}

export const MAX_HITS = 3;
export const LEVEL_TIME = 30;
export const DRONE_RATE = 1.8; // drones per second

export function createKillState(random: Random): KillState {
	return { time: 0, drones: [], score: 0, over: false, won: false, hits: 0 };
}

export function stepKill(state: KillState, dt: number, random: Random) {
	if (state.over) return;
	state.time += dt;

	// Spawn drones
	if (random() < (DRONE_RATE * dt) / 60) {
		const links: Link[] = [];
		for (let i = 0; i < 3 + Math.floor(random() * 2); i++) {
			links.push({ id: Math.random(), x: random(), y: 0.15 + 0.7 * random(), cut: false });
		}
		state.drones.push({ x: 1, y: 0.35 + 0.3 * random(), links });
	}

	// Move drones left
	const speed = 0.0035 + Math.min(state.time * 0.00005, 0.005);
	for (const drone of state.drones) {
		drone.x -= speed;
	}

	// Remove past drones; count hits
	const kept: Drone[] = [];
	for (const drone of state.drones) {
		if (drone.x < -0.05) {
			const uncut = drone.links.filter((l) => !l.cut).length;
			if (uncut > 0) state.hits += 1;
			state.score += drone.links.filter((l) => l.cut).length * 50;
		} else {
			kept.push(drone);
		}
	}
	state.drones = kept;

	if (state.hits >= MAX_HITS) {
		state.over = true;
		state.won = false;
	} else if (state.time >= LEVEL_TIME) {
		state.over = true;
		state.won = true;
		state.score += 300; // survival bonus
	}
}
