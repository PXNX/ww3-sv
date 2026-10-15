/*
 * Maple Reserve Heist rules. Every move or wait is one tick: the cart steps, then each moose
 * steps (a heavy cart makes the guards step twice now and then). A moose that has the cart in
 * its vision cone shouts "Sorry!": a heart is lost, the barrels in tow go back on their shelves
 * and the cart returns to the start while the guards go back to their first post.
 */
import {
	BARREL_POINTS,
	HEAVY_AT,
	HEAVY_EVERY,
	PAR_MOVE_POINTS,
	SPOTTED_PENALTY,
	STARTING_HEARTS
} from './config.js';
import {
	DELTAS,
	directionBetween,
	isWall,
	opposite,
	sameCell,
	visibleCells,
	type Cell,
	type Dir,
	type Level
} from './level.js';

export type Phase = 'playing' | 'won' | 'over';
export type BarrelStatus = 'floor' | 'cart' | 'delivered';

export interface GuardState {
	/** Position on the route, and the way along it: 1 forward, -1 back */
	index: number;
	way: 1 | -1;
	facing: Dir;
}

export interface GameState {
	level: Level;
	phase: Phase;
	hearts: number;
	/** The cart: the head the player steers followed by one cell for every barrel in tow */
	cart: Cell[];
	barrels: BarrelStatus[];
	guards: GuardState[];
	moves: number;
	delivered: number;
	/** How often a moose has spotted the cart */
	spotted: number;
	/** The moose that shouted "Sorry!" on the last tick, until the next move */
	caught: number | null;
	stars: number;
}

export type MapleEvent =
	| { type: 'move' }
	| { type: 'wait' }
	| { type: 'bump' }
	| { type: 'pickup'; cell: Cell; carried: number }
	| { type: 'deliver'; count: number }
	| { type: 'creak' }
	| { type: 'spotted'; guard: number; dropped: number }
	| { type: 'win' }
	| { type: 'game-over' };

function startingGuards(level: Level): GuardState[] {
	return level.guards.map((guard) => ({
		index: 0,
		way: 1,
		facing:
			guard.route.length > 1 ? (directionBetween(guard.route[0], guard.route[1]) ?? 'down') : 'down'
	}));
}

export function createGame(level: Level): GameState {
	return {
		level,
		phase: 'playing',
		hearts: STARTING_HEARTS,
		cart: [level.start],
		barrels: level.barrels.map(() => 'floor'),
		guards: startingGuards(level),
		moves: 0,
		delivered: 0,
		spotted: 0,
		caught: null,
		stars: 0
	};
}

/** An independent copy for look-ahead (the solver); the level itself is shared */
export function cloneState(state: GameState): GameState {
	return {
		...state,
		cart: state.cart.map((cell) => ({ ...cell })),
		barrels: [...state.barrels],
		guards: state.guards.map((guard) => ({ ...guard }))
	};
}

export function guardCell(state: GameState, guard: number): Cell {
	return state.level.guards[guard].route[state.guards[guard].index];
}

/** Barrels in tow, which is also the number of cells the cart has behind its head */
export function carried(state: GameState): number {
	return state.cart.length - 1;
}

export function isHeavy(state: GameState): boolean {
	return carried(state) >= HEAVY_AT;
}

export function cellsSeenBy(state: GameState, guard: number): Cell[] {
	const { facing } = state.guards[guard];
	return visibleCells(
		state.level,
		guardCell(state, guard),
		facing,
		state.level.guards[guard].range
	);
}

/** The first moose that has any part of the cart in sight (or underfoot), -1 when none does */
export function spottedBy(state: GameState): number {
	for (let guard = 0; guard < state.guards.length; guard++) {
		const at = guardCell(state, guard);
		const seen = cellsSeenBy(state, guard);
		if (
			state.cart.some((part) => sameCell(part, at) || seen.some((cell) => sameCell(cell, part)))
		) {
			return guard;
		}
	}
	return -1;
}

/** A moose takes one step along its route, or turns around at the end of it */
function stepGuard(state: GameState, guard: number) {
	const route = state.level.guards[guard].route;
	const walker = state.guards[guard];
	const next = walker.index + walker.way;
	if (next < 0 || next >= route.length) {
		walker.way = walker.way === 1 ? -1 : 1;
		walker.facing = opposite(walker.facing);
		return;
	}
	walker.facing = directionBetween(route[walker.index], route[next]) ?? walker.facing;
	walker.index = next;
}

