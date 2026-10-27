import { describe, expect, it } from 'vitest';
import { createRandom } from '../random.js';
import {
	GAME_OVER_FEEDBACK_MS,
	HITS_PER_WAVE,
	INSPECT_MS,
	PATIENCE_BASE_MS,
	STARTING_REPUTATION,
	VEHICLE_COUNT
} from './config.js';
import { clearChance, dealConvoy, patienceFor, psyopsShare } from './convoys.js';
import { createGame, decide, inspect, pointsFor, step, type BorderShiftState } from './state.js';
import { missingMessages } from '#lib/testing/messages.js';

/** A convoy that is always a family, with both clues fogged up */
const family = () => 0.99;
/** A convoy that is always psy-ops, with both clues clear */
const psyched = () => 0;

function advance(game: BorderShiftState, random: () => number, dtMs: number) {
	return step(game, dtMs, random);
}

function passAndAdvance(game: BorderShiftState, random: () => number) {
	const events = decide(game, 'pass');
	advance(game, random, 2000);
	return events;
}

describe('Border Shift convoys', () => {
	it('shortens the patience and raises the psy-op share with every shift', () => {
		expect(patienceFor(2)).toBeLessThan(patienceFor(1));
		expect(patienceFor(99)).toBe(patienceFor(100));
		expect(psyopsShare(2)).toBeGreaterThan(psyopsShare(1));
		expect(psyopsShare(99)).toBe(psyopsShare(100));
		expect(clearChance(2)).toBeLessThan(clearChance(1));
	});

	it('never sends the same vehicle twice in a row', () => {
		let previous: number | null = null;
		const random = createRandom(12);
		for (let i = 0; i < 30; i++) {
			const convoy = dealConvoy(random, 1, previous);
			expect(convoy.vehicle).toBeGreaterThanOrEqual(0);
			expect(convoy.vehicle).toBeLessThan(VEHICLE_COUNT);
			expect(convoy.vehicle).not.toBe(previous);
			previous = convoy.vehicle;
		}
	});

	it('only ever shows the truth or a blur, never the opposite', () => {
		const random = createRandom(3);
		for (let i = 0; i < 50; i++) {
			const convoy = dealConvoy(random, 2, null);
			for (const hint of [convoy.hints.documents, convoy.hints.camera]) {
				expect(hint === 'unclear' || hint === convoy.truth).toBe(true);
			}
		}
	});
});

