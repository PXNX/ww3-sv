import { describe, expect, it } from 'vitest';
import { createRandom } from '#lib/game/random.js';
import { bodyScale, createBody, hop, REST_TARGET, stepBody } from './body';
import {
	candleLight,
	createCandles,
	flameFlicker,
	lightMoodRate,
	litCount,
	relight,
	settleFactor,
	snuff,
	snuffSome,
	stepCandles
} from './candles';
import {
	CANDLE_FUEL_PER_S,
	COMBO_MAX,
	COMBO_WINDOW_MS,
	FIRST_EVENT_MS,
	OMEN_MS,
	SATED_MS,
	SCORE_PER_COMBO,
	STAR_THREE_SCORE,
	STAR_TWO_SCORE
} from './config';
import { PACT_TABLE, PACTS, isPact } from './pacts';
import { age, MAX_PARTICLES, spawn, stepParticles, type Particle } from './particles';
import { ritualScore, scoreBreakdown, starsFor } from './scoring';
import { createRitual, scoreOf, type RitualEvent, type RitualState } from './state';
import { connect, feedCat, relightCandle, restlessness, stepRitual } from './step';

const STEP = 1000 / 60;

function setup(seed = 1, pact: Parameters<typeof createRitual>[2] = 'none') {
	const random = createRandom(seed);
	const state = createRitual(seed, random, pact);
	return { state, random, target: state.riddle.target };
}

function run(state: RitualState, random: () => number, ms: number): RitualEvent[] {
	const events: RitualEvent[] = [];
	for (let t = 0; t < ms; t += STEP) events.push(...stepRitual(state, random, STEP));
	return events;
}

describe('candles', () => {
	it('start lit with full wax and give full light', () => {
		const candles = createCandles();
		expect(litCount(candles)).toBe(5);
		expect(candleLight(candles)).toBe(1);
	});

	it('shrink to nothing once put out and grow back when lit again', () => {
		const candles = createCandles();
		expect(snuff(candles[0])).toBe(true);
		expect(snuff(candles[0])).toBe(false);
		for (let t = 0; t < 1000; t += STEP) stepCandles(candles, STEP);
		expect(candles[0].level).toBe(0);
		expect(candleLight(candles)).toBeCloseTo(0.8);
		expect(relight(candles[0])).toBe(true);
		for (let t = 0; t < 1000; t += STEP) stepCandles(candles, STEP);
		expect(candles[0].level).toBe(1);
	});

	it('burn wax while lit and cannot be lit again when the wax is gone', () => {
		const candles = createCandles();
		stepCandles(candles, 10_000);
		expect(candles[1].fuel).toBeCloseTo(1 - 10 * CANDLE_FUEL_PER_S);
		candles[1].fuel = 0.00001;
		stepCandles(candles, 1000);
		expect(candles[1].lit).toBe(false);
		expect(relight(candles[1])).toBe(false);
	});

	it('are picked at random among the burning ones', () => {
		const candles = createCandles();
		snuff(candles[2]);
		const out = snuffSome(candles, 3, createRandom(3));
		expect(out).toHaveLength(3);
		expect(out).not.toContain(2);
		expect(litCount(candles)).toBe(1);
		expect(snuffSome(candles, 5, createRandom(3))).toHaveLength(1);
	});

	it('unsettle an idle cat only when the room is dark, and speed up settling when bright', () => {
		expect(lightMoodRate(1)).toBe(0);
		expect(lightMoodRate(0.6)).toBe(0);
		expect(lightMoodRate(0)).toBeLessThan(lightMoodRate(0.4));
		expect(settleFactor(1)).toBeGreaterThan(settleFactor(0));
	});

	it('flicker stays within 0 to 1 and is more restless when the room is', () => {
		let calmSpread = 0;
		let restlessSpread = 0;
		for (let t = 0; t < 5000; t += 37) {
			const calm = flameFlicker(1, t, 0);
			const restless = flameFlicker(1, t, 1);
			expect(calm).toBeGreaterThanOrEqual(0);
			expect(restless).toBeLessThanOrEqual(1);
			calmSpread = Math.max(calmSpread, Math.abs(calm - 0.5));
			restlessSpread = Math.max(restlessSpread, Math.abs(restless - 0.5));
		}
		expect(restlessSpread).toBeGreaterThan(calmSpread);
	});
});

