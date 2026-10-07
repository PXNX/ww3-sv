import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createRandom } from '#lib/game/random.js';
import {
	CAMEO_PLACEHOLDER,
	CAMEOS,
	cameoAsset,
	cameoPortrait,
	guestPortrait,
	pickCameo,
	pickCameoMessage,
	putinPortrait
} from './cameos';

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

	it('gives every cameo a name and several distinct messages', () => {
		for (const cameo of CAMEOS) {
			expect(cameo.name().length).toBeGreaterThan(0);
			expect(cameo.messages.length).toBeGreaterThanOrEqual(3);
			const lines = cameo.messages.map((message) => message({ characterName: 'Mascot' }));
			for (const line of lines) expect(line.length).toBeGreaterThan(0);
			expect(new Set(lines).size).toBe(lines.length);
		}
	});

	it('picks a message index inside the cameo pool, including at the edges', () => {
		const cameo = CAMEOS[0];
		expect(pickCameoMessage(() => 0, cameo)).toBe(0);
		expect(pickCameoMessage(() => 0.999999, cameo)).toBe(cameo.messages.length - 1);
	});

	it('has a portrait file for the vance guest', () => {
		expect(guestPortrait('vance')).toBe('/assets/cameos/vance.svg');
		expect(existsSync('static/assets/cameos/vance.svg')).toBe(true);
	});

	it('has a portrait file for every cameo', () => {
		for (const cameo of CAMEOS) {
			expect(cameoPortrait(cameo.id)).toBe(`/assets/cameos/${cameo.id}.svg`);
			expect(existsSync(`static/assets/cameos/${cameo.id}.svg`)).toBe(true);
		}
	});

	it('has a portrait file for every Putin mood', () => {
		expect(putinPortrait('calm')).toBe(cameoPortrait('putin'));
		for (const mood of ['calm', 'angry', 'sad'] as const) {
			expect(existsSync(`static${putinPortrait(mood)}`)).toBe(true);
		}
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
