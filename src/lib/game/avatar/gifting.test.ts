import { describe, expect, it } from 'vitest';
import { lookGiftCode, lookGiftParam } from './gifting.js';

describe('cosmetic gift links', () => {
	it('reads a claim code from a start parameter', () => {
		expect(lookGiftCode('gift_Ab12Cd34')).toBe('Ab12Cd34');
		expect(lookGiftCode('gift_a')).toBeNull();
		expect(lookGiftCode('MN5')).toBeNull();
		expect(lookGiftCode(null)).toBeNull();
	});

	it('round-trips a code into a parameter and back', () => {
		expect(lookGiftCode(lookGiftParam('Ab12Cd34'))).toBe('Ab12Cd34');
	});
});
