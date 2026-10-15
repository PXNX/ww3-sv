import { describe, expect, it } from 'vitest';
import {
	BARREL_POINTS,
	HEAVY_AT,
	PAR_MOVE_POINTS,
	SPOTTED_PENALTY,
	STARTING_HEARTS
} from './config.js';
import { parseLevel, type Dir, type LevelSpec } from './level.js';
import {
	carried,
	cellsSeenBy,
	cloneState,
	createGame,
	guardCell,
	isHeavy,
	move,
	scoreOf,
	spottedBy,
	starsFor,
	wait,
	type GameState
} from './state.js';

function game(spec: Partial<LevelSpec> & Pick<LevelSpec, 'map'>): GameState {
	return createGame(parseLevel({ id: 'test', guards: [], quota: 1, par: 99, ...spec }));
}

function walk(state: GameState, ...dirs: Dir[]) {
	for (const dir of dirs) move(state, dir);
}

/** A lane of moose-free aisle with one barrel, and a truck at the end */
const lane = () => ({ map: ['#######', '#S.B.T#', '#######'] });

/** Two aisles: the cart's on row 1 and a moose walks along row 2 */
const patrol = () => ({
	map: ['#######', '#SB..T#', '#.....#', '#######'],
	guards: [
		{
			waypoints: [
				[2, 1],
				[2, 5]
			] as [number, number][]
		}
	]
});

describe('moving the cart', () => {
	it('steps one cell per move and counts the tick', () => {
		const state = game(lane());
		expect(move(state, 'right')).toEqual([{ type: 'move' }]);
		expect(state.cart[0]).toEqual({ row: 1, col: 2 });
		expect(state.moves).toBe(1);
	});

	it('bumps into shelves for free', () => {
		const state = game(lane());
		expect(move(state, 'up')).toEqual([{ type: 'bump' }]);
		expect(move(state, 'left')).toEqual([{ type: 'bump' }]);
		expect(state.moves).toBe(0);
		expect(state.cart[0]).toEqual({ row: 1, col: 1 });
	});

	it('picks up a barrel and grows by one cell', () => {
		const state = game(lane());
		walk(state, 'right');
		const events = move(state, 'right');
		expect(events).toContainEqual({ type: 'pickup', cell: { row: 1, col: 3 }, carried: 1 });
		expect(carried(state)).toBe(1);
		expect(state.barrels).toEqual(['cart']);
		expect(state.cart).toEqual([
			{ row: 1, col: 3 },
			{ row: 1, col: 2 }
		]);
	});

	it('drags the barrels behind like a snake', () => {
		const state = game({ map: ['#####', '#SB.#', '#..T#', '#####'], quota: 2 });
		walk(state, 'right', 'down');
		expect(state.cart.map((cell) => `${cell.row},${cell.col}`)).toEqual(['2,2', '1,2']);
		walk(state, 'left');
		expect(state.cart.map((cell) => `${cell.row},${cell.col}`)).toEqual(['2,1', '2,2']);
	});

	it('cannot drive into its own barrels, but may follow its tail', () => {
		const state = game({ map: ['########', '#SBB..T#', '########'], quota: 3 });
		walk(state, 'right', 'right');
		const before = state.moves;
		expect(move(state, 'left')).toEqual([{ type: 'bump' }]);
		expect(state.moves).toBe(before);
		const turn = game({ map: ['#####', '#SB.#', '#..T#', '#####'], quota: 3 });
		walk(turn, 'right');
		expect(move(turn, 'left')).toContainEqual({ type: 'move' });
		expect(turn.cart[0]).toEqual({ row: 1, col: 1 });
	});

	it('does nothing once the level is over', () => {
		const state = game(lane());
		state.phase = 'over';
		expect(move(state, 'right')).toEqual([]);
		expect(wait(state)).toEqual([]);
		expect(state.moves).toBe(0);
	});
});