describe('Border Shift state', () => {
	it('starts the first shift with a convoy at the barrier', () => {
		const game = createGame(family);
		expect(game.phase).toBe('watch');
		expect(game.wave).toBe(1);
		expect(game.convoyNumber).toBe(1);
		expect(game.reputation).toBe(STARTING_REPUTATION);
		expect(game.patienceLeftMs).toBe(patienceFor(1));
		expect(game.score).toBe(0);
		expect(game.revealed).toEqual({ documents: null, camera: null });
	});

	it('spends patience on a tool and reveals its clue once', () => {
		const game = createGame(family);
		const events = inspect(game, 'documents');
		expect(events).toEqual([{ type: 'hint', tool: 'documents', hint: 'unclear' }]);
		expect(game.patienceLeftMs).toBe(patienceFor(1) - INSPECT_MS);
		expect(inspect(game, 'documents')).toEqual([]);
		expect(game.patienceLeftMs).toBe(patienceFor(1) - INSPECT_MS);
	});

	it('shows the truth through both tools when the night is clear', () => {
		const game = createGame(psyched);
		expect(game.convoy.truth).toBe('psyops');
		inspect(game, 'documents');
		inspect(game, 'camera');
		expect(game.revealed).toEqual({ documents: 'psyops', camera: 'psyops' });
	});

	it('rewards a family waved through and counts it as admitted', () => {
		const game = createGame(family);
		const expected = pointsFor(game);
		const events = decide(game, 'pass');
		expect(events[0]).toMatchObject({ type: 'correct', truth: 'family', decision: 'pass' });
		expect(game.score).toBe(expected);
		expect(game.streak).toBe(1);
		expect(game.stats.admitted).toBe(1);
		expect(game.phase).toBe('verdict');
	});

	it('rewards a psy-op turned back and counts it as caught', () => {
		const game = createGame(psyched);
		decide(game, 'refuse');
		expect(game.stats.caught).toBe(1);
		expect(game.stats.admitted).toBe(0);
		expect(game.score).toBeGreaterThan(0);
	});

	it('costs a reputation point for a family turned away', () => {
		const game = createGame(family);
		decide(game, 'refuse');
		expect(game.reputation).toBe(STARTING_REPUTATION - 1);
		expect(game.streak).toBe(0);
		expect(game.stats.turnedAway).toBe(1);
		expect(game.last).toMatchObject({ kind: 'wrong', truth: 'family', decision: 'refuse' });
	});

	it('costs a reputation point for a psy-op waved through', () => {
		const game = createGame(psyched);
		decide(game, 'pass');
		expect(game.reputation).toBe(STARTING_REPUTATION - 1);
		expect(game.stats.slipped).toBe(1);
	});

	it('opens the barrier by itself when the convoy runs out of patience', () => {
		const game = createGame(psyched);
		const events = advance(game, psyched, PATIENCE_BASE_MS + 10);
		expect(events[0]).toMatchObject({ type: 'wrong', reason: 'timeout', decision: 'pass' });
		expect(game.patienceLeftMs).toBe(0);
		expect(game.stats.slipped).toBe(1);
	});

	it('also times out when the second look eats the last of the patience', () => {
		const game = createGame(psyched);
		game.patienceLeftMs = INSPECT_MS - 100;
		const events = inspect(game, 'camera');
		expect(events[0]).toMatchObject({ type: 'hint', hint: 'psyops' });
		expect(events[1]).toMatchObject({ type: 'wrong', reason: 'timeout' });
		expect(game.phase).toBe('verdict');
	});

	it('announces the next shift after three correct calls', () => {
		const game = createGame(family);
		passAndAdvance(game, family);
		passAndAdvance(game, family);
		expect(game.wave).toBe(1);
		const events = passAndAdvance(game, family);
		expect(events.some((event) => event.type === 'wave')).toBe(true);
		expect(game.wave).toBe(2);
		expect(game.correct).toBe(HITS_PER_WAVE);
		expect(patienceFor(game.wave)).toBeLessThan(patienceFor(1));
	});

	it('ends the night after the last reputation point and then shows the sheet', () => {
		const game = createGame(psyched);
		for (let i = 0; i < STARTING_REPUTATION - 1; i++) {
			decide(game, 'pass');
			advance(game, psyched, 2000);
		}
		decide(game, 'pass');
		expect(game.reputation).toBe(0);
		expect(game.phase).toBe('verdict');
		const events = advance(game, psyched, GAME_OVER_FEEDBACK_MS + 10);
		expect(events).toEqual([{ type: 'game-over' }]);
		expect(game.phase).toBe('over');
		expect(step(game, 100, psyched)).toEqual([]);
	});

	it('scores a faster call better than a slow one, and a streak better than none', () => {
		const quick = createGame(family);
		const slow = createGame(family);
		slow.patienceLeftMs = 10;
		expect(pointsFor(quick)).toBeGreaterThan(pointsFor(slow));
		quick.streak = 3;
		expect(pointsFor(quick)).toBeGreaterThan(pointsFor(createGame(family)));
	});
});

describe('Border Shift messages', () => {
	it('has its own and its mode messages in every language', () => {
		expect(missingMessages(['bordershift_', 'mode_bordershift_'])).toEqual([]);
	});

	it('has a vehicle description for every generated vehicle', () => {
		expect(missingMessages(['bordershift_vehicle_'])).toEqual([]);
		for (let i = 0; i < VEHICLE_COUNT; i++) {
			expect(missingMessages([`bordershift_vehicle_${i}`]), `${i}`).toEqual([]);
		}
		expect(missingMessages(['bordershift_vehicle_9'])).not.toEqual([]);
	});
});
