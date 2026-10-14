import { describe, expect, it } from 'vitest';
import {
	angleDiff,
	createBody,
	endPoint,
	fitEnds,
	hullPolygon,
	hullSamples,
	moveAt,
	pullEnd,
	pushAlong,
	worldSamples
} from './body';
import { SHIP_BEAM, SHIP_LENGTH } from './config';

const near = (a: number, b: number, digits = 6) => expect(a).toBeCloseTo(b, digits);

describe('geometry', () => {
	it('places the bow and stern along the heading', () => {
		const body = createBody(100, 200, 0);
		expect(endPoint(body, 'bow')).toEqual({ x: 100 + SHIP_LENGTH / 2, y: 200 });
		const stern = endPoint(body, 'stern');
		near(stern.x, 100 - SHIP_LENGTH / 2);
		near(stern.y, 200);

		const north = createBody(100, 200, -Math.PI / 2);
		near(endPoint(north, 'bow').y, 200 - SHIP_LENGTH / 2);
		near(endPoint(north, 'bow').x, 100);
	});

	it('has a five-point hull that narrows to the bow', () => {
		const hull = hullPolygon(createBody(0, 0, 0));
		expect(hull).toHaveLength(5);
		expect(hull[2]).toEqual({ x: SHIP_LENGTH / 2, y: 0 });
	});

	it('covers the hull with samples including the bow tip and the stern corners', () => {
		const samples = hullSamples(SHIP_LENGTH, SHIP_BEAM);
		expect(samples).toContainEqual({ x: SHIP_LENGTH / 2, y: 0 });
		expect(samples).toContainEqual({ x: -SHIP_LENGTH / 2, y: SHIP_BEAM / 2 });
		expect(worldSamples(createBody(0, 0, 0))).toHaveLength(samples.length);
	});

	it('measures angle differences the short way round', () => {
		near(angleDiff(0.1, -0.1), 0.2);
		near(angleDiff(Math.PI - 0.1, -Math.PI + 0.1), -0.2);
		near(angleDiff(2 * Math.PI, 0), 0);
	});
});

describe('moving a point of the ship', () => {
	it('puts the pulled point exactly on its target when nothing resists', () => {
		const body = createBody(180, 250, 0.3);
		const from = endPoint(body, 'bow');
		moveAt(body, from, { x: 12, y: -7 });
		const to = endPoint(body, 'bow');
		near(to.x, from.x + 12);
		near(to.y, from.y - 7);
	});

	it('turns the ship when an end is pulled sideways and slides it when pulled along', () => {
		const sideways = createBody(180, 250, 0);
		moveAt(sideways, endPoint(sideways, 'bow'), { x: 0, y: -10 });
		expect(sideways.angle).toBeLessThan(0);
		expect(sideways.y).toBeLessThan(250);
		// Pulling a plank by its end sideways moves the middle by a quarter and swings the rest
		expect(Math.abs(sideways.y - (250 - 10 / 4))).toBeLessThan(0.5);

		const along = createBody(180, 250, 0);
		moveAt(along, endPoint(along, 'bow'), { x: 10, y: 0 });
		near(along.angle, 0);
		near(along.x, 190);
	});

	it('keeps the other end of a hull pivoting when the first end is pulled', () => {
		const body = createBody(180, 250, 0);
		const stern = endPoint(body, 'stern');
		pullEnd(body, 'bow', { x: body.x + SHIP_LENGTH / 2, y: 240 }, 100);
		// The stern went the opposite way: a pure sideways pull is a push on the centre plus a turn
		expect(endPoint(body, 'stern').y).toBeGreaterThan(stern.y);
	});

	it('limits a pull to maxMove and reports the wanted distance', () => {
		const body = createBody(180, 250, 0);
		const start = endPoint(body, 'bow');
		const wanted = pullEnd(body, 'bow', { x: start.x, y: start.y - 100 }, 5);
		near(wanted, 100);
		const end = endPoint(body, 'bow');
		near(Math.hypot(end.x - start.x, end.y - start.y), 5, 3);
	});

	it('pushes a point along a normal only: the sliding part is left alone', () => {
		const body = createBody(180, 250, 0);
		const bow = endPoint(body, 'bow');
		pushAlong(body, bow, { x: -1, y: 0 }, 4);
		// Pushing straight at the centre line slides the hull, with no turn
		near(body.x, 176);
		near(body.angle, 0);
		const corner = createBody(180, 250, 0);
		pushAlong(corner, { x: 180 + 80, y: 250 - 18 }, { x: 0, y: 1 }, 6);
		expect(corner.angle).toBeGreaterThan(0);
	});
});

describe('fitting both ends', () => {
	it('lands exactly on two targets that are one hull length apart', () => {
		const body = createBody(180, 250, 0.3);
		const half = SHIP_LENGTH / 2;
		const bow = { x: 180 + 10, y: 250 - half };
		const stern = { x: 180 + 10, y: 250 + half };
		for (let i = 0; i < 200; i++) fitEnds(body, bow, stern, 5);
		near(body.x, 190, 3);
		near(body.y, 250, 3);
		near(body.angle, -Math.PI / 2, 3);
	});

	it('moves at most maxMove per call', () => {
		const body = createBody(180, 250, 0);
		fitEnds(body, { x: 600, y: 250 }, { x: 400, y: 250 }, 5);
		expect(Math.hypot(body.x - 180, body.y - 250)).toBeLessThanOrEqual(5.0001);
	});
});
