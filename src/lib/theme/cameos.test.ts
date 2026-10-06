import { describe, expect, it } from 'vitest';
import { createRandom } from '$lib/game/random';
import { CAMEO_PLACEHOLDER, CAMEOS, cameoAsset, cameoPortrait, pickCameo } from './cameos';

describe('cameos', () => {
	it('has the nine-character roster, each listed once', () => {
		expect(CAMEOS.map((cameo) => cameo.id)).toEqual([
			'xi',
			'zelensky',
			'putin',
			'merz',
			'mbs',
			'khamenei',
			'netanyahu',
			'erdogan',
			'macron'
		]);
	});

	it('gives every cameo a name and a message', () => {
		for (const cameo of CAMEOS) {
			expect(cameo.name().length).toBeGreaterThan(0);
			expect(cameo.message({ characterName: 'Mascot' }).length).toBeGreaterThan(0);
		}
	});

	it('falls back to the placeholder portrait until one is supplied', () => {
		for (const cameo of CAMEOS) expect(cameoPortrait(cameo.id)).toBe(CAMEO_PLACEHOLDER);
	});

	it('builds URLs for files in static/assets/cameos', () => {
		expect(cameoAsset('businessman-calm.svg')).toBe('/assets/cameos/businessman-calm.svg');
		expect(CAMEO_PLACEHOLDER).toBe(cameoAsset('_placeholder.svg'));
	});

	it('eventually picks every cameo', () => {
		const random = createRandom(3);
		const seen = new Set<string>();
		for (let i = 0; i < 500; i++) seen.add(pickCameo(random).id);
		expect(seen.size).toBe(CAMEOS.length);
	});

	it('never picks the same cameo twice in a row', () => {
		const random = createRandom(11);
		let previous = pickCameo(random).id;
		for (let i = 0; i < 500; i++) {
			const next = pickCameo(random, previous).id;
			expect(next).not.toBe(previous);
			previous = next;
		}
	});

	it('handles random values at the edges of the range', () => {
		expect(pickCameo(() => 0).id).toBe('xi');
		expect(pickCameo(() => 0.999999).id).toBe('macron');
		expect(pickCameo(() => 0, 'xi').id).toBe('zelensky');
	});
});
