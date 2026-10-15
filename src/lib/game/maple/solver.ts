/*
 * Breadth-first solver, used by the tests to prove that every level can be finished cleanly: it
 * looks for the fewest ticks that bring every barrel to the truck without a single spotting.
 * Waiting is allowed, because letting a moose walk on is part of the puzzle.
 */
import { DIRS, type Dir, type Level } from './level.js';
import { cloneState, createGame, move, wait, type GameState } from './state.js';

export type Action = Dir | 'wait';

export interface Solution {
	moves: number;
	actions: Action[];
}

function keyOf(state: GameState): string {
	const cart = state.cart.map((cell) => `${cell.row},${cell.col}`).join(';');
	const guards = state.guards.map((guard) => `${guard.index}${guard.way}`).join('');
	return `${cart}|${state.barrels.map((status) => status[0]).join('')}|${guards}`;
}

/** The shortest clean run that delivers every barrel, null when there is none within the limit */
export function solve(level: Level, limit = 400_000): Solution | null {
	const start = createGame(level);
	const seen = new Set([keyOf(start)]);
	let frontier: { state: GameState; actions: Action[] }[] = [{ state: start, actions: [] }];
	let visited = 0;
	while (frontier.length > 0) {
		const next: typeof frontier = [];
		for (const { state, actions } of frontier) {
			for (const action of [...DIRS, 'wait'] as const) {
				const copy = cloneState(state);
				const events = action === 'wait' ? wait(copy) : move(copy, action);
				if (events.some((event) => event.type === 'bump')) continue;
				if (copy.spotted > 0) continue;
				const path = [...actions, action];
				if (copy.phase === 'won') {
					if (copy.delivered >= level.barrels.length) return { moves: path.length, actions: path };
					continue;
				}
				const key = keyOf(copy);
				if (seen.has(key)) continue;
				seen.add(key);
				if (++visited > limit) return null;
				next.push({ state: copy, actions: path });
			}
		}
		frontier = next;
	}
	return null;
}
