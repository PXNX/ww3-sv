import { describe, expect, it } from 'vitest';
import { cloneBody, createBody, endPoint } from './body';
import { createCanal, maxDepth } from './canal';
import { MAX_FREE_TILT } from './config';
import { isFree, jamDepth, resolveBanks, stepBody, tiltFromCanal, type Hold } from './physics';

function hold(
	end: 'bow' | 'stern',
	body: ReturnType<typeof createBody>,
	pointer: { x: number; y: number }
): Hold {
	const at = endPoint(body, end);
	return {
		pointerId: end === 'bow' ? 1 : 2,
		end,
		pointer,
		offset: { x: at.x - pointer.x, y: at.y - pointer.y }
	};
}

describe('free condition', () => {
	it('is true for a ship floating along the middle of the canal', () => {
		const canal = createCanal(6);
		const body = createBody(180, 250, -Math.PI / 2);
		expect(maxDepth(canal, body)).toBe(0);
		expect(isFree(canal, body)).toBe(true);
	});

	it('is false for a ship wedged across the canal', () => {
		const canal = createCanal(6);
		const body = createBody(180, 250, 0.3);
		expect(jamDepth(canal, body)).toBeGreaterThan(0.5);
		expect(isFree(canal, body)).toBe(false);
	});

	it('is false while the hull touches a bank it would grind along when sliding', () => {
		const canal = createCanal(3);
		// Three tiles of channel: a vertical ship fits with room to spare, a tilted one does not
		expect(isFree(canal, createBody(170, 250, -Math.PI / 2))).toBe(true);
		expect(isFree(canal, createBody(170, 250, -Math.PI / 2 + 0.3))).toBe(false);
	});

	it('is false for a ship that is too far across the canal even in open water', () => {
		const canal = createCanal(8);
		const crooked = createBody(180, 250, -Math.PI / 2 + MAX_FREE_TILT + 0.05);
		// Plenty of room: only the tilt rule can fail it
		expect(maxDepth(canal, crooked)).toBe(0);
		expect(tiltFromCanal(crooked)).toBeGreaterThan(MAX_FREE_TILT);
		expect(isFree(canal, crooked)).toBe(false);
		expect(isFree(canal, createBody(180, 250, -Math.PI / 2 + MAX_FREE_TILT - 0.05))).toBe(true);
	});

	it('does not care which way the bow points', () => {
		const canal = createCanal(6);
		expect(isFree(canal, createBody(180, 250, Math.PI / 2))).toBe(true);
		expect(isFree(canal, createBody(180, 250, -Math.PI / 2))).toBe(true);
	});

	it('measures the tilt from the canal axis', () => {
		expect(tiltFromCanal(createBody(0, 0, -Math.PI / 2))).toBeCloseTo(0);
		expect(tiltFromCanal(createBody(0, 0, 0))).toBeCloseTo(Math.PI / 2);
		expect(tiltFromCanal(createBody(0, 0, Math.PI / 2 + 0.2))).toBeCloseTo(0.2);
	});
});

