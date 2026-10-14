import { describe, expect, it } from 'vitest';
import { createRandom } from '../random';
import { endPoint } from './body';
import { isSolidTile, maxDepth } from './canal';
import { COLS, QUEUE_CAPACITY, STARTING_LIVES, TILE, levelParams } from './config';
import { isFree } from './physics';
import {
	createGame,
	dig,
	distanceToHull,
	excavatorSeconds,
	freedPoints,
	movePointer,
	pressAt,
	releasePointer,
	startLevel,
	stepGame,
	stuckFraction,
	type SuezEvent,
	type SuezState
} from './state';

const STEP = 1000 / 60;

function newGame(seed = 3, level = 1) {
	const random = createRandom(seed);
	const state = createGame(random);
	if (level > 1) {
		state.level = level;
		startLevel(state, random);
	}
	return { state, random };
}

function run(state: SuezState, random: () => number, ms: number): SuezEvent[] {
	const events: SuezEvent[] = [];
	for (let t = 0; t < ms && state.phase !== 'over'; t += STEP) {
		events.push(...stepGame(state, random, STEP));
	}
	return events;
}

/** Where the open water is, across all the rows the ship covers */
function openCentre(state: SuezState): number {
	const from = Math.floor((state.body.y - 110) / TILE);
	const to = Math.floor((state.body.y + 110) / TILE);
	let lo = 0;
	let hi = COLS - 1;
	for (let row = from; row <= to; row++) {
		while (isSolidTile(state.canal, lo, row)) lo++;
		while (isSolidTile(state.canal, hi, row)) hi--;
	}
	return ((lo + hi + 1) / 2) * TILE;
}

/** A player who grabs both ends and swings the ship upright, like two thumbs would */
function tryFree(state: SuezState, random: () => number, maxMs = 30000): number {
	const sign = state.body.angle > 0 ? 1 : -1;
	const cx = openCentre(state);
	const cy = state.body.y;
	pressAt(state, 1, endPoint(state.body, 'bow'), 'touch');
	pressAt(state, 2, endPoint(state.body, 'stern'), 'touch');
	let t = 0;
	while (t < maxMs && state.phase === 'stuck') {
		movePointer(state, 1, { x: cx, y: cy + sign * 95 });
		movePointer(state, 2, { x: cx, y: cy - sign * 95 });
		stepGame(state, random, STEP);
		t += STEP;
	}
	return t;
}

describe('a new canal', () => {
	it('wedges the ship across the canal, dug into both banks', () => {
		for (let level = 1; level <= 20; level++) {
			for (const seed of [1, 2, 3]) {
				const { state } = newGame(seed, level);
				expect(state.phase).toBe('stuck');
				expect(state.startDepth).toBeGreaterThan(5);
				expect(maxDepth(state.canal, state.body)).toBeGreaterThan(5);
				expect(isFree(state.canal, state.body)).toBe(false);
				expect(stuckFraction(state)).toBe(1);
			}
		}
	});

	it('gets ever narrower down to three tiles', () => {
		const widths = [1, 2, 3, 4, 6, 8, 10, 11, 30].map((level) => levelParams(level).widthTiles);
		expect(widths).toEqual([8, 7, 7, 6, 5, 4, 3, 3, 3]);
		for (let i = 1; i < widths.length; i++) expect(widths[i]).toBeLessThanOrEqual(widths[i - 1]);
	});

	it('starts with a full set of hearts, an empty queue and a ready excavator', () => {
		const { state } = newGame();
		expect(state.lives).toBe(STARTING_LIVES);
		expect(state.queue.waiting).toBe(0);
		expect(excavatorSeconds(state)).toBe(0);
		expect(state.score).toBe(0);
	});

	it('is the same canal for the same seed', () => {
		const a = newGame(9, 4).state;
		const b = newGame(9, 4).state;
		expect([...a.canal.solid]).toEqual([...b.canal.solid]);
		expect(a.body).toEqual(b.body);
	});
});

