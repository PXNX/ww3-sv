import { describe, expect, it } from 'vitest';
import { createRandom } from '#lib/game/random.js';
import {
	CEILING_Y,
	FLOOR_Y,
	GROUND_Y,
	JET_WARN_MS,
	LAYER_COUNT,
	LAYER_HEIGHT,
	WORLD_HEIGHT
} from './config.js';
import { generateCourse } from './course.js';
import {
	BASE_FIELD,
	balloonField,
	fieldHeightFor,
	jetRows,
	layerTop,
	MAX_TALL_RATIO
} from './field.js';
import { createGame, setBurner, step, type BalloonState } from './state.js';
import { layerCentre, layerOf } from './wind.js';

const STEP = 1000 / 60;

describe('field shape', () => {
	it('is the standard strip by default', () => {
		expect(BASE_FIELD).toEqual({
			height: WORLD_HEIGHT,
			top: 0,
			layerHeight: LAYER_HEIGHT,
			ceilingY: CEILING_Y,
			floorY: FLOOR_Y,
			stretch: 1
		});
		expect(jetRows(2)).toEqual([layerCentre(2)]);
	});

	it('grows the sky upwards, shares it between the layers and keeps the ground', () => {
		const tall = balloonField(800);
		expect(tall.top).toBe(-400);
		expect(tall.floorY).toBe(FLOOR_Y);
		expect(tall.ceilingY).toBe(-400 + CEILING_Y);
		expect(tall.layerHeight * LAYER_COUNT).toBeCloseTo(GROUND_Y + 400);
		expect(layerTop(0, tall)).toBe(tall.top);
		for (let layer = 0; layer < LAYER_COUNT; layer++) {
			expect(layerOf(layerCentre(layer, tall), tall)).toBe(layer);
		}
		expect(layerOf(tall.top - 10, tall)).toBe(0);
		expect(layerOf(GROUND_Y + 10, tall)).toBe(LAYER_COUNT - 1);
		expect(balloonField(10)).toEqual(BASE_FIELD);
	});

	it('stays standard on landscape boxes and fills portrait ones', () => {
		expect(fieldHeightFor(768, 560)).toBe(WORLD_HEIGHT);
		expect(fieldHeightFor(344, 430)).toBe(800);
		expect(fieldHeightFor(344, 2000)).toBe(Math.round(640 * MAX_TALL_RATIO));
		expect(fieldHeightFor(0, 300)).toBe(WORLD_HEIGHT);
	});

	it('spreads a jet pass over a taller layer', () => {
		const tall = balloonField(800);
		const rows = jetRows(1, tall);
		expect(rows).toHaveLength(Math.round(tall.stretch));
		for (const row of rows) expect(layerOf(row, tall)).toBe(1);
	});
});

describe('a taller sky', () => {
	const tall = balloonField(800);

	function climbTime(state: BalloonState, from: number, to: number) {
		const random = createRandom(1);
		state.course = { hazards: [], puffs: [], pois: [] };
		state.nextJetMs = Infinity;
		state.y = layerCentre(from, state.field);
		state.vy = 0;
		setBurner(state, true);
		let ms = 0;
		while (layerOf(state.y, state.field) > to && ms < 10_000) {
			step(state, STEP, random);
			ms += STEP;
		}
		return ms;
	}

	it('takes as long to climb from layer to layer as the standard sky', () => {
		const base = climbTime(createGame(createRandom(3), 3), 4, 1);
		const high = climbTime(createGame(createRandom(3), 3, tall), 4, 1);
		expect(Math.abs(high - base)).toBeLessThanOrEqual(2 * STEP);
	});

	it('starts mid-sky and keeps the balloon inside the taller sky', () => {
		const state = createGame(createRandom(3), 3, tall);
		expect(layerOf(state.y, tall)).toBe(2);
		state.course = { hazards: [], puffs: [], pois: [] };
		state.nextJetMs = Infinity;
		setBurner(state, true);
		for (let t = 0; t < 3000; t += STEP) step(state, STEP, createRandom(1));
		expect(state.y).toBe(tall.ceilingY);
	});

	it('places hazards and puffs all over it, with more hazards for the room', () => {
		const base = generateCourse(createRandom(7));
		const course = generateCourse(createRandom(7), tall);
		const ratio = course.hazards.length / base.hazards.length;
		expect(ratio).toBeGreaterThan(tall.stretch * 0.8);
		expect(ratio).toBeLessThan(tall.stretch * 1.2);
		for (const thing of [...course.hazards.map((h) => h.baseY), ...course.puffs.map((p) => p.y)]) {
			expect(thing).toBeGreaterThanOrEqual(tall.ceilingY);
			expect(thing).toBeLessThanOrEqual(tall.floorY);
		}
		expect(Math.min(...course.hazards.map((h) => h.baseY))).toBeLessThan(0);
	});

	it('lets a jet pass hit a balloon anywhere near one of its rows', () => {
		const state = createGame(createRandom(3), 3, tall);
		state.course = { hazards: [], puffs: [], pois: [] };
		state.nextJetMs = Infinity;
		const rows = jetRows(1, tall);
		// A pass that is already flying, right over the balloon's column
		state.jets = [{ layer: 1, ageMs: JET_WARN_MS + 1000, x: 170, spent: false }];
		const before = state.lives;
		// Pin the balloon on the lowest row while the jets sweep past it
		for (let t = 0; t < 400 && state.lives === before; t += STEP) {
			state.y = rows[rows.length - 1];
			state.vy = 0;
			step(state, STEP, createRandom(1));
		}
		expect(state.lives).toBe(before - 1);
	});
});
