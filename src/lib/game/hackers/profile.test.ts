import { describe, expect, it } from 'vitest';
import { emptyHardware, hardwareSpec } from './hardware';
import {
	bankRun,
	buyHardware,
	defaultProfile,
	hardwareMaxed,
	isFavorite,
	isProfile,
	nextHardwareCost,
	toggleFavorite
} from './profile';

describe('hackers profile', () => {
	it('starts empty', () => {
		expect(defaultProfile()).toEqual({ bank: 0, hardware: emptyHardware(), favorites: [] });
	});

	it('banks what a run earned and ignores nothing to bank', () => {
		const profile = bankRun(defaultProfile(), 420);
		expect(profile.bank).toBe(420);
		expect(bankRun(profile, -10)).toBe(profile);
		expect(bankRun(profile, Number.NaN)).toBe(profile);
	});

	it('spends the bank on hardware levels and refuses what is too dear', () => {
		const poor = defaultProfile();
		expect(buyHardware(poor, 'cpu')).toBeNull();

		const rich = { ...poor, bank: 10_000 };
		const bought = buyHardware(rich, 'cpu')!;
		expect(bought.hardware.cpu).toBe(1);
		expect(bought.bank).toBe(10_000 - nextHardwareCost(rich, 'cpu')!);
		expect(nextHardwareCost(bought, 'cpu')!).toBeGreaterThan(nextHardwareCost(rich, 'cpu')!);
	});

	it('stops at the maximum level of a part', () => {
		let profile = { ...defaultProfile(), bank: 1_000_000 };
		const max = hardwareSpec('gpu').maxLevel;
		for (let level = 0; level < max; level++) {
			profile = buyHardware(profile, 'gpu')!;
		}
		expect(profile.hardware.gpu).toBe(max);
		expect(hardwareMaxed(profile, 'gpu')).toBe(true);
		expect(nextHardwareCost(profile, 'gpu')).toBeNull();
		expect(buyHardware(profile, 'gpu')).toBeNull();
	});

	it('marks and unmarks addresses', () => {
		const profile = defaultProfile();
		const starred = toggleFavorite(profile, '10.0.17.44');
		expect(isFavorite(starred, '10.0.17.44')).toBe(true);
		expect(starred.favorites).toEqual(['10.0.17.44']);

		const more = toggleFavorite(starred, '192.168.77.13');
		expect(more.favorites).toEqual(['10.0.17.44', '192.168.77.13']);

		const less = toggleFavorite(more, '10.0.17.44');
		expect(less.favorites).toEqual(['192.168.77.13']);
		expect(isFavorite(less, '10.0.17.44')).toBe(false);
		expect(toggleFavorite(less, '')).toBe(less);
	});

	it('guards what comes out of local storage', () => {
		expect(isProfile(defaultProfile())).toBe(true);
		expect(
			isProfile({ bank: 5, hardware: { cpu: 1, ram: 0, gpu: 0 }, favorites: ['1.2.3.4'] })
		).toBe(true);
		expect(isProfile({ bank: -1, hardware: emptyHardware(), favorites: [] })).toBe(false);
		expect(isProfile({ bank: 5, hardware: { cpu: 1 }, favorites: [] })).toBe(false);
		expect(isProfile({ bank: 5, hardware: emptyHardware(), favorites: [7] })).toBe(false);
		expect(isProfile({ bank: 5, hardware: emptyHardware() })).toBe(false);
		expect(isProfile(null)).toBe(false);
		expect(isProfile('profile')).toBe(false);
	});
});
