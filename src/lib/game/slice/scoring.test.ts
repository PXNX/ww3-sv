import { describe, expect, it } from 'vitest';
import { COMBO_CAP, COMBO_STEP, COMBO_WINDOW_MS } from './config';
import { breakCombo, comboBonus, createCombo, registerSlice, sliceScore } from './scoring';

describe('comboBonus', () => {
	it('is nothing for a lone slice and grows by a step per extra slice', () => {
		expect(comboBonus(0)).toBe(0);
		expect(comboBonus(1)).toBe(0);
		expect(comboBonus(2)).toBe(COMBO_STEP);
		expect(comboBonus(3)).toBe(2 * COMBO_STEP);
	});

	it('stops growing at the cap', () => {
		expect(comboBonus(COMBO_CAP)).toBe((COMBO_CAP - 1) * COMBO_STEP);
		expect(comboBonus(COMBO_CAP + 10)).toBe(comboBonus(COMBO_CAP));
	});
});

describe('registerSlice', () => {
	it('chains slices of one swipe inside the window', () => {
		const combo = createCombo();
		expect(registerSlice(combo, 1000, 1)).toBe(1);
		expect(registerSlice(combo, 1000, 1)).toBe(2);
		expect(registerSlice(combo, 1000 + COMBO_WINDOW_MS, 1)).toBe(3);
	});

	it('restarts when the window ran out', () => {
		const combo = createCombo();
		registerSlice(combo, 0, 1);
		registerSlice(combo, 100, 1);
		expect(registerSlice(combo, 100 + COMBO_WINDOW_MS + 1, 1)).toBe(1);
	});

	it('restarts on a new swipe even inside the window', () => {
		const combo = createCombo();
		registerSlice(combo, 0, 1);
		expect(registerSlice(combo, 50, 2)).toBe(1);
	});

	it('restarts after the chain was broken', () => {
		const combo = createCombo();
		registerSlice(combo, 0, 1);
		registerSlice(combo, 10, 1);
		breakCombo(combo);
		expect(registerSlice(combo, 20, 1)).toBe(1);
	});
});

describe('sliceScore', () => {
	it('adds the bonus to the base points', () => {
		expect(sliceScore(10, 1)).toBe(10);
		expect(sliceScore(10, 3)).toBe(10 + 2 * COMBO_STEP);
	});

	it('scores a three-in-one chain as base plus rising bonuses', () => {
		const combo = createCombo();
		let total = 0;
		for (let i = 0; i < 3; i++) total += sliceScore(20, registerSlice(combo, i * 10, 1));
		expect(total).toBe(20 + (20 + COMBO_STEP) + (20 + 2 * COMBO_STEP));
	});
});