describe('stepBody', () => {
	it('leaves a ship alone when nobody holds it', () => {
		const canal = createCanal(8);
		const body = createBody(180, 250, -Math.PI / 2);
		const before = cloneBody(body);
		const result = stepBody(canal, body, [], 0, 10);
		expect(body).toEqual(before);
		expect(result.moved).toBe(0);
		expect(result.effort).toBe(0);
	});

	it('keeps a held end exactly under the finger in open water', () => {
		const canal = createCanal(8);
		const body = createBody(180, 250, -Math.PI / 2);
		const bow = endPoint(body, 'bow');
		// Grabbed a little off the very tip: the offset is kept, nothing jumps
		const pointer = { x: bow.x + 9, y: bow.y + 14 };
		const grab = hold('bow', body, pointer);
		stepBody(canal, body, [grab], 0, 10);
		const still = endPoint(body, 'bow');
		expect(still.x).toBeCloseTo(bow.x, 6);
		expect(still.y).toBeCloseTo(bow.y, 6);

		grab.pointer = { x: pointer.x + 20, y: pointer.y + 10 };
		for (let i = 0; i < 60; i++) stepBody(canal, body, [grab], 0, 10);
		const moved = endPoint(body, 'bow');
		expect(moved.x).toBeCloseTo(bow.x + 20, 2);
		expect(moved.y).toBeCloseTo(bow.y + 10, 2);
	});

	it('slides and turns the ship rigidly when one end is pulled sideways', () => {
		const canal = createCanal(8);
		const body = createBody(180, 300, -Math.PI / 2);
		const stern = endPoint(body, 'stern');
		const grab = hold('bow', body, endPoint(body, 'bow'));
		grab.pointer = { x: grab.pointer.x + 25, y: grab.pointer.y };
		for (let i = 0; i < 60; i++) stepBody(canal, body, [grab], 0, 10);
		expect(body.angle).not.toBeCloseTo(-Math.PI / 2, 2);
		// The other end moved too: a plank pulled by one end does not pivot around the other
		expect(endPoint(body, 'stern').x).not.toBeCloseTo(stern.x, 1);
		// And the length is untouched
		const a = endPoint(body, 'bow');
		const b = endPoint(body, 'stern');
		expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeCloseTo(body.length, 6);
	});

	it('fits the ship between two held ends', () => {
		const canal = createCanal(8);
		const body = createBody(180, 300, -Math.PI / 2);
		const bowHold = hold('bow', body, endPoint(body, 'bow'));
		const sternHold = hold('stern', body, endPoint(body, 'stern'));
		bowHold.pointer = { x: bowHold.pointer.x + 15, y: bowHold.pointer.y };
		sternHold.pointer = { x: sternHold.pointer.x + 15, y: sternHold.pointer.y };
		for (let i = 0; i < 90; i++) stepBody(canal, body, [bowHold, sternHold], 0, 10);
		expect(body.x).toBeCloseTo(195, 1);
		expect(body.angle).toBeCloseTo(-Math.PI / 2, 2);
	});

	it('stops a held end at the bank and cannot be dragged into it', () => {
		const canal = createCanal(6);
		const body = createBody(180, 250, -Math.PI / 2);
		const grab = hold('bow', body, endPoint(body, 'bow'));
		grab.pointer = { x: grab.pointer.x - 150, y: grab.pointer.y };
		for (let i = 0; i < 180; i++) stepBody(canal, body, [grab], 0, 10);
		expect(maxDepth(canal, body)).toBeLessThan(0.1);
		expect(body.x).toBeGreaterThan(120);
	});

	it('reports a bump when a pull is stopped hard by a bank', () => {
		const canal = createCanal(6);
		const body = createBody(150, 250, -Math.PI / 2);
		const grab = hold('stern', body, endPoint(body, 'stern'));
		grab.pointer = { x: grab.pointer.x - 60, y: grab.pointer.y };
		let impact = 0;
		for (let i = 0; i < 120; i++)
			impact = Math.max(impact, stepBody(canal, body, [grab], 0, 10).impact);
		expect(impact).toBeGreaterThan(0);
	});

	it('moves slowly while stuck in the mud and quickly once it has let go', () => {
		const canal = createCanal(8);
		const mudded = createBody(180, 250, -Math.PI / 2);
		const loose = createBody(180, 250, -Math.PI / 2);
		const target = (body: typeof mudded) => {
			const grab = hold('bow', body, endPoint(body, 'bow'));
			grab.pointer = { x: grab.pointer.x + 30, y: grab.pointer.y };
			return grab;
		};
		const a = target(mudded);
		const b = target(loose);
		for (let i = 0; i < 20; i++) {
			stepBody(canal, mudded, [a], 50, 50);
			stepBody(canal, loose, [b], 0, 50);
		}
		const mudShift = Math.abs(endPoint(mudded, 'bow').x - 180);
		const looseShift = Math.abs(endPoint(loose, 'bow').x - 180);
		expect(mudShift).toBeLessThan(looseShift / 10);
	});

	it('wears the mud away by pulling and much faster by wiggling', () => {
		const canal = createCanal(8);
		const pulled = createBody(180, 250, -Math.PI / 2);
		const wiggled = createBody(180, 250, -Math.PI / 2);
		const pull = hold('bow', pulled, endPoint(pulled, 'bow'));
		const wig = hold('bow', wiggled, endPoint(wiggled, 'bow'));
		let allowedPull = 40;
		let allowedWig = 40;
		let wiggles = 0;
		for (let i = 0; i < 120; i++) {
			pull.pointer = { x: endPoint(pulled, 'bow').x + 40, y: endPoint(pulled, 'bow').y };
			const a = stepBody(canal, pulled, [pull], allowedPull, 40);
			allowedPull = a.allowed;
			const dir = Math.floor(i / 10) % 2 === 0 ? 40 : -40;
			wig.pointer = { x: endPoint(wiggled, 'bow').x + dir, y: endPoint(wiggled, 'bow').y };
			const w = stepBody(canal, wiggled, [wig], allowedWig, 40);
			allowedWig = w.allowed;
			wiggles += w.wiggles;
		}
		expect(allowedPull).toBeLessThan(40);
		expect(wiggles).toBeGreaterThan(5);
		expect(allowedWig).toBeLessThan(allowedPull);
	});

	it('never lets the allowance grow', () => {
		const canal = createCanal(6);
		const body = createBody(180, 250, 0.3);
		const grab = hold('bow', body, endPoint(body, 'bow'));
		let allowed = maxDepth(canal, body);
		const start = allowed;
		grab.pointer = { x: grab.pointer.x + 10, y: grab.pointer.y - 30 };
		for (let i = 0; i < 300; i++) {
			const next = stepBody(canal, body, [grab], allowed, start).allowed;
			expect(next).toBeLessThanOrEqual(allowed);
			allowed = next;
		}
	});
});

describe('resolveBanks', () => {
	it('returns 0 when nothing is too deep', () => {
		const canal = createCanal(8);
		expect(resolveBanks(canal, createBody(180, 250, -Math.PI / 2), 0)).toBe(0);
		const across = createBody(180, 250, 0.3);
		expect(resolveBanks(canal, across, maxDepth(canal, across) + 1)).toBe(0);
	});

	it('does not drift when run again on a settled ship', () => {
		const canal = createCanal(6);
		const body = createBody(180, 250, 0.3);
		resolveBanks(canal, body, 0);
		const settled = cloneBody(body);
		for (let i = 0; i < 5; i++) resolveBanks(canal, body, 0);
		expect(Math.abs(body.x - settled.x)).toBeLessThan(1);
		expect(Math.abs(body.angle - settled.angle)).toBeLessThan(0.02);
	});
});
