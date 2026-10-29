import { describe, expect, it } from 'vitest';
import { newCareer } from '#lib/game/career/profile.js';
import { GIFT_CODES, findGift, normalizeCode } from './config.js';
import { redeemGift } from './redeem.js';

const profile = newCareer(new Date(2026, 9, 29, 12));

describe('gift codes', () => {
	it('ignores the case, spaces and dashes of what was typed', () => {
		expect(normalizeCode(' ww3-gift ')).toBe('WW3GIFT');
		expect(findGift('ww3 gift')?.code).toBe('WW3GIFT');
		expect(findGift('')).toBeUndefined();
		expect(findGift('nope')).toBeUndefined();
	});

	it('lists every code once, in the form the game accepts', () => {
		const codes = GIFT_CODES.map((gift) => gift.code);
		expect(new Set(codes).size).toBe(codes.length);
		for (const gift of GIFT_CODES) {
			expect(normalizeCode(gift.code)).toBe(gift.code);
			expect(gift.value).toBeGreaterThan(0);
		}
	});

	it('pays revival tokens or Fake News straight into the profile', () => {
		const revive = redeemGift(profile, [], 'WW3GIFT');
		expect(revive.status).toBe('ok');
		if (revive.status === 'ok') expect(revive.profile.revives).toBe(profile.revives + 1);
		const coins = redeemGift(profile, [], 'oilboom');
		expect(coins.status).toBe('ok');
		if (coins.status === 'ok') {
			expect(coins.profile.coins).toBe(profile.coins + 100);
			expect(coins.profile.revives).toBe(profile.revives);
		}
	});

	it('refuses an unknown code and one that was redeemed already', () => {
		expect(redeemGift(profile, [], 'NOPE').status).toBe('unknown');
		expect(redeemGift(profile, ['WW3GIFT'], 'ww3gift').status).toBe('used');
		expect(redeemGift(profile, ['WW3GIFT'], 'OILBOOM').status).toBe('ok');
	});
});
