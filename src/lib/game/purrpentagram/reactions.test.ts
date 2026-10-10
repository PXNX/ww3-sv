import { describe, expect, it } from 'vitest';
import { createRandom } from '#lib/game/random.js';
import { PERSONALITIES } from './cats';
import {
	ANIMATIONS,
	blocksSeat,
	drawEvent,
	EVENT_DURATION_MS,
	laserPoint,
	nextEventGapMs,
	reaction,
	ROOM_EVENTS,
	type RoomEvent
} from './reactions';
import { EVENT_GAP_MAX_MS, EVENT_GAP_MIN_MS } from './config';

describe('reaction', () => {
	it('answers every event for every personality with a known animation', () => {
		for (const personality of PERSONALITIES) {
			for (const event of ROOM_EVENTS) {
				const result = reaction({ personality }, event);
				expect(ANIMATIONS).toContain(result.animation);
				expect(result.durationMs).toBeGreaterThanOrEqual(0);
				expect(Math.abs(result.moodDelta)).toBeLessThanOrEqual(0.5);
			}
		}
	});

	it('makes the same event play out differently for different personalities', () => {
		const thunder = PERSONALITIES.map(
			(personality) => reaction({ personality }, 'thunder').animation
		);
		expect(new Set(thunder).size).toBeGreaterThanOrEqual(3);
	});

	it('has the skittish cat hide, the lazy one ignore and the curious one chase the laser', () => {
		expect(reaction({ personality: 'skittish' }, 'thunder').animation).toBe('hide');
		expect(reaction({ personality: 'lazy' }, 'thunder').animation).toBe('ignore');
		expect(reaction({ personality: 'curious' }, 'laser').animation).toBe('chase');
		expect(reaction({ personality: 'grumpy' }, 'draft').animation).toBe('hiss');
	});

	it('upsets a cat that hides and leaves a cat that ignores it alone', () => {
		expect(reaction({ personality: 'skittish' }, 'thunder').moodDelta).toBeLessThan(0);
		expect(reaction({ personality: 'lazy' }, 'thunder').moodDelta).toBe(0);
		expect(reaction({ personality: 'lazy' }, 'thunder').durationMs).toBe(0);
	});

	it('keeps the chase going exactly as long as the laser dot is on the floor', () => {
		expect(reaction({ personality: 'curious' }, 'laser').durationMs).toBe(EVENT_DURATION_MS.laser);
	});
});

describe('blocksSeat', () => {
	it('is true only for a cat that is hiding or has run off', () => {
		expect(blocksSeat('hide')).toBe(true);
		expect(blocksSeat('chase')).toBe(true);
		expect(blocksSeat('hiss')).toBe(false);
		expect(blocksSeat('flick')).toBe(false);
		expect(blocksSeat(null)).toBe(false);
	});
});

describe('room events', () => {
	it('cycles through every event before any comes round again', () => {
		const random = createRandom(7);
		const bag: RoomEvent[] = [];
		const first = ROOM_EVENTS.map(() => drawEvent(bag, random));
		const second = ROOM_EVENTS.map(() => drawEvent(bag, random));
		expect([...first].sort()).toEqual([...ROOM_EVENTS].sort());
		expect([...second].sort()).toEqual([...ROOM_EVENTS].sort());
	});

	it('waits a different, bounded time between events', () => {
		const random = createRandom(3);
		const gaps = Array.from({ length: 50 }, () => nextEventGapMs(random));
		expect(Math.min(...gaps)).toBeGreaterThanOrEqual(EVENT_GAP_MIN_MS);
		expect(Math.max(...gaps)).toBeLessThan(EVENT_GAP_MAX_MS);
		expect(new Set(gaps).size).toBeGreaterThan(10);
	});

	it('keeps the laser dot on the floor for its whole run', () => {
		for (let progress = 0; progress <= 1; progress += 0.05) {
			const { x, y } = laserPoint(progress);
			expect(x).toBeGreaterThan(100);
			expect(x).toBeLessThan(900);
			expect(y).toBeGreaterThan(100);
			expect(y).toBeLessThan(900);
		}
	});
});