describe('pressing the field', () => {
	it('grabs the nearest end when pressed near the hull, keeping the grab offset', () => {
		const { state } = newGame();
		const bow = endPoint(state.body, 'bow');
		const press = { x: bow.x + 6, y: bow.y - 4 };
		expect(pressAt(state, 1, press, 'touch')).toEqual({ kind: 'grab', end: 'bow' });
		expect(state.holds[0].offset).toEqual({ x: -6, y: 4 });
	});

	it('lets a second finger hold the other end and ignores a third', () => {
		const { state } = newGame();
		expect(pressAt(state, 1, endPoint(state.body, 'bow'), 'touch').kind).toBe('grab');
		// Pressed near the bow again, but the bow is taken: it goes to the stern instead
		const second = pressAt(state, 2, endPoint(state.body, 'bow'), 'touch');
		expect(second).toEqual({ kind: 'grab', end: 'stern' });
		expect(pressAt(state, 3, endPoint(state.body, 'stern'), 'touch')).toEqual({ kind: 'none' });
		expect(state.holds.map((hold) => hold.end).sort()).toEqual(['bow', 'stern']);
	});

	it('ignores a second press of the same pointer', () => {
		const { state } = newGame();
		pressAt(state, 1, endPoint(state.body, 'bow'), 'mouse');
		expect(pressAt(state, 1, endPoint(state.body, 'stern'), 'mouse')).toEqual({ kind: 'none' });
		expect(state.holds).toHaveLength(1);
	});

	it('lets a mouse grab the nearest end from anywhere in open water, a touch only when close', () => {
		const { state } = newGame();
		const water = { x: state.body.x + 4, y: 520 };
		expect(distanceToHull(state.body, water)).toBeGreaterThan(200);
		expect(pressAt(state, 1, water, 'touch')).toEqual({ kind: 'none' });
		expect(pressAt(state, 2, water, 'mouse').kind).toBe('grab');
	});

	it('calls the excavator on a bank tile away from the ship', () => {
		const { state } = newGame();
		const result = pressAt(state, 1, { x: 50, y: 500 }, 'touch');
		expect(result.kind).toBe('dig');
		expect(isSolidTile(state.canal, 2, 25)).toBe(false);
		expect(state.holds).toHaveLength(0);
	});

	it('leaves the bedrock alone', () => {
		const { state } = newGame();
		expect(pressAt(state, 1, { x: 5, y: 500 }, 'touch')).toEqual({ kind: 'none' });
	});

	it('grabs instead of digging when the press is on the hull, even inside a bank', () => {
		const { state } = newGame();
		// The wedged ends sit inside bank tiles
		const bow = endPoint(state.body, 'bow');
		expect(pressAt(state, 1, bow, 'touch').kind).toBe('grab');
	});

	it('does nothing once the ship is sailing away', () => {
		const { state } = newGame();
		state.phase = 'sailing';
		expect(pressAt(state, 1, endPoint(state.body, 'bow'), 'touch')).toEqual({ kind: 'none' });
	});

	it('forgets a finger that lifts', () => {
		const { state } = newGame();
		pressAt(state, 1, endPoint(state.body, 'bow'), 'touch');
		releasePointer(state, 1);
		expect(state.holds).toEqual([]);
		movePointer(state, 1, { x: 0, y: 0 });
		expect(state.holds).toEqual([]);
	});
});

describe('the excavator', () => {
	it('digs, then rests for its cooldown', () => {
		const { state, random } = newGame();
		expect(dig(state, 2, 25).kind).toBe('dig');
		expect(state.cooldownMs).toBe(levelParams(1).excavatorCooldownMs);
		expect(excavatorSeconds(state)).toBe(Math.ceil(levelParams(1).excavatorCooldownMs / 1000));
		expect(dig(state, 2, 20)).toEqual({ kind: 'cooldown' });
		expect(isSolidTile(state.canal, 2, 20)).toBe(true);

		run(state, random, levelParams(1).excavatorCooldownMs + 100);
		expect(state.cooldownMs).toBe(0);
		expect(dig(state, 2, 20).kind).toBe('dig');
	});

	it('does not use up the cooldown on open water or bedrock', () => {
		const { state } = newGame();
		expect(dig(state, 9, 25)).toEqual({ kind: 'none' });
		expect(dig(state, 0, 25)).toEqual({ kind: 'none' });
		expect(state.cooldownMs).toBe(0);
	});

	it('loosens the ship when it clears bank next to it, and takes no more than the mud holds', () => {
		const { state } = newGame();
		const before = state.allowed;
		const bow = endPoint(state.body, 'bow');
		const col = Math.floor(bow.x / TILE);
		const row = Math.floor(bow.y / TILE);
		const depth = maxDepth(state.canal, state.body);
		expect(dig(state, col, row).kind).toBe('dig');
		expect(state.allowed).toBeLessThan(before);
		expect(maxDepth(state.canal, state.body)).toBeLessThanOrEqual(depth);
		for (let i = 0; i < 20; i++) {
			state.cooldownMs = 0;
			dig(state, col, row);
		}
		expect(state.allowed).toBeGreaterThanOrEqual(0);
	});
});

