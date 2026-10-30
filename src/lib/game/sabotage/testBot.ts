/*
 * A stealth bot for checking that every job can be beaten. It searches the real simulation with a
 * beam: from every state still alive it tries a few moves for a fraction of a second ("walk",
 * "sneak", "wait", "work", "back" toward the start), keeps the best few hundredths of them (fewest
 * finished jobs missing, closest to the goal, least suspicion, one per spot) and repeats. It never
 * sprints and never uses the phone, so reaching the exit means the plain stealth route exists. Test
 * helper only.
 */
import { REACH, STEP } from './config.js';
import type { Level } from './levels.js';
import { findPath, walkClear, type Vec } from './map.js';
import {
	NO_INPUT,
	createSabotage,
	step,
	targetInReach,
	type Input,
	type SabotageState
} from './state.js';

export type Plan = 'walk' | 'sneak' | 'wait' | 'work' | 'back';

const PLANS: readonly Plan[] = ['walk', 'sneak', 'wait', 'work', 'back'];
/** Seconds each move is held */
const SLICE = 0.4;
const BEAM = 40;
/** States that got this suspicious are dropped, so the route found is a quiet one */
const GIVE_UP = 0.7;

function clone(state: SabotageState): SabotageState {
	const { level, ...rest } = state;
	return { ...structuredClone(rest), level };
}

/** The tile next to the nearest unfinished target (or the exit once all are done) to walk to */
function goalOf(state: SabotageState): Vec {
	const { level, player } = state;
	let best: { point: Vec; length: number } | null = null;
	for (const target of state.targets) {
		if (target.done) continue;
		for (const [dx, dy] of [
			[1, 0],
			[-1, 0],
			[0, 1],
			[0, -1]
		]) {
			const point = { x: Math.floor(target.x) + dx + 0.5, y: Math.floor(target.y) + dy + 0.5 };
			if (Math.hypot(point.x - target.x, point.y - target.y) > REACH) continue;
			const path = findPath(level.grid, player, point);
			if (path && (!best || path.length < best.length)) best = { point, length: path.length };
		}
	}
	return best ? best.point : level.exit;
}

export function inputFor(state: SabotageState, plan: Plan): Input {
	if (plan === 'wait') return NO_INPUT;
	if (plan === 'work') return { ...NO_INPUT, hold: targetInReach(state) >= 0 };
	const point = plan === 'back' ? state.level.start : goalOf(state);
	const path = findPath(state.level.grid, state.player, point) ?? [];
	let next: Vec = path[0] ?? point;
	if (path.length > 1 && walkClear(state.level.grid, state.player, path[1])) next = path[1];
	const dx = next.x - state.player.x;
	const dy = next.y - state.player.y;
	const length = Math.hypot(dx, dy);
	if (length < 0.05) return NO_INPUT;
	return {
		x: dx / length,
		y: dy / length,
		sprint: false,
		sneak: plan === 'sneak' || plan === 'back',
		hold: false
	};
}

function advance(state: SabotageState, plan: Plan): SabotageState {
	const copy = clone(state);
	// One heading for the whole slice: working out the path every step would be far too slow
	const input = inputFor(copy, plan);
	const steps = Math.round(SLICE / STEP);
	for (let i = 0; i < steps && copy.phase === 'playing'; i++) step(copy, STEP, input);
	return copy;
}

function rank(state: SabotageState): number {
	const path = findPath(state.level.grid, state.player, goalOf(state));
	const distance = path ? path.length : 99;
	const work = state.targets.reduce(
		(sum, target) => sum + (target.done ? 300 : target.progress * 100),
		0
	);
	return work - distance - state.suspicion * 25;
}

/** One entry per spot: the quietest state in each 0.4 tile square with the same work done */
function spotKey(state: SabotageState): string {
	const done = state.targets.filter((target) => target.done).length;
	const working = Math.round(state.targets.reduce((sum, target) => sum + target.progress, 0) * 4);
	return `${Math.round(state.player.x / 0.4)},${Math.round(state.player.y / 0.4)},${done},${working},${Math.round(state.suspicion * 4)}`;
}

export interface BotResult {
	state: SabotageState | null;
	/** The furthest the search got when it never cleared the job */
	bestSeconds: number;
	cleared: boolean;
}

export function play(level: Level, limitSeconds = 300): BotResult {
	let alive: SabotageState[] = [createSabotage(level)];
	let bestSeconds = 0;
	for (let time = 0; time < limitSeconds; time += SLICE) {
		const next = new Map<string, SabotageState>();
		for (const state of alive) {
			for (const plan of PLANS) {
				if (plan === 'work' && targetInReach(state) < 0) continue;
				const after = advance(state, plan);
				if (after.phase === 'cleared')
					return { state: after, bestSeconds: after.time, cleared: true };
				if (after.phase !== 'playing' || after.suspicion > GIVE_UP) continue;
				const key = spotKey(after);
				const known = next.get(key);
				if (!known || after.suspicion < known.suspicion) next.set(key, after);
			}
		}
		if (next.size === 0) break;
		alive = [...next.values()].sort((a, b) => rank(b) - rank(a)).slice(0, BEAM);
		bestSeconds = alive[0].time;
	}
	return { state: null, bestSeconds, cleared: false };
}
