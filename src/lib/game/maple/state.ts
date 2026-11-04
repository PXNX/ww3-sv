/*
 * Maple Reserve Heist rules. Every move, wait or gadget use is one tick: the cart acts, then each
 * moose acts (a heavy cart makes the guards step twice now and then). A moose that has the cart in
 * its vision cone shouts "Sorry!": a heart is lost, the barrels in tow go back on their shelves
 * and the cart returns to the start while the guards go back to their first post.
 *
 * Noise: every step of the cart is heard along the aisles. A moose in earshot stops, turns to face
 * the cart and does not walk on this tick, which delays it (and may point its cone at you). Waiting
 * is silent, a heavy cart or a golden barrel in tow is louder, and the toque makes you silent.
 */
import {
	BARREL_POINTS,
	COFFEE_TICKS,
	GOLDEN_POINTS,
	HEAVY_AT,
	HEAVY_EVERY,
	NOISE_GOLDEN_BONUS,
	NOISE_HEAVY_BONUS,
	NOISE_RADIUS,
	PAR_MOVE_POINTS,
	SPOTTED_PENALTY,
	STARTING_HEARTS,
	TOQUE_TICKS,
	UNDOS_PER_LEVEL,
	UNDO_PENALTY
} from './config.js';
import {
	DELTAS,
	aisleDistance,
	clockwise,
	directionBetween,
	isWall,
	sameCell,
	visibleCells,
	type Cell,
	type Dir,
	type GadgetKind,
	type Level
} from './level.js';

export type Phase = 'playing' | 'won' | 'over';
export type BarrelStatus = 'floor' | 'cart' | 'delivered';

export interface GuardState {
	/** Position on the route, and the way along it: 1 forward, -1 back */
	index: number;
	way: 1 | -1;
	facing: Dir;
	/** Ticks stood still at the end of a patrol, or ticks since a sentry last turned */
	rest: number;
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
	/** How many of the delivered barrels were golden */
	goldenDelivered: number;
	/** How often a moose has spotted the cart */
	spotted: number;
	/** The moose that shouted "Sorry!" on the last tick, until the next move */
	caught: number | null;
	stars: number;
	/** Whether the truck is open: true from the start unless the level has a lever */
	lever: boolean;
	/** The one gadget in hand, and what lies on each pad of the level (null once picked up) */
	gadget: GadgetKind | null;
	pads: (GadgetKind | null)[];
	/** Ticks left that the moose stand frozen and that the cart is hidden */
	freeze: number;
	hidden: number;
	/** What the last tick sounded like: where and how far, and which moose turned to look */
	noise: { cell: Cell; radius: number } | null;
	alerted: number[];
	/** Rewinds taken so far on this level */
	undosUsed: number;
}

export type MapleEvent =
	| { type: 'move' }
	| { type: 'wait' }
	| { type: 'bump' }
	| { type: 'pickup'; cell: Cell; carried: number; golden: boolean }
	| { type: 'deliver'; count: number; golden: number }
	| { type: 'locked' }
	| { type: 'lever'; cell: Cell }
	| { type: 'gadget'; kind: GadgetKind; swapped: GadgetKind | null }
	| { type: 'use'; kind: GadgetKind }
	| { type: 'noise'; cell: Cell; radius: number }
	| { type: 'alert'; guards: number[] }
	| { type: 'creak' }
	| { type: 'spotted'; guard: number; dropped: number }
	| { type: 'win' }
	| { type: 'game-over' };

/** Events that did not advance the game: nothing to rewind to, nothing to animate */
export function isTick(events: readonly MapleEvent[]): boolean {
	return events.length > 0 && !events.some((event) => event.type === 'bump');
}

