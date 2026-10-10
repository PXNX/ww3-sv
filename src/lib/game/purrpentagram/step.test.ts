import { describe, expect, it } from 'vitest';
import { createRandom } from '#lib/game/random.js';
import {
	FIRST_EVENT_MS,
	HIDE_RECOVER_MOOD,
	NAME_HAPPINESS,
	PITCH_HAPPINESS,
	SCRUB_COOLDOWN_MS,
	STARTING_LIVES,
	UNSETTLED_MOOD
} from './config';
import { EVENT_DURATION_MS } from './reactions';
import { catHearts } from './scoring';
import { createRitual, scoreOf, totalHearts, type RitualEvent, type RitualState } from './state';
import { beginPet, canLink, canPet, connect, endPet, nudgePet, petMove, stepRitual } from './step';

const STEP = 1000 / 60;

function setup(seed = 1) {
	const random = createRandom(seed);
	const state = createRitual(seed, random);
	return { state, random, target: state.riddle.target };
}

function run(state: RitualState, random: () => number, ms: number): RitualEvent[] {
	const events: RitualEvent[] = [];
	for (let t = 0; t < ms; t += STEP) events.push(...stepRitual(state, random, STEP));
	return events;
}

/** Pets a cat with a steady gentle stroke for `ms`, the way a finger would */
function pet(state: RitualState, random: () => number, id: number, ms: number, speed = 200) {
	beginPet(state, id);
	let x = 0;
	petMove(state, id, { x, y: 0, t: 0 });
	let clock = 0;
	const events: RitualEvent[] = [];
	for (let t = 0; t < ms; t += STEP) {
		clock += STEP;
		x += (speed * STEP) / 1000;
		events.push(...petMove(state, id, { x, y: 0, t: clock }));
		events.push(...stepRitual(state, random, STEP));
	}
	return events;
}

describe('petting a cat', () => {
	it('builds up the purr the longer the stroke goes on', () => {
		const { state, random } = setup();
		pet(state, random, 0, 500);
		const early = state.cats[0].purr;
		pet(state, random, 0, 3000);
		expect(early).toBeGreaterThan(0);
		expect(state.cats[0].purr).toBeGreaterThan(early);
	});

	it('lets the purr die away once the finger stops or lifts', () => {
		const { state, random } = setup();
		pet(state, random, 0, 3000);
		const loud = state.cats[0].purr;
		endPet(state, 0);
		run(state, random, 4000);
		expect(state.cats[0].purr).toBeLessThan(loud * 0.1);
	});

	it('makes the cat happier while it purrs, and shows the name tag and then the pitch', () => {
		const { state, random } = setup();
		const events = pet(state, random, 2, 20000);
		const cat = state.cats[2];
		expect(cat.happiness).toBeGreaterThanOrEqual(PITCH_HAPPINESS);
		expect(cat.nameShown).toBe(true);
		expect(cat.pitchShown).toBe(true);
		const kinds = events.filter((e) => e.type === 'name-shown' || e.type === 'pitch-shown');
		expect(kinds.map((e) => e.type)).toEqual(['name-shown', 'pitch-shown']);
		expect(cat.happiness).toBeGreaterThan(NAME_HAPPINESS);
	});

	it('does not reveal anything for a cat that is only touched', () => {
		const { state, random } = setup();
		pet(state, random, 1, 500);
		expect(state.cats[1].nameShown).toBe(false);
		expect(state.cats[1].pitchShown).toBe(false);
	});

	it('flicks the tail at a first scrub and hisses at the next, with no purr', () => {
		const { state, random } = setup();
		beginPet(state, 0);
		petMove(state, 0, { x: 0, y: 0, t: 0 });
		let clock = 0;
		let x = 0;
		const events: RitualEvent[] = [];
		for (let i = 0; i < 90; i++) {
			clock += STEP;
			x += i % 2 === 0 ? 60 : -60;
			events.push(...petMove(state, 0, { x, y: 0, t: clock }));
			events.push(...stepRitual(state, random, STEP));
		}
		const scrubs = events.filter((e) => e.type === 'scrub');
		expect(scrubs.length).toBeGreaterThanOrEqual(2);
		expect(scrubs[0]).toMatchObject({ cat: 0, hiss: false });
		expect(scrubs[1]).toMatchObject({ cat: 0, hiss: true });
		expect(state.cats[0].purr).toBeLessThan(0.05);
		expect(SCRUB_COOLDOWN_MS).toBeGreaterThan(0);
	});

	it('ignores petting while the cat sulks after a hiss', () => {
		const { state } = setup();
		const cat = state.cats[0];
		cat.sulkMs = 800;
		expect(canPet(cat)).toBe(false);
		petMove(state, 0, { x: 0, y: 0, t: 0 });
		petMove(state, 0, { x: 50, y: 0, t: 100 });
		expect(cat.purrTarget).toBe(0);
	});

	it('purrs for a keyboard nudge, and keeps going while the key is held', () => {
		const { state, random } = setup();
		for (let i = 0; i < 40; i++) {
			nudgePet(state, 0);
			run(state, random, 40);
		}
		expect(state.cats[0].purr).toBeGreaterThan(0.3);
	});
});