describe('delivering', () => {
	it('unloads at the truck and wins when the quota is met', () => {
		const state = game(lane());
		walk(state, 'right', 'right', 'right');
		const events = move(state, 'right');
		expect(events).toContainEqual({ type: 'deliver', count: 1 });
		expect(events).toContainEqual({ type: 'win' });
		expect(state.phase).toBe('won');
		expect(state.delivered).toBe(1);
		expect(state.barrels).toEqual(['delivered']);
		expect(carried(state)).toBe(0);
	});

	it('drives through an empty truck without delivering', () => {
		const state = game({ map: ['#######', '#ST.B.#', '#######'] });
		walk(state, 'right');
		expect(state.delivered).toBe(0);
		expect(state.phase).toBe('playing');
	});

	it('keeps playing after a delivery that does not reach the quota', () => {
		const state = game({ map: ['#######', '#SBTB.#', '#######'], quota: 2 });
		walk(state, 'right', 'right');
		expect(state.delivered).toBe(1);
		expect(state.phase).toBe('playing');
		walk(state, 'right', 'right');
		expect(carried(state)).toBe(1);
		walk(state, 'left', 'left');
		expect(state.delivered).toBe(2);
		expect(state.phase).toBe('won');
	});
});

describe('guards', () => {
	it('walk their route one step per tick, then turn around', () => {
		const state = game({
			map: ['#####', '#S.T#', '#...#', '#####'],
			guards: [
				{
					waypoints: [
						[2, 1],
						[2, 2]
					]
				}
			]
		});
		expect(guardCell(state, 0)).toEqual({ row: 2, col: 1 });
		expect(state.guards[0].facing).toBe('right');
		wait(state);
		expect(guardCell(state, 0)).toEqual({ row: 2, col: 2 });
		wait(state);
		// A turn takes a tick on the spot
		expect(guardCell(state, 0)).toEqual({ row: 2, col: 2 });
		expect(state.guards[0].facing).toBe('left');
		wait(state);
		expect(guardCell(state, 0)).toEqual({ row: 2, col: 1 });
	});

	it('wait costs a move', () => {
		const state = game(patrol());
		expect(wait(state)).toContainEqual({ type: 'wait' });
		expect(state.moves).toBe(1);
	});

	it('see in a cone ahead of them and not behind', () => {
		const state = game(patrol());
		const seen = cellsSeenBy(state, 0).map((cell) => `${cell.row},${cell.col}`);
		expect(seen).toContain('2,2');
		expect(seen).toContain('2,4');
		expect(seen).toContain('1,3');
		expect(seen).not.toContain('2,0');
		expect(spottedBy(state)).toBe(-1);
	});

	it('spot the cart in the cone: a heart is lost and the barrels go back', () => {
		const state = game(patrol());
		move(state, 'right'); // picks up the barrel next to the moose
		expect(state.barrels).toEqual(['cart']);
		const events = move(state, 'down'); // straight into the moose
		expect(events).toContainEqual({ type: 'spotted', guard: 0, dropped: 1 });
		expect(state.hearts).toBe(STARTING_HEARTS - 1);
		expect(state.spotted).toBe(1);
		expect(state.caught).toBe(0);
		expect(state.barrels).toEqual(['floor']);
		expect(state.cart).toEqual([state.level.start]);
		expect(guardCell(state, 0)).toEqual({ row: 2, col: 1 });
	});

	it('spot a cart that steps into their sight', () => {
		const state = game({
			map: ['#######', '#S....#', '#.....#', '#T....#', '#######'],
			guards: [
				{
					waypoints: [
						[3, 5],
						[3, 2]
					]
				}
			]
		});
		move(state, 'down');
		move(state, 'down'); // now in the truck's row, in front of the moose walking toward it
		expect(state.spotted).toBeGreaterThan(0);
		expect(state.cart).toEqual([state.level.start]);
	});

	it('clear the caught marker with the next move', () => {
		const state = game(patrol());
		move(state, 'down');
		expect(state.caught).toBe(0);
		move(state, 'right');
		expect(state.caught).toBeNull();
	});

	it('end the game when the last heart is gone', () => {
		const state = game(patrol());
		for (let i = 0; i < STARTING_HEARTS; i++) move(state, 'down');
		expect(state.hearts).toBe(0);
		expect(state.phase).toBe('over');
		expect(move(state, 'right')).toEqual([]);
	});

	it('are no problem for a cart that stays out of their sight', () => {
		const state = game({
			map: ['#########', '#SB..T###', '#########', '#.......#', '#########'],
			guards: [
				{
					waypoints: [
						[3, 1],
						[3, 7]
					]
				}
			],
			quota: 1
		});
		walk(state, 'right', 'right', 'right', 'right');
		expect(state.phase).toBe('won');
		expect(state.spotted).toBe(0);
	});
});