describe('relighting and the dark', () => {
	it('relights a candle that is out and reports nothing for one that burns', () => {
		const { state } = setup();
		expect(relightCandle(state, 0)).toEqual([]);
		snuff(state.candles[0]);
		expect(relightCandle(state, 0)).toEqual([{ type: 'candle-lit', index: 0 }]);
		expect(state.candles[0].lit).toBe(true);
	});

	it('says a candle without wax is spent', () => {
		const { state } = setup();
		state.candles[3].lit = false;
		state.candles[3].fuel = 0;
		expect(relightCandle(state, 3)).toEqual([{ type: 'candle-spent', index: 3 }]);
		expect(state.candles[3].lit).toBe(false);
	});

	it('lets an idle cat slide into a bad mood in a dark room but not in a lit one', () => {
		const dark = setup(4);
		const lit = setup(4);
		for (const candle of dark.state.candles) {
			candle.lit = false;
			candle.fuel = 0;
		}
		// No room events in this window, so only the light differs
		dark.state.nextEventMs = lit.state.nextEventMs = 1e9;
		run(dark.state, dark.random, 12_000);
		run(lit.state, lit.random, 12_000);
		const before = lit.state.cats[0].profile.personality;
		expect(before).toBe(dark.state.cats[0].profile.personality);
		expect(dark.state.cats[0].mood).toBeLessThan(lit.state.cats[0].mood - 0.2);
	});

	it('puts candles out when the room events begin', () => {
		const { state, random } = setup(5);
		state.eventBag = ['candles'];
		state.nextEventMs = 0;
		const events = run(state, random, 100);
		const out = events.filter((e) => e.type === 'candle-out');
		expect(out).toHaveLength(3);
		expect(litCount(state.candles)).toBe(2);
	});
});

describe('omens and escalation', () => {
	it('warns shortly before an event and then starts exactly that event', () => {
		const { state, random } = setup(6);
		state.eventBag = ['thunder'];
		const early = run(state, random, FIRST_EVENT_MS - OMEN_MS - 100);
		expect(early.some((e) => e.type === 'omen' || e.type === 'room-event')).toBe(false);
		const omen = run(state, random, 200);
		expect(omen).toContainEqual({ type: 'omen', event: 'thunder' });
		expect(state.omen?.kind).toBe('thunder');
		expect(state.event).toBeNull();
		const started = run(state, random, OMEN_MS);
		expect(started).toContainEqual({ type: 'room-event', event: 'thunder' });
		expect(state.omen).toBeNull();
		expect(state.event?.kind).toBe('thunder');
	});

	it('makes the room more restless with every cat joined', () => {
		const { state, target } = setup();
		expect(restlessness(state)).toBe(1);
		connect(state, target[0], target[1]);
		connect(state, target[1], target[2]);
		expect(restlessness(state)).toBeCloseTo(1.3);
	});

	it('brings the first event sooner with the pact of shadows', () => {
		expect(setup(1, 'shadows').state.nextEventMs).toBeLessThan(setup(1).state.nextEventMs);
	});
});

describe('combos', () => {
	it('grows with strokes in quick succession and pays more for each', () => {
		const { state, target } = setup();
		const first = connect(state, target[0], target[1]);
		expect(first).toContainEqual({ type: 'combo', combo: 1, points: 0 });
		const second = connect(state, target[1], target[2]);
		expect(second).toContainEqual({ type: 'combo', combo: 2, points: SCORE_PER_COMBO });
		connect(state, target[2], target[3]);
		expect(state.combo).toBe(3);
		expect(state.comboPoints).toBe(SCORE_PER_COMBO * 3);
		expect(state.combo).toBeLessThanOrEqual(COMBO_MAX);
	});

	it('starts over after a long pause or a wrong stroke', () => {
		const { state, random, target } = setup();
		state.nextEventMs = 1e9;
		connect(state, target[0], target[1]);
		run(state, random, COMBO_WINDOW_MS + 500);
		expect(state.combo).toBe(0);
		connect(state, target[1], target[2]);
		expect(state.combo).toBe(1);
		connect(state, target[2], target[0]);
		expect(state.combo).toBe(0);
		expect(state.bestCombo).toBe(1);
	});
});