describe('room events', () => {
	it('starts the first event on schedule and then cycles through all of them', () => {
		const { state, random } = setup();
		const seen: string[] = [];
		let events = run(state, random, FIRST_EVENT_MS + 200);
		for (const e of events) if (e.type === 'room-event') seen.push(e.event);
		expect(seen).toHaveLength(1);
		events = run(state, random, 6 * 20000);
		for (const e of events) if (e.type === 'room-event') seen.push(e.event);
		expect(new Set(seen.slice(0, 6)).size).toBe(6);
	});

	it('lets an event run for its full duration and then end', () => {
		const { state, random } = setup();
		run(state, random, FIRST_EVENT_MS + 50);
		const kind = state.event!.kind;
		run(state, random, EVENT_DURATION_MS[kind] + 100);
		expect(state.event).toBeNull();
	});

	it('gives every cat its own reaction and notes it down', () => {
		const { state, random } = setup(3);
		const events = run(state, random, FIRST_EVENT_MS + 50);
		const kind = state.event!.kind;
		for (const cat of state.cats) {
			expect(cat.observed).toEqual([{ event: kind, animation: expect.any(String) }]);
		}
		const reactions = events.filter((e) => e.type === 'reaction');
		expect(reactions.length).toBeGreaterThan(0);
	});

	it('keeps a hiding cat hidden until it has been petted calm, then lets it out', () => {
		const { state, random } = setup();
		const cat = state.cats[0];
		cat.motion = { kind: 'hide', remainingMs: 100 };
		cat.mood = 0.1;
		expect(canLink(cat)).toBe(false);
		run(state, random, 4000);
		expect(cat.motion?.kind).toBe('hide');

		pet(state, random, 0, 6000);
		expect(cat.mood).toBeGreaterThan(HIDE_RECOVER_MOOD);
		expect(cat.motion).toBeNull();
		expect(canLink(cat)).toBe(true);
	});

	it('lets a mood recover on its own, slowly', () => {
		const { state, random } = setup();
		const cat = state.cats[0];
		const rest = cat.mood;
		cat.mood = rest - 0.3;
		run(state, random, 6000);
		expect(cat.mood).toBeGreaterThan(rest - 0.3);
		expect(cat.mood).toBeLessThanOrEqual(rest);
	});
});

