import { describe, expect, it } from 'vitest';
import { MODES } from './registry.js';
import { PLAY_STYLES, STYLE_OF_MODE } from './styles.js';

describe('play styles', () => {
	it('give every game exactly one known style', () => {
		for (const mode of MODES) {
			expect(PLAY_STYLES, mode.id).toContain(STYLE_OF_MODE[mode.id]);
		}
		expect(Object.keys(STYLE_OF_MODE).sort()).toEqual(MODES.map((mode) => mode.id).sort());
	});

	it('leave no style without a game', () => {
		for (const style of PLAY_STYLES) {
			expect(
				MODES.some((mode) => STYLE_OF_MODE[mode.id] === style),
				style
			).toBe(true);
		}
	});
});