function dropBarrels(state: GameState): number {
	let dropped = 0;
	state.barrels = state.barrels.map((status) => {
		if (status !== 'cart') return status;
		dropped += 1;
		return 'floor';
	});
	return dropped;
}

function sendBack(state: GameState, guard: number): MapleEvent[] {
	const dropped = dropBarrels(state);
	state.hearts -= 1;
	state.spotted += 1;
	state.caught = guard;
	state.cart = [state.level.start];
	state.guards = startingGuards(state.level);
	const events: MapleEvent[] = [{ type: 'spotted', guard, dropped }];
	if (state.hearts <= 0) {
		state.phase = 'over';
		events.push({ type: 'game-over' });
	}
	return events;
}

/** The guards act after the cart: the creak of a heavy cart gives them an extra step */
function guardsAct(state: GameState, events: MapleEvent[]) {
	const heavyStep = isHeavy(state) && state.moves % HEAVY_EVERY === 0;
	if (heavyStep) events.push({ type: 'creak' });
	for (let tick = 0; tick < (heavyStep ? 2 : 1); tick++) {
		state.level.guards.forEach((_guard, guard) => stepGuard(state, guard));
		const seen = spottedBy(state);
		if (seen >= 0) {
			events.push(...sendBack(state, seen));
			return;
		}
	}
}

/** Stars: every barrel delivered, at or under par moves, and never spotted (one at least for a win) */
export function starsFor(state: GameState): number {
	const total = state.level.barrels.length;
	const earned = [state.delivered >= total, state.moves <= state.level.par, state.spotted === 0];
	return Math.max(1, earned.filter(Boolean).length);
}

export function scoreOf(state: GameState): number {
	const underPar = state.phase === 'won' ? Math.max(0, state.level.par - state.moves) : 0;
	const points = state.delivered * BARREL_POINTS + underPar * PAR_MOVE_POINTS;
	return Math.max(0, points - state.spotted * SPOTTED_PENALTY);
}

/** What stands on a cell the cart cannot enter: a shelf, or one of its own wagons */
function blocked(state: GameState, cell: Cell): boolean {
	if (isWall(state.level, cell)) return true;
	// The last wagon moves on in the same step, so only the others are in the way
	return state.cart.slice(0, -1).some((part) => sameCell(part, cell));
}

/** Pushes the cart one cell. Walking into a shelf or the cart itself costs no tick. */
export function move(state: GameState, dir: Dir): MapleEvent[] {
	if (state.phase !== 'playing') return [];
	const head = state.cart[0];
	const target = { row: head.row + DELTAS[dir].row, col: head.col + DELTAS[dir].col };
	if (blocked(state, target)) return [{ type: 'bump' }];

	state.caught = null;
	state.moves += 1;
	const events: MapleEvent[] = [{ type: 'move' }];
	const barrel = state.level.barrels.findIndex(
		(cell, index) => state.barrels[index] === 'floor' && sameCell(cell, target)
	);
	if (barrel >= 0) {
		// The new barrel joins the cart's tail, so the cart keeps every cell and grows by one
		state.barrels[barrel] = 'cart';
		state.cart = [target, ...state.cart];
		events.push({ type: 'pickup', cell: target, carried: carried(state) });
	} else {
		state.cart = [target, ...state.cart.slice(0, -1)];
	}

	if (sameCell(target, state.level.truck) && carried(state) > 0) {
		const count = carried(state);
		state.delivered += count;
		state.barrels = state.barrels.map((status) => (status === 'cart' ? 'delivered' : status));
		state.cart = [target];
		events.push({ type: 'deliver', count });
		if (state.delivered >= state.level.quota) {
			state.phase = 'won';
			state.stars = starsFor(state);
			events.push({ type: 'win' });
			return events;
		}
	}

	// Walking into a moose is spotted at once; the cones are checked after the guards stepped
	const bumped = state.level.guards.findIndex((_guard, guard) =>
		state.cart.some((part) => sameCell(part, guardCell(state, guard)))
	);
	if (bumped >= 0) events.push(...sendBack(state, bumped));
	else guardsAct(state, events);
	return events;
}

/** Stands still for a tick, to let the guards walk on */
export function wait(state: GameState): MapleEvent[] {
	if (state.phase !== 'playing') return [];
	state.caught = null;
	state.moves += 1;
	const events: MapleEvent[] = [{ type: 'wait' }];
	guardsAct(state, events);
	return events;
}