describe('the star stroke', () => {
	it('lights a line for each correct stroke and wins when the star is closed', () => {
		const { state, target } = setup();
		let events = connect(state, target[0], target[1]);
		expect(events).toEqual([{ type: 'line', from: target[0], to: target[1], index: 0 }]);
		expect(state.chain).toEqual([target[0], target[1]]);
		events = connect(state, target[1], target[2]);
		expect(events).toEqual([{ type: 'line', from: target[1], to: target[2], index: 1 }]);
		connect(state, target[2], target[3]);
		// All five cats are joined, but the ritual is not complete until the last one goes back to the first
		events = connect(state, target[3], target[4]);
		expect(events.map((e) => e.type)).toEqual(['line']);
		expect(state.chain).toEqual(target);
		expect(state.phase).toBe('playing');
		expect(state.closed).toBe(false);

		events = connect(state, target[4], target[0]);
		expect(events).toEqual([
			{ type: 'line', from: target[4], to: target[0], index: 4 },
			{ type: 'win' }
		]);
		expect(state.phase).toBe('won');
		expect(state.closed).toBe(true);
		expect(state.chain).toEqual(target);
	});

	it('costs a heart when the last cat is joined to any cat but the first', () => {
		const { state, target } = setup();
		for (let i = 0; i < 4; i++) connect(state, target[i], target[i + 1]);
		const events = connect(state, target[4], target[2]);
		expect(events).toEqual([
			{ type: 'mistake', from: target[4], to: target[2], livesLeft: STARTING_LIVES - 1 }
		]);
		expect(state.phase).toBe('playing');
		expect(state.closed).toBe(false);
		// The star is still open and can be closed correctly afterwards
		connect(state, target[4], target[0]);
		expect(state.phase).toBe('won');
	});

	it('only closes the star from the last cat', () => {
		const { state, target } = setup();
		for (let i = 0; i < 4; i++) connect(state, target[i], target[i + 1]);
		expect(connect(state, target[2], target[0])).toEqual([{ type: 'out-of-turn', cat: target[2] }]);
		expect(state.closed).toBe(false);
	});

	it('costs a heart for a wrong cat and keeps the star as it was', () => {
		const { state, target } = setup();
		connect(state, target[0], target[1]);
		const wrong = target[3];
		const events = connect(state, target[1], wrong);
		expect(events).toEqual([
			{ type: 'mistake', from: target[1], to: wrong, livesLeft: STARTING_LIVES - 1 }
		]);
		expect(state.lives).toBe(STARTING_LIVES - 1);
		expect(state.mistakes).toBe(1);
		expect(state.chain).toEqual([target[0], target[1]]);
		expect(state.cats[wrong].motion?.kind).toBe('hiss');
	});

	it('counts a wrong first stroke as a mistake too', () => {
		const { state, target } = setup();
		const events = connect(state, target[1], target[0]);
		expect(events[0]).toMatchObject({ type: 'mistake' });
		expect(state.chain).toEqual([]);
	});

	it('ends the game when the cats lose all their patience', () => {
		const { state, target } = setup();
		let events: RitualEvent[] = [];
		for (let i = 0; i < STARTING_LIVES; i++) events = connect(state, target[1], target[0]);
		expect(events.map((e) => e.type)).toEqual(['mistake', 'game-over']);
		expect(state.phase).toBe('over');
		expect(connect(state, target[0], target[1])).toEqual([]);
	});

	it('only continues from the cat the star ended on, without any penalty', () => {
		const { state, target } = setup();
		connect(state, target[0], target[1]);
		const events = connect(state, target[3], target[4]);
		expect(events).toEqual([{ type: 'out-of-turn', cat: target[3] }]);
		expect(state.lives).toBe(STARTING_LIVES);
	});

	it('does not join a cat that is hiding or too upset, and costs nothing', () => {
		const { state, target } = setup();
		const hidden = state.cats[target[1]];
		hidden.mood = UNSETTLED_MOOD - 0.1;
		const events = connect(state, target[0], target[1]);
		expect(events).toEqual([{ type: 'not-ready', cat: target[1] }]);
		expect(state.lives).toBe(STARTING_LIVES);
		expect(state.chain).toEqual([]);

		hidden.mood = 0.9;
		hidden.motion = { kind: 'chase', remainingMs: 1000 };
		expect(connect(state, target[0], target[1])).toEqual([{ type: 'not-ready', cat: target[1] }]);
	});

	it('ignores a stroke from a cat to itself and strokes after the ritual ended', () => {
		const { state, target } = setup();
		expect(connect(state, target[0], target[0])).toEqual([]);
		state.phase = 'over';
		expect(connect(state, target[0], target[1])).toEqual([]);
	});
});

describe('the finale clock and the score', () => {
	function solve(state: RitualState) {
		const { target } = state.riddle;
		for (let i = 0; i < 4; i++) connect(state, target[i], target[i + 1]);
		connect(state, target[4], target[0]);
	}

	it('runs the finale clock once the ritual is won and stops the game clock', () => {
		const { state, random } = setup();
		run(state, random, 1000);
		solve(state);
		const elapsed = state.elapsedMs;
		run(state, random, 2000);
		expect(state.elapsedMs).toBe(elapsed);
		expect(state.finaleMs).toBeGreaterThan(1900);
	});

	it('scores nothing before the ritual is complete', () => {
		const { state } = setup();
		expect(scoreOf(state)).toBe(0);
	});

	it('pays more for happy cats than for a rushed ritual with grumpy ones', () => {
		const rushed = setup(5);
		solve(rushed.state);
		const loved = setup(5);
		for (const cat of loved.state.cats) cat.happiness = 1;
		solve(loved.state);
		expect(totalHearts(loved.state)).toBe(15);
		expect(scoreOf(loved.state)).toBeGreaterThan(scoreOf(rushed.state));
		expect(catHearts(1)).toBe(3);
	});

	it('takes points off for every wrong stroke', () => {
		const clean = setup(8);
		solve(clean.state);
		const clumsy = setup(8);
		connect(clumsy.state, clumsy.target[1], clumsy.target[0]);
		solve(clumsy.state);
		expect(scoreOf(clumsy.state)).toBeLessThan(scoreOf(clean.state));
	});
});