function startingGuards(level: Level): GuardState[] {
	return level.guards.map((guard) => ({
		index: 0,
		way: 1,
		rest: 0,
		facing:
			guard.facing ??
			(guard.route.length > 1
				? (directionBetween(guard.route[0], guard.route[1]) ?? 'down')
				: 'down')
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
		goldenDelivered: 0,
		spotted: 0,
		caught: null,
		stars: 0,
		lever: level.lever === null,
		gadget: null,
		pads: level.pads.map((pad) => pad.kind),
		freeze: 0,
		hidden: 0,
		noise: null,
		alerted: [],
		undosUsed: 0
	};
}

/** An independent copy for look-ahead (the solver) and the rewind history; the level is shared */
export function cloneState(state: GameState): GameState {
	return {
		...state,
		cart: state.cart.map((cell) => ({ ...cell })),
		barrels: [...state.barrels],
		guards: state.guards.map((guard) => ({ ...guard })),
		pads: [...state.pads],
		alerted: [...state.alerted],
		noise: state.noise ? { cell: { ...state.noise.cell }, radius: state.noise.radius } : null
	};
}

export function rewindsLeft(state: GameState): number {
	return Math.max(0, UNDOS_PER_LEVEL - state.undosUsed);
}

/** The state to go back to, with the rewind counted; the caller keeps the history of snapshots */
export function rewound(current: GameState, snapshot: GameState): GameState {
	return { ...cloneState(snapshot), undosUsed: current.undosUsed + 1, caught: null };
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

/** How many of the barrels in tow are golden */
export function goldenInTow(state: GameState): number {
	return state.level.golden.filter((golden, index) => golden && state.barrels[index] === 'cart')
		.length;
}

/** How far a step of the cart carries along the aisles right now; 0 when it makes no noise */
export function noiseRadius(state: GameState): number {
	if (state.hidden > 0) return 0;
	return (
		NOISE_RADIUS +
		(isHeavy(state) ? NOISE_HEAVY_BONUS : 0) +
		(goldenInTow(state) > 0 ? NOISE_GOLDEN_BONUS : 0)
	);
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
		if (state.cart.some((part) => sameCell(part, at))) return guard;
		if (state.hidden > 0) continue;
		const seen = cellsSeenBy(state, guard);
		if (state.cart.some((part) => seen.some((cell) => sameCell(cell, part)))) return guard;
	}
	return -1;
}

/** The way a moose at a cell turns to face a target: along the longer distance, up and down on a tie */
function faceToward(from: Cell, to: Cell): Dir {
	const dr = to.row - from.row;
	const dc = to.col - from.col;
	if (Math.abs(dr) >= Math.abs(dc)) return dr < 0 ? 'up' : 'down';
	return dc < 0 ? 'left' : 'right';
}

/** The look of a moose that stands on its route and is about to walk along it in a way */
function routeFacing(state: GameState, guard: number): Dir {
	const route = state.level.guards[guard].route;
	const walker = state.guards[guard];
	const next = route[walker.index + walker.way];
	return (next && directionBetween(route[walker.index], next)) || walker.facing;
}

/** A moose takes one step of its routine, or turns toward a noise instead */
function stepGuard(state: GameState, guard: number, heard: boolean) {
	const spec = state.level.guards[guard];
	const walker = state.guards[guard];
	const at = guardCell(state, guard);
	if (heard) {
		walker.facing = faceToward(at, state.cart[0]);
		return;
	}
	if (spec.mode === 'sentry') {
		walker.rest += 1;
		if (walker.rest >= spec.turnEvery) {
			walker.rest = 0;
			walker.facing = clockwise(walker.facing);
		}
		return;
	}
	if (spec.mode === 'loop') {
		const next = (walker.index + 1) % spec.route.length;
		walker.facing = directionBetween(spec.route[walker.index], spec.route[next]) ?? walker.facing;
		walker.index = next;
		return;
	}
	const next = walker.index + walker.way;
	if (next < 0 || next >= spec.route.length) {
		// At the end of the route: stand a while, then turn around
		if (walker.rest < spec.dwell) {
			walker.rest += 1;
			return;
		}
		walker.rest = 0;
		walker.way = walker.way === 1 ? -1 : 1;
		walker.facing = routeFacing(state, guard);
		return;
	}
	walker.facing = directionBetween(spec.route[walker.index], spec.route[next]) ?? walker.facing;
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
	state.freeze = 0;
	state.hidden = 0;
	state.noise = null;
	state.alerted = [];
	const events: MapleEvent[] = [{ type: 'spotted', guard, dropped }];
	if (state.hearts <= 0) {
		state.phase = 'over';
		events.push({ type: 'game-over' });
	}
	return events;
}

/** The moose within earshot of a step, who stop to look instead of walking on */
function listeners(state: GameState, radius: number): number[] {
	if (radius <= 0) return [];
	const head = state.cart[0];
	return state.level.guards.flatMap((_guard, guard) =>
		aisleDistance(state.level, guardCell(state, guard), head, radius) <= radius ? [guard] : []
	);
}

/** The guards act after the cart: the creak of a heavy cart gives them an extra step */
function guardsAct(state: GameState, events: MapleEvent[], heard: number[]) {
	const frozen = state.freeze > 0;
	if (frozen) state.freeze -= 1;
	const heavyStep = !frozen && isHeavy(state) && state.moves % HEAVY_EVERY === 0;
	if (heavyStep) events.push({ type: 'creak' });
	for (let tick = 0; tick < (heavyStep ? 2 : 1); tick++) {
		if (!frozen) {
			state.level.guards.forEach((_guard, guard) =>
				stepGuard(state, guard, tick === 0 && heard.includes(guard))
			);
		}
		const seen = spottedBy(state);
		if (seen >= 0) {
			events.push(...sendBack(state, seen));
			return;
		}
	}
	if (state.hidden > 0) state.hidden -= 1;
}

export interface ScoreBreakdown {
	barrels: number;
	golden: number;
	underPar: number;
	spotted: number;
	rewinds: number;
	total: number;
}

/** Where the points came from, so the result can show every line of the sum */
export function scoreBreakdown(state: GameState): ScoreBreakdown {
	const underPar = state.phase === 'won' ? Math.max(0, state.level.par - state.moves) : 0;
	const barrels = state.delivered * BARREL_POINTS;
	const golden = state.goldenDelivered * (GOLDEN_POINTS - BARREL_POINTS);
	const parPoints = underPar * PAR_MOVE_POINTS;
	const spotted = state.spotted * SPOTTED_PENALTY;
	const rewinds = state.undosUsed * UNDO_PENALTY;
	return {
		barrels,
		golden,
		underPar: parPoints,
		spotted,
		rewinds,
		total: Math.max(0, barrels + golden + parPoints - spotted - rewinds)
	};
}

export function scoreOf(state: GameState): number {
	return scoreBreakdown(state).total;
}

/** Stars: every barrel delivered, at or under par moves, and never spotted (one at least for a win) */
export function starsFor(state: GameState): number {
	const total = state.level.barrels.length;
	const earned = [state.delivered >= total, state.moves <= state.level.par, state.spotted === 0];
	return Math.max(1, earned.filter(Boolean).length);
}

/** What stands on a cell the cart cannot enter: a shelf, or one of its own wagons */
function blocked(state: GameState, cell: Cell): boolean {
	if (isWall(state.level, cell)) return true;
	// The last wagon moves on in the same step, so only the others are in the way
	return state.cart.slice(0, -1).some((part) => sameCell(part, cell));
}

/** Picks up or swaps the gadget on the pad under the cart, if there is one worth taking */
function takeGadget(state: GameState, target: Cell, events: MapleEvent[]) {
	const pad = state.level.pads.findIndex((candidate) => sameCell(candidate.cell, target));
	const lying = pad >= 0 ? state.pads[pad] : null;
	if (pad < 0 || lying === null || lying === state.gadget) return;
	const swapped = state.gadget;
	state.pads[pad] = swapped;
	state.gadget = lying;
	events.push({ type: 'gadget', kind: lying, swapped });
}

/** Pushes the cart one cell. Walking into a shelf or the cart itself costs no tick. */
export function move(state: GameState, dir: Dir): MapleEvent[] {
	if (state.phase !== 'playing') return [];
	const head = state.cart[0];
	const target = { row: head.row + DELTAS[dir].row, col: head.col + DELTAS[dir].col };
	if (blocked(state, target)) return [{ type: 'bump' }];

	state.caught = null;
	state.noise = null;
	state.alerted = [];
	state.moves += 1;
	const events: MapleEvent[] = [{ type: 'move' }];
	const barrel = state.level.barrels.findIndex(
		(cell, index) => state.barrels[index] === 'floor' && sameCell(cell, target)
	);
	if (barrel >= 0) {
		// The new barrel joins the cart's tail, so the cart keeps every cell and grows by one
		state.barrels[barrel] = 'cart';
		state.cart = [target, ...state.cart];
		events.push({
			type: 'pickup',
			cell: target,
			carried: carried(state),
			golden: state.level.golden[barrel]
		});
	} else {
		state.cart = [target, ...state.cart.slice(0, -1)];
	}

	takeGadget(state, target, events);
	if (state.level.lever && !state.lever && sameCell(target, state.level.lever)) {
		state.lever = true;
		events.push({ type: 'lever', cell: target });
	}

	if (sameCell(target, state.level.truck) && carried(state) > 0) {
		if (!state.lever) {
			events.push({ type: 'locked' });
		} else {
			const count = carried(state);
			const golden = goldenInTow(state);
			state.delivered += count;
			state.goldenDelivered += golden;
			state.barrels = state.barrels.map((status) => (status === 'cart' ? 'delivered' : status));
			state.cart = [target];
			events.push({ type: 'deliver', count, golden });
			if (state.delivered >= state.level.quota) {
				state.phase = 'won';
				state.stars = starsFor(state);
				events.push({ type: 'win' });
				return events;
			}
		}
	}

	// Walking into a moose is spotted at once; the cones are checked after the guards stepped
	const bumped = state.level.guards.findIndex((_guard, guard) =>
		state.cart.some((part) => sameCell(part, guardCell(state, guard)))
	);
	if (bumped >= 0) {
		events.push(...sendBack(state, bumped));
		return events;
	}
	const radius = noiseRadius(state);
	const heard = state.freeze > 0 ? [] : listeners(state, radius);
	if (radius > 0) {
		state.noise = { cell: target, radius };
		events.push({ type: 'noise', cell: target, radius });
	}
	if (heard.length > 0) {
		state.alerted = heard;
		events.push({ type: 'alert', guards: heard });
	}
	guardsAct(state, events, heard);
	return events;
}

/** Stands still for a tick, to let the guards walk on */
export function wait(state: GameState): MapleEvent[] {
	if (state.phase !== 'playing') return [];
	state.caught = null;
	state.noise = null;
	state.alerted = [];
	state.moves += 1;
	const events: MapleEvent[] = [{ type: 'wait' }];
	guardsAct(state, events, []);
	return events;
}

/**
 * Uses the gadget in hand, which takes a tick: coffee freezes the moose where they stand (their
 * cones stay on, so do not stand in one), the toque hides the cart from cones and from ears.
 * Nothing in hand costs nothing.
 */
export function useGadget(state: GameState): MapleEvent[] {
	if (state.phase !== 'playing' || state.gadget === null) return [];
	const kind = state.gadget;
	state.gadget = null;
	state.caught = null;
	state.noise = null;
	state.alerted = [];
	state.moves += 1;
	if (kind === 'coffee') state.freeze = COFFEE_TICKS;
	else state.hidden = TOQUE_TICKS;
	const events: MapleEvent[] = [{ type: 'use', kind }];
	guardsAct(state, events, []);
	return events;
}