describe('a heavy cart', () => {
	const heavy = () =>
		game({
			map: ['###########', '#SBBBB..T##', '###########', '#.........#', '###########'],
			guards: [
				{
					waypoints: [
						[3, 1],
						[3, 9]
					]
				}
			],
			quota: 4
		});

	it('is heavy from the third barrel on', () => {
		const state = heavy();
		walk(state, 'right', 'right');
		expect(isHeavy(state)).toBe(false);
		walk(state, 'right');
		expect(carried(state)).toBe(HEAVY_AT);
		expect(isHeavy(state)).toBe(true);
	});

	it('creaks every other step and lets the guards take an extra step', () => {
		const state = heavy();
		walk(state, 'right', 'right', 'right');
		const before = state.guards[0].index;
		const events = move(state, 'right');
		expect(events).toContainEqual({ type: 'creak' });
		expect(state.guards[0].index - before).toBe(2);
		const quiet = move(state, 'right');
		expect(quiet).not.toContainEqual({ type: 'creak' });
	});
});

describe('stars and score', () => {
	it('gives three stars for every barrel, under par and unseen', () => {
		const state = game({ ...lane(), par: 4 });
		walk(state, 'right', 'right', 'right', 'right');
		expect(state.moves).toBe(4);
		expect(state.stars).toBe(3);
	});

	it('takes a star for every barrel left behind, for going over par and for being spotted', () => {
		const slow = game({ ...lane(), par: 3 });
		walk(slow, 'right', 'right', 'right', 'right');
		expect(slow.stars).toBe(2);

		const partial = game({ map: ['########', '#SB.B.T#', '########'], quota: 1, par: 99 });
		walk(partial, 'right', 'left', 'left'); // not enough: back to the start, no truck
		expect(starsFor(partial)).toBe(2);
	});

	it('always gives a won level at least one star', () => {
		const state = game({ ...lane(), par: 1 });
		state.spotted = 2;
		state.delivered = 0;
		expect(starsFor(state)).toBe(1);
	});

	it('scores barrels and moves under par, minus spottings', () => {
		const state = game({ ...lane(), par: 10 });
		expect(scoreOf(state)).toBe(0);
		walk(state, 'right', 'right', 'right', 'right');
		expect(scoreOf(state)).toBe(BARREL_POINTS + 6 * PAR_MOVE_POINTS);
		state.spotted = 1;
		expect(scoreOf(state)).toBe(BARREL_POINTS + 6 * PAR_MOVE_POINTS - SPOTTED_PENALTY);
		state.spotted = 99;
		expect(scoreOf(state)).toBe(0);
	});
});

describe('cloneState', () => {
	it('copies what changes, so look-ahead leaves the original alone', () => {
		const state = game(patrol());
		const copy = cloneState(state);
		move(copy, 'right');
		expect(state.cart).toHaveLength(1);
		expect(state.moves).toBe(0);
		expect(state.barrels).toEqual(['floor']);
		expect(state.guards[0].index).toBe(0);
	});
});
