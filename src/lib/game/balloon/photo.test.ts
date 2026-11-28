import { describe, expect, it } from 'vitest';
import { createRandom } from '#lib/game/random.js';
import { PHOTO_IDEAL_LAYER, photoScore } from './photo.js';
import { createGame } from './state.js';
import { layerCentre } from './wind.js';

describe('balloon photo composition', () => {
	it('grades a shot by altitude, framing and weather', () => {
		const state = createGame(createRandom(3));
		const poi = { kind: 'farm' as const, x: state.progress, photographed: false, dwellMs: 0 };
		state.y = layerCentre(PHOTO_IDEAL_LAYER, state.field);
		state.wind = 0;
		const perfect = photoScore(state, poi);
		expect(perfect.altitude).toBe(100);
		expect(perfect.framing).toBe(100);
		expect(perfect.weather).toBe(100);

		state.y = state.field.floorY;
		state.wind = 135;
		poi.x = state.progress + 45;
		const poor = photoScore(state, poi);
		expect(poor.points).toBeLessThan(perfect.points);
		expect(poor.altitude).toBe(0);
		expect(poor.framing).toBe(0);
		expect(poor.weather).toBe(0);
	});
});
