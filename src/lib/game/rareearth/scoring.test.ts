import { describe, expect, it } from 'vitest';
import { COMBO_STEP, DELIVERY_POINTS, MAX_MULTIPLIER, SPEED_BONUS_POINTS } from './config.js';
import { comboMultiplier, scoreDelivery } from './scoring.js';

describe('comboMultiplier', () => {
	it('starts at x1 and rises every COMBO_STEP deliveries', () => {
		expect(comboMultiplier(0)).toBe(1);
		expect(comboMultiplier(COMBO_STEP - 1)).toBe(1);
		expect(comboMultiplier(COMBO_STEP)).toBe(2);
		expect(comboMultiplier(COMBO_STEP * 2)).toBe(3);
	});

	it('is capped and survives junk input', () => {
		expect(comboMultiplier(10_000)).toBe(MAX_MULTIPLIER);
		expect(comboMultiplier(-4)).toBe(1);
		expect(comboMultiplier(Number.NaN)).toBe(1);
	});
});

describe('scoreDelivery', () => {
	it('pays the base plus a bonus for the time left', () => {
		expect(scoreDelivery(0, 0, true).points).toBe(DELIVERY_POINTS);
		expect(scoreDelivery(0, 1, true).points).toBe(DELIVERY_POINTS + SPEED_BONUS_POINTS);
		expect(scoreDelivery(0, 0.5, true).points).toBe(DELIVERY_POINTS + SPEED_BONUS_POINTS / 2);
	});

	it('clamps the time share', () => {
		expect(scoreDelivery(0, 7, true).points).toBe(DELIVERY_POINTS + SPEED_BONUS_POINTS);
		expect(scoreDelivery(0, -3, true).points).toBe(DELIVERY_POINTS);
		expect(scoreDelivery(0, Number.NaN, true).points).toBe(DELIVERY_POINTS);
	});

	it('extends the combo and multiplies for a by-the-book delivery', () => {
		const result = scoreDelivery(COMBO_STEP - 1, 0, true);
		expect(result.combo).toBe(COMBO_STEP);
		expect(result.multiplier).toBe(2);
		expect(result.points).toBe(DELIVERY_POINTS * 2);
	});

	it('pays the plain points and keeps the combo when the rules were not followed', () => {
		const result = scoreDelivery(5, 0, false);
		expect(result).toEqual({ points: DELIVERY_POINTS, combo: 5, multiplier: 1 });
	});
});
