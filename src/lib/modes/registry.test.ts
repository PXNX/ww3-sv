import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LEADERS } from '#lib/theme/leaders.js';
import { MODES, modeById, modesFeaturing } from './registry';

describe('mode leaders', () => {
	it('lists each leader at most once per mode', () => {
		for (const mode of MODES) {
			expect(new Set(mode.leaders).size, mode.id).toBe(mode.leaders.length);
		}
	});

	it('features every leader in at least one mode, so no filter comes up empty', () => {
		for (const leader of LEADERS) {
			expect(modesFeaturing(leader.id).length, leader.id).toBeGreaterThan(0);
		}
	});

	it('leaves the cat ritual and the centrifuge without a country', () => {
		expect(modeById('purrpentagram').leaders).toEqual([]);
		expect(modeById('centrifuge').leaders).toEqual([]);
	});

	it('filters by leader and keeps registry order', () => {
		expect(modesFeaturing('xi').map((mode) => mode.id)).toEqual(['whack', 'beltroad', 'balloon']);
		expect(modesFeaturing('trump').map((mode) => mode.id)).toEqual([
			'blocks',
			'minefield',
			'convoy',
			'merge',
			'venezuela',
			'balloon',
			'leakpatrol'
		]);
	});

	it('looks a mode up by id and rejects an unknown one', () => {
		expect(modeById('chess').leaders).toEqual(['zelensky', 'putin', 'modi', 'starmer']);
		expect(() => modeById('nope' as never)).toThrow('Unknown mode');
	});

	it('gives each planned mode its countries while it is still coming soon', () => {
		expect(modeById('redsquare').leaders).toContain('putin');
		expect(modeById('petrobras').leaders).toContain('lula');
		expect(modeById('petrobras').leaders).toContain('zuckerberg');
		expect(modeById('bordershift').leaders).toContain('tusk');
		expect(modeById('falklands').leaders).toEqual(['starmer', 'milei', 'modi']);
	});
});

describe('leader artwork', () => {
	it('has a portrait and a flag file for every leader', () => {
		for (const leader of LEADERS) {
			expect(existsSync(`static${leader.portrait}`), `${leader.id} portrait`).toBe(true);
			expect(existsSync(`static${leader.flag}`), `${leader.id} flag`).toBe(true);
		}
	});
});
