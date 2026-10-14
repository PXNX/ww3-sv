import { describe, expect, it } from 'vitest';
import { SEAT_COUNT } from './config.js';
import { SEATS } from './seats.js';

describe('seats', () => {
	it('has the five permanent seats, each once', () => {
		expect(SEATS).toHaveLength(SEAT_COUNT);
		expect(new Set(SEATS).size).toBe(SEAT_COUNT);
	});
});