describe('freeing the ship', () => {
	it('scores more for later canals, for speed and for a longer queue', () => {
		expect(freedPoints(2, 10000, 0)).toBeGreaterThan(freedPoints(1, 10000, 0));
		expect(freedPoints(1, 5000, 0)).toBeGreaterThan(freedPoints(1, 30000, 0));
		expect(freedPoints(1, 10000, 5)).toBe(freedPoints(1, 10000, 0) + 75);
		expect(freedPoints(1, 999999, 0)).toBe(100);
	});

	it('every canal can be freed by swinging the ship upright with two fingers', () => {
		for (let level = 1; level <= 14; level++) {
			const { state, random } = newGame(level + 40, level);
			const taken = tryFree(state, random);
			expect(state.phase, `level ${level}`).toBe('sailing');
			expect(taken).toBeLessThan(15000);
			expect(state.canalsCleared).toBe(1);
			expect(state.score).toBeGreaterThanOrEqual(100);
		}
	});

	it('drops the stuck meter as the ship works loose', () => {
		const { state, random } = newGame(5, 4);
		const sign = state.body.angle > 0 ? 1 : -1;
		const cx = openCentre(state);
		pressAt(state, 1, endPoint(state.body, 'bow'), 'touch');
		pressAt(state, 2, endPoint(state.body, 'stern'), 'touch');
		const meter: number[] = [];
		for (let i = 0; i < 400 && state.phase === 'stuck'; i++) {
			movePointer(state, 1, { x: cx, y: state.body.y + sign * 95 });
			movePointer(state, 2, { x: cx, y: state.body.y - sign * 95 });
			stepGame(state, random, STEP);
			if (i % 20 === 0) meter.push(stuckFraction(state));
		}
		expect(meter[0]).toBeGreaterThan(0.9);
		for (let i = 1; i < meter.length; i++) expect(meter[i]).toBeLessThanOrEqual(meter[i - 1]);
		expect(meter[meter.length - 1]).toBeLessThan(meter[0]);
	});

	it('lets the whole queue through, pays for it and sails on to a narrower canal', () => {
		const { state, random } = newGame(11, 1);
		state.queue.waiting = 4;
		const events: SuezEvent[] = [];
		pressAt(state, 1, endPoint(state.body, 'bow'), 'touch');
		pressAt(state, 2, endPoint(state.body, 'stern'), 'touch');
		const sign = state.body.angle > 0 ? 1 : -1;
		const cx = openCentre(state);
		const cy = state.body.y;
		for (let t = 0; t < 30000 && state.level === 1; t += STEP) {
			movePointer(state, 1, { x: cx, y: cy + sign * 95 });
			movePointer(state, 2, { x: cx, y: cy - sign * 95 });
			events.push(...stepGame(state, random, STEP));
		}
		const freed = events.find((event) => event.type === 'freed');
		expect(freed).toMatchObject({ type: 'freed', released: 4, level: 1 });
		expect(state.shipsReleased).toBe(4);
		expect(state.queue.waiting).toBe(0);
		expect(events.some((event) => event.type === 'level-start')).toBe(true);
		expect(state.level).toBe(2);
		expect(state.phase).toBe('stuck');
		expect(state.holds).toEqual([]);
		expect(isFree(state.canal, state.body)).toBe(false);
	});

	it('pauses the queue while the ship sails away', () => {
		const { state, random } = newGame();
		state.phase = 'sailing';
		state.queue.waiting = 2;
		run(state, random, 600);
		expect(state.queue.waiting).toBe(2);
		expect(state.queue.timerMs).toBe(0);
	});
});

describe('the queue and the hearts', () => {
	it('adds waiting ships over time', () => {
		const { state, random } = newGame();
		const events = run(state, random, levelParams(1).queueIntervalMs * 2 + 50);
		expect(state.queue.waiting).toBe(2);
		expect(events.filter((event) => event.type === 'arrived')).toHaveLength(2);
		expect(state.lives).toBe(STARTING_LIVES);
	});

	it('costs a heart when the queue gets too long and then shortens it', () => {
		const { state, random } = newGame();
		const interval = levelParams(1).queueIntervalMs;
		const events = run(state, random, interval * (QUEUE_CAPACITY + 1) + 100);
		expect(events.filter((event) => event.type === 'overflow')).toHaveLength(1);
		expect(state.lives).toBe(STARTING_LIVES - 1);
		expect(state.queue.waiting).toBeLessThanOrEqual(QUEUE_CAPACITY / 2 + 1);
		expect(state.phase).toBe('stuck');
	});

	it('ends the game when the last heart goes', () => {
		const { state, random } = newGame();
		pressAt(state, 1, endPoint(state.body, 'bow'), 'touch');
		const events = run(state, random, 10 * 60 * 1000);
		expect(state.lives).toBe(0);
		expect(state.phase).toBe('over');
		expect(state.holds).toEqual([]);
		expect(events.filter((event) => event.type === 'overflow')).toHaveLength(STARTING_LIVES);
		expect(events.filter((event) => event.type === 'game-over')).toHaveLength(1);
		// Nothing happens afterwards
		expect(stepGame(state, createRandom(1), STEP)).toEqual([]);
		expect(pressAt(state, 9, { x: 10, y: 10 }, 'mouse')).toEqual({ kind: 'none' });
	});

	it('loses hearts faster on later canals', () => {
		const slow = newGame(1, 1).state;
		const quick = newGame(1, 9).state;
		const gap = (state: SuezState) => {
			state.queue.waiting = 0;
			let ms = 0;
			while (state.queue.waiting === 0) {
				stepGame(state, createRandom(1), STEP);
				ms += STEP;
			}
			return ms;
		};
		expect(gap(quick)).toBeLessThan(gap(slow));
	});

	it('does not stir while the player is freeing the ship in time', () => {
		const { state, random } = newGame(21, 2);
		tryFree(state, random);
		expect(state.lives).toBe(STARTING_LIVES);
	});
});
