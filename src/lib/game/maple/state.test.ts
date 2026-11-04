import { describe, expect, it } from 'vitest';
import {
	BARREL_POINTS,
	HEAVY_AT,
	PAR_MOVE_POINTS,
	SPOTTED_PENALTY,
	STARTING_HEARTS,
	COFFEE_TICKS,
	GOLDEN_POINTS,
	NOISE_RADIUS,
	TOQUE_TICKS,
	UNDOS_PER_LEVEL,
	UNDO_PENALTY
} from './config.js';
import { aisleDistance, parseLevel, type Dir, type LevelSpec } from './level.js';
import {
	carried,
	cellsSeenBy,
	cloneState,
	createGame,
	goldenInTow,
	noiseRadius,
	guardCell,
	isHeavy,
	move,
	rewindsLeft,
	rewound,
	scoreBreakdown,
	useGadget,
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
		expect(move(state, 'right')).toContainEqual({ type: 'move' });
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
		expect(events).toContainEqual({
			type: 'pickup',
			cell: { row: 1, col: 3 },
			carried: 1,
			golden: false
		});
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
		expect(events).toContainEqual({ type: 'deliver', count: 1, golden: 0 });
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

describe('guard routines', () => {
	const hall = ['#########', '#S.....T#', '#.......#', '#########'];

	it('a sentry stays put and turns clockwise on schedule', () => {
		const state = game({
			map: hall,
			guards: [{ mode: 'sentry', waypoints: [[2, 4]], facing: 'up', turnEvery: 2 }]
		});
		const facings: string[] = [];
		for (let i = 0; i < 4; i++) {
			state.cart = [{ row: 1, col: 1 }];
			wait(state);
			facings.push(state.guards[0].facing);
		}
		expect(facings).toEqual(['up', 'right', 'right', 'down']);
		expect(guardCell(state, 0)).toEqual({ row: 2, col: 4 });
	});

	it('a loop walks around and never turns back', () => {
		const state = game({
			map: ['######', '#S..T#', '#....#', '######'],
			guards: [
				{
					mode: 'loop',
					waypoints: [
						[1, 3],
						[2, 3],
						[2, 2],
						[1, 2]
					]
				}
			]
		});
		const cells: string[] = [];
		for (let i = 0; i < 5; i++) {
			cells.push(`${guardCell(state, 0).row},${guardCell(state, 0).col}`);
			state.cart = [{ row: 1, col: 1 }];
			state.hidden = 9;
			wait(state);
		}
		expect(cells).toEqual(['1,3', '2,3', '2,2', '1,2', '1,3']);
	});

	it('a patrol stands still at the ends for its dwell time', () => {
		const state = game({
			map: ['#######', '#S...T#', '#.....#', '#######'],
			guards: [
				{
					dwell: 2,
					waypoints: [
						[2, 4],
						[2, 5]
					]
				}
			]
		});
		const cells: number[] = [];
		for (let i = 0; i < 6; i++) {
			state.hidden = 9;
			wait(state);
			cells.push(guardCell(state, 0).col);
		}
		// Steps to the end, stands for two ticks and the turn, then walks back
		expect(cells).toEqual([5, 5, 5, 5, 4, 4]);
	});
});

describe('noise', () => {
	const aisle = () => ({
		map: ['#########', '#S.....T#', '#.#####.#', '#.......#', '#########'],
		guards: [
			{
				mode: 'sentry' as const,
				waypoints: [[3, 4]] as [number, number][],
				facing: 'up' as const,
				turnEvery: 99
			}
		]
	});

	it('makes a moose in earshot turn to face the cart', () => {
		const state = game(aisle());
		state.cart = [{ row: 3, col: 2 }];
		state.hidden = 0;
		const events = move(state, 'right');
		expect(events).toContainEqual({ type: 'alert', guards: [0] });
		// The moose turned to the noise and now has the cart in its cone
		expect(events).toContainEqual({ type: 'spotted', guard: 0, dropped: 0 });
	});

	it('is silent when waiting, and out of range does nothing', () => {
		const state = game(aisle());
		state.cart = [{ row: 3, col: 3 }];
		expect(wait(state)).not.toContainEqual(expect.objectContaining({ type: 'alert' }));
		const far = game(aisle());
		const events = move(far, 'right');
		expect(events).not.toContainEqual(expect.objectContaining({ type: 'alert' }));
		expect(far.noise?.radius).toBe(NOISE_RADIUS);
	});

	it('does not travel through shelves, and is louder for a golden barrel', () => {
		const state = game({
			...aisle(),
			map: ['#########', '#SG....T#', '#.#####.#', '#.......#', '#########']
		});
		expect(noiseRadius(state)).toBe(NOISE_RADIUS);
		move(state, 'right');
		expect(noiseRadius(state)).toBe(NOISE_RADIUS + 1);
		expect(goldenInTow(state)).toBe(1);
		expect(aisleDistance(state.level, { row: 1, col: 2 }, { row: 3, col: 2 }, 2)).toBe(Infinity);
	});
});

describe('gadgets', () => {
	const pads = () => ({
		map: ['#########', '#SCH...T#', '#.......#', '#########'],
		guards: [
			{
				mode: 'sentry' as const,
				waypoints: [[2, 7]] as [number, number][],
				facing: 'up' as const,
				turnEvery: 99
			}
		]
	});

	it('picks up a gadget from a pad, and swaps with the one in hand', () => {
		const state = game(pads());
		expect(move(state, 'right')).toContainEqual({ type: 'gadget', kind: 'coffee', swapped: null });
		expect(state.gadget).toBe('coffee');
		expect(state.pads[0]).toBeNull();
		expect(move(state, 'right')).toContainEqual({
			type: 'gadget',
			kind: 'toque',
			swapped: 'coffee'
		});
		expect(state.gadget).toBe('toque');
		expect(state.pads[1]).toBe('coffee');
	});

	it('coffee freezes the moose for a few ticks and costs a tick', () => {
		const state = game({
			map: ['#########', '#SC....T#', '#.......#', '#########'],
			guards: [
				{
					waypoints: [
						[2, 7],
						[2, 3]
					]
				}
			]
		});
		move(state, 'right');
		const moves = state.moves;
		expect(useGadget(state)).toContainEqual({ type: 'use', kind: 'coffee' });
		expect(state.moves).toBe(moves + 1);
		expect(state.gadget).toBeNull();
		expect(state.freeze).toBe(COFFEE_TICKS - 1);
		const at = { ...guardCell(state, 0) };
		for (let i = 0; i < COFFEE_TICKS - 1; i++) {
			state.cart = [{ row: 1, col: 1 }];
			wait(state);
			expect(guardCell(state, 0)).toEqual(at);
		}
		state.cart = [{ row: 1, col: 1 }];
		state.hidden = 9;
		wait(state);
		expect(guardCell(state, 0)).not.toEqual(at);
	});

	it('the toque hides the cart from cones and makes no noise, then wears off', () => {
		const state = game({
			map: ['#########', '#SH....T#', '#.......#', '#########'],
			guards: [{ mode: 'sentry', waypoints: [[1, 6]], facing: 'left', turnEvery: 99 }]
		});
		move(state, 'right');
		useGadget(state);
		expect(state.hidden).toBeGreaterThan(0);
		const events = move(state, 'right');
		expect(events).not.toContainEqual(expect.objectContaining({ type: 'noise' }));
		expect(state.spotted).toBe(0);
		for (let i = 0; i < TOQUE_TICKS; i++) {
			state.cart = [{ row: 2, col: 1 }];
			wait(state);
		}
		expect(state.hidden).toBe(0);
	});

	it('using nothing costs nothing', () => {
		const state = game(pads());
		expect(useGadget(state)).toEqual([]);
		expect(state.moves).toBe(0);
	});
});

describe('the lever', () => {
	it('keeps the truck locked until it is pulled, and says so', () => {
		const state = game({ map: ['#########', '#SBTL...#', '#########'] });
		walk(state, 'right');
		const events = move(state, 'right');
		expect(events).toContainEqual({ type: 'locked' });
		expect(state.delivered).toBe(0);
		expect(state.phase).toBe('playing');
		expect(state.lever).toBe(false);
	});

	it('opens the truck once pulled', () => {
		const state = game({ map: ['#########', '#SBL..T.#', '#########'] });
		walk(state, 'right');
		const pull = move(state, 'right');
		expect(pull).toContainEqual({ type: 'lever', cell: { row: 1, col: 3 } });
		expect(state.lever).toBe(true);
		walk(state, 'right', 'right', 'right');
		expect(state.phase).toBe('won');
	});
});

describe('golden barrels, rewinds and the breakdown', () => {
	it('count for more points', () => {
		const state = game({ map: ['#######', '#SG.T##', '#######'], par: 3 });
		walk(state, 'right', 'right', 'right');
		expect(state.goldenDelivered).toBe(1);
		const lines = scoreBreakdown(state);
		expect(lines.barrels).toBe(BARREL_POINTS);
		expect(lines.golden).toBe(GOLDEN_POINTS - BARREL_POINTS);
		expect(lines.total).toBe(GOLDEN_POINTS);
	});

	it('a rewind goes back to a snapshot, is counted, costs points and runs out', () => {
		const state = game(lane());
		const snapshot = cloneState(state);
		move(state, 'right');
		const back = rewound(state, snapshot);
		expect(back.moves).toBe(0);
		expect(back.cart).toEqual(snapshot.cart);
		expect(back.undosUsed).toBe(1);
		expect(rewindsLeft(back)).toBe(UNDOS_PER_LEVEL - 1);
		expect(rewindsLeft({ ...back, undosUsed: 9 })).toBe(0);
		const won = game({ ...lane(), par: 4 });
		won.undosUsed = 2;
		walk(won, 'right', 'right', 'right', 'right');
		expect(scoreBreakdown(won).rewinds).toBe(2 * UNDO_PENALTY);
	});
});
