import { describe, expect, it } from 'vitest';
import { EVENT_DURATION_MS, ROOM_EVENTS, type RoomEvent } from './reactions';
import { CALM_LOOK, envelope, roomLook } from './room';
import type { RoomEventState } from './state';

/** The event `elapsedMs` after it began */
function at(kind: RoomEvent, elapsedMs: number): RoomEventState {
	const durationMs = EVENT_DURATION_MS[kind];
	return { kind, durationMs, remainingMs: durationMs - elapsedMs };
}

describe('envelope', () => {
	it('rises, holds and falls', () => {
		expect(envelope(0, 1000, 200, 300)).toBe(0);
		expect(envelope(100, 1000, 200, 300)).toBeCloseTo(0.5);
		expect(envelope(500, 1000, 200, 300)).toBe(1);
		expect(envelope(850, 1000, 200, 300)).toBeCloseTo(0.5);
		expect(envelope(1000, 1000, 200, 300)).toBe(0);
	});

	it('never goes below zero or above one', () => {
		expect(envelope(1500, 1000, 200, 300)).toBe(0);
		expect(envelope(-50, 1000, 200, 300)).toBe(0);
	});
});

describe('roomLook', () => {
	it('is the calm room when nothing is happening', () => {
		expect(roomLook(null)).toEqual(CALM_LOOK);
	});

	it('goes back to calm at the end of every event', () => {
		for (const kind of ROOM_EVENTS) {
			const look = roomLook(at(kind, EVENT_DURATION_MS[kind]));
			expect(look.dim).toBe(0);
			expect(look.candlesOut).toBe(0);
			expect(look.window).toBe(0);
			expect(look.door).toBe(0);
		}
	});

	it('darkens the room for dim lights, and only for them', () => {
		expect(roomLook(at('dim', 2000)).dim).toBeGreaterThan(0.5);
		expect(roomLook(at('draft', 2000)).dim).toBe(0);
	});

	it('blows the candles out and relights them', () => {
		expect(roomLook(at('candles', 1500)).candlesOut).toBe(1);
		expect(roomLook(at('candles', 100)).candlesOut).toBeLessThan(1);
		expect(roomLook(at('candles', 3150)).candlesOut).toBeLessThan(0.2);
	});

	it('opens the window for a draft and the door for a creak', () => {
		expect(roomLook(at('draft', 1500)).window).toBe(1);
		expect(roomLook(at('creak', 1200)).door).toBe(1);
		expect(roomLook(at('creak', 1200)).window).toBe(0);
	});

	it('puts the laser dot on the floor for the whole event', () => {
		for (let t = 0; t <= EVENT_DURATION_MS.laser; t += 400) {
			const { laser } = roomLook(at('laser', t));
			expect(laser).not.toBeNull();
			expect(laser!.x).toBeGreaterThan(100);
		}
		expect(roomLook(at('thunder', 100)).laser).toBeNull();
	});

	it('flashes at the start of thunder, twice, and then only rumbles', () => {
		expect(roomLook(at('thunder', 5)).flash).toBeGreaterThan(0.9);
		expect(roomLook(at('thunder', 200)).flash).toBe(0);
		expect(roomLook(at('thunder', 290)).flash).toBeGreaterThan(0.5);
		expect(roomLook(at('thunder', 1500)).flash).toBe(0);
	});

	it('never flashes with reduced motion: thunder darkens the room steadily instead', () => {
		for (let t = 0; t <= EVENT_DURATION_MS.thunder; t += 10) {
			const look = roomLook(at('thunder', t), true);
			expect(look.flash).toBe(0);
		}
		expect(roomLook(at('thunder', 1200), true).dim).toBeGreaterThan(0.2);
		expect(roomLook(at('candles', 100), true).flicker).toBe(false);
		expect(roomLook(at('candles', 100), false).flicker).toBe(true);
	});
});
