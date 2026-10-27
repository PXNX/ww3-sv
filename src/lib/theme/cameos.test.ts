import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createRandom } from '#lib/game/random.js';
import {
	CAMEO_PLACEHOLDER,
	CAMEOS,
	MASCOT_FLAG,
	cameoAsset,
	cameoFlag,
	cameoPortrait,
	guestFlag,
	guestPortrait,
	pickCameo,
	pickCameoMessage,
	putinPortrait
} from './cameos';

describe('cameos', () => {
	it('has the fourteen-character roster, each listed once', () => {
		expect(CAMEOS.map((cameo) => cameo.id)).toEqual([
			'xi',
			'zelensky',
			'putin',
			'merz',
			'mbs',
			'khamenei',
			'netanyahu',
			'erdogan',
			'macron',
			'modi',
			'starmer',
			'milei',
			'lula',
			'tusk'
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

	it('has a portrait for each guest', () => {
		for (const guest of [
			'vance',
			'kim',
			'maduro',
			'zuckerberg',
			'huang',
			'altman',
			'musk'
		] as const) {
			expect(guestPortrait(guest)).toBe(`/assets/cameos/${guest}.svg`);
			expect(existsSync(`static/assets/cameos/${guest}.svg`), guest).toBe(true);
		}
	});

	it('puts a company logo on a white ground behind each tech guest', () => {
		expect(guestFlag('zuckerberg')).toBe('/assets/flags/meta.svg');
		expect(guestFlag('huang')).toBe('/assets/flags/novideo.svg');
		expect(guestFlag('altman')).toBe('/assets/flags/openai.svg');
		expect(guestFlag('musk')).toBe('/assets/flags/spacex.svg');
		for (const flag of ['meta', 'novideo', 'openai', 'spacex']) {
			expect(existsSync(`static/assets/flags/${flag}.svg`), flag).toBe(true);
		}
	});

	it('has a portrait file for every cameo', () => {
		for (const cameo of CAMEOS) {
			expect(cameoPortrait(cameo.id), cameo.id).toBe(`/assets/cameos/${cameo.id}.svg`);
			expect(existsSync(`static/assets/cameos/${cameo.id}.svg`), cameo.id).toBe(true);
		}
	});

	it('keeps the new leaders behind their own flags', () => {
		expect(cameoFlag('modi')).toBe('/assets/flags/in.svg');
		expect(cameoFlag('starmer')).toBe('/assets/flags/gb.svg');
		expect(cameoFlag('milei')).toBe('/assets/flags/ar.svg');
		expect(cameoFlag('lula')).toBe('/assets/flags/br.svg');
		expect(cameoFlag('tusk')).toBe('/assets/flags/pl.svg');
	});

	it('has a flag file for every cameo and the mascot', () => {
		for (const cameo of CAMEOS) {
			expect(existsSync(`static${cameoFlag(cameo.id)}`)).toBe(true);
		}
		expect(existsSync(`static${MASCOT_FLAG}`)).toBe(true);
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

	it('never picks an excluded cameo', () => {
		const random = createRandom(5);
		for (let i = 0; i < 300; i++) {
			expect(pickCameo(random, undefined, ['putin', 'xi']).id).not.toMatch(/^(putin|xi)$/);
		}
	});

	it('handles random values at the edges of the range', () => {
		expect(pickCameo(() => 0).id).toBe('xi');
		expect(pickCameo(() => 0.999999).id).toBe(CAMEOS.at(-1)!.id);
		expect(pickCameo(() => 0, 'xi').id).toBe('zelensky');
	});
});
