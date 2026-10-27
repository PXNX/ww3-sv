import { describe, expect, it } from 'vitest';
import { CAMEOS, cameoPortrait } from './cameos';
import { LEADERS, leaderById, leaderReaction } from './leaders';

describe('leaders', () => {
	it('lists the mascot first, then the roster, then the guests', () => {
		expect(LEADERS.map((leader) => leader.id)).toEqual([
			'trump',
			...CAMEOS.map((cameo) => cameo.id),
			'kim',
			'maduro',
			'zuckerberg'
		]);
	});

	it('looks a leader up by id and rejects an unknown one', () => {
		expect(leaderById('kim').flag).toBe('/assets/flags/kp.svg');
		expect(leaderById('maduro').flag).toBe('/assets/flags/ve.svg');
		expect(leaderById('modi').flag).toBe('/assets/flags/in.svg');
		expect(leaderById('lula').flag).toBe('/assets/flags/br.svg');
		expect(() => leaderById('nope' as never)).toThrow('Unknown leader');
	});
});

describe('leader reactions', () => {
	it('shows Putin furious when the player won and calm when the player lost', () => {
		expect(leaderReaction('putin', 'won')).toBe('/assets/cameos/putin-angry.svg');
		expect(leaderReaction('putin', 'lost')).toBe(cameoPortrait('putin'));
	});

	it('keeps one face for everyone else', () => {
		expect(leaderReaction('merz', 'won')).toBe(cameoPortrait('merz'));
		expect(leaderReaction('kim', 'lost')).toBe('/assets/cameos/kim.svg');
	});

	it('has the mascot smug on a win and upset, never sunk, on a loss', () => {
		expect(leaderReaction('trump', 'won')).toBe('/assets/mascot/mascot-smug.svg');
		expect(leaderReaction('trump', 'lost', () => 0)).toBe('/assets/mascot/mascot-crying.svg');
		expect(leaderReaction('trump', 'lost', () => 0.999999)).toBe(
			'/assets/mascot/mascot-facepalm.svg'
		);
	});
});