describe('treats', () => {
	it('give a heart and a calmer cat, cost a treat and score, and make the cat full', () => {
		const { state } = setup();
		const cat = state.cats[1];
		cat.mood = 0.4;
		expect(feedCat(state, 1)).toEqual([{ type: 'treat', cat: 1 }]);
		expect(cat.happiness).toBeCloseTo(1 / 3);
		expect(cat.mood).toBeCloseTo(0.65);
		expect(cat.satedMs).toBe(SATED_MS);
		expect(state.treats).toBe(PACT_TABLE.none.treats - 1);
		expect(state.treatsUsed).toBe(1);
	});

	it('run out', () => {
		const { state } = setup();
		feedCat(state, 0);
		expect(feedCat(state, 1)).toEqual([{ type: 'no-treats' }]);
		expect(state.cats[1].happiness).toBe(0);
	});

	it('warm a full cat up more slowly', () => {
		const fed = setup(2);
		const hungry = setup(2);
		fed.state.nextEventMs = hungry.state.nextEventMs = 1e9;
		fed.state.cats[0].satedMs = SATED_MS;
		fed.state.cats[0].held = hungry.state.cats[0].held = true;
		run(fed.state, fed.random, 4000);
		run(hungry.state, hungry.random, 4000);
		expect(fed.state.cats[0].happiness).toBeLessThan(hungry.state.cats[0].happiness);
	});
});

describe('pacts', () => {
	it('set the lives and treats of the ritual', () => {
		for (const pact of PACTS) {
			const { state } = setup(1, pact);
			expect(state.lives).toBe(PACT_TABLE[pact].lives);
			expect(state.maxLives).toBe(PACT_TABLE[pact].lives);
			expect(state.treats).toBe(PACT_TABLE[pact].treats);
		}
		expect(isPact('mercy')).toBe(true);
		expect(isPact('nope')).toBe(false);
	});

	it('scale the score', () => {
		const input = { mistakes: 0, hearts: 6, elapsedMs: 60_000 };
		expect(ritualScore({ ...input, factor: 1.3 })).toBeGreaterThan(ritualScore(input));
		expect(ritualScore({ ...input, factor: 0.85 })).toBeLessThan(ritualScore(input));
	});
});

describe('score and stars', () => {
	it('adds candles and combos and takes off treats and mistakes', () => {
		const plain = ritualScore({ mistakes: 0, hearts: 5, elapsedMs: 90_000 });
		const full = scoreBreakdown({
			mistakes: 1,
			hearts: 5,
			elapsedMs: 90_000,
			candles: 4,
			comboPoints: 200,
			treatsUsed: 2
		});
		expect(full.candles).toBe(160);
		expect(full.combo).toBe(200);
		expect(full.treats).toBe(-80);
		expect(full.total).toBe(plain + 160 + 200 - 80 - 120);
	});

	it('gives one star for finishing and more for a high score', () => {
		expect(starsFor(100)).toBe(1);
		expect(starsFor(STAR_TWO_SCORE - 1)).toBe(1);
		expect(starsFor(STAR_TWO_SCORE)).toBe(2);
		expect(starsFor(STAR_THREE_SCORE)).toBe(3);
	});

	it('is only counted once the ritual is won', () => {
		const { state, target } = setup();
		expect(scoreOf(state)).toBe(0);
		for (let i = 0; i < 4; i++) connect(state, target[i], target[i + 1]);
		connect(state, target[4], target[0]);
		expect(state.phase).toBe('won');
		expect(scoreOf(state)).toBeGreaterThan(0);
	});
});

