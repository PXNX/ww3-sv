import { describe, expect, it } from 'vitest';
import { PRODUCER_IDS, PRODUCERS } from '#lib/game/tycoon/config.js';
import { producerFlavor, producerName } from './tycoonText.js';

describe('producer texts', () => {
	it('lists every producer once in PRODUCER_IDS', () => {
		expect(PRODUCERS.map((producer) => producer.id)).toEqual([...PRODUCER_IDS]);
	});

	it('has a name and a flavor for every producer', () => {
		for (const { id } of PRODUCERS) {
			expect(producerName(id), id).not.toBe(id);
			expect(producerName(id), id).not.toMatch(/^tycoon_/);
			expect(producerFlavor(id), id).not.toBe('');
			expect(producerFlavor(id), id).not.toMatch(/^tycoon_/);
		}
	});

	it('numbers the shared platforms', () => {
		expect(producerName('platform2')).toContain('2');
		expect(producerName('platform23')).toContain('23');
	});
});