describe('the cats in the finale', () => {
	it('bounce one after another as the lines ignite', () => {
		const { state, random, target } = setup();
		for (let i = 0; i < 4; i++) connect(state, target[i], target[i + 1]);
		connect(state, target[4], target[0]);
		const landed = new Set<number>();
		for (const event of run(state, random, 4500)) {
			if (event.type === 'landing') landed.add(event.cat);
		}
		expect(state.finaleHops).toBe(5);
		expect(landed.size).toBe(5);
	});
});

describe('cat body physics', () => {
	it('hops up and comes down with a landing', () => {
		const body = createBody();
		hop(body, 500);
		let peak = 0;
		let landing = 0;
		for (let t = 0; t < 1500 && !landing; t += STEP) {
			landing = stepBody(body, STEP, REST_TARGET);
			peak = Math.max(peak, body.z);
		}
		expect(peak).toBeGreaterThan(40);
		expect(landing).toBeGreaterThan(300);
		expect(body.z).toBe(0);
	});

	it('squashes on landing and stretches in the air, keeping its volume', () => {
		const body = createBody();
		hop(body, 600);
		stepBody(body, STEP, REST_TARGET);
		stepBody(body, STEP, REST_TARGET);
		expect(bodyScale(body).y).toBeGreaterThan(1);
		expect(bodyScale(body).x).toBeLessThan(1);
		let squashed = 1;
		for (let t = 0; t < 1500; t += STEP) {
			stepBody(body, STEP, REST_TARGET);
			squashed = Math.min(squashed, bodyScale(body).y);
		}
		expect(squashed).toBeLessThan(0.95);
		const scale = bodyScale(body);
		expect(scale.y * scale.x * scale.x).toBeCloseTo(1, 5);
		// It settles back to normal in the end
		expect(scale.y).toBeCloseTo(1, 1);
	});

	it('follows its target with a spring and settles on it', () => {
		const body = createBody();
		for (let t = 0; t < 4000; t += STEP) stepBody(body, STEP, { x: 120, y: -60, squash: 0 });
		expect(body.x).toBeCloseTo(120, 0);
		expect(body.y).toBeCloseTo(-60, 0);
		for (let t = 0; t < 4000; t += STEP) stepBody(body, STEP, REST_TARGET);
		expect(Math.abs(body.x)).toBeLessThan(0.5);
	});

	it('sinks to a lower rest when it dozes', () => {
		const body = createBody();
		for (let t = 0; t < 3000; t += STEP) stepBody(body, STEP, { x: 0, y: 0, squash: -0.08 });
		expect(bodyScale(body).y).toBeCloseTo(0.92, 1);
	});

	it('pounces on the laser dot while chasing it', () => {
		const { state, random } = setup(8);
		const cat = state.cats[0];
		state.nextEventMs = 1e9;
		state.event = { kind: 'laser', remainingMs: 5000, durationMs: 5200 };
		cat.motion = { kind: 'chase', remainingMs: 5000 };
		const landings = run(state, random, 3000).filter((e) => e.type === 'landing');
		expect(landings.length).toBeGreaterThan(1);
		expect(Math.hypot(cat.body.x, cat.body.y)).toBeGreaterThan(10);
	});
});

describe('particles', () => {
	const random = createRandom(9);

	it('are spawned with a life and drop out when it is over', () => {
		const pool: Particle[] = [];
		spawn(pool, 'smoke', 10, 20, random, 4);
		expect(pool).toHaveLength(4);
		stepParticles(pool, 100);
		expect(pool[0].y).toBeLessThan(20);
		expect(age(pool[0])).toBeGreaterThan(0);
		stepParticles(pool, 10_000);
		expect(pool).toHaveLength(0);
	});

	it('are capped so a busy moment cannot flood the renderer', () => {
		const pool: Particle[] = [];
		spawn(pool, 'spark', 0, 0, random, MAX_PARTICLES * 3);
		expect(pool).toHaveLength(MAX_PARTICLES);
	});
});
