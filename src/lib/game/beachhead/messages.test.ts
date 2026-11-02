import { describe, expect, it } from 'vitest';
import { hasPersianScript, loadMessages, missingMessages } from '#lib/testing/messages.js';

describe('beachhead messages', () => {
	it('has every string in every language', () => {
		expect(missingMessages(['beachhead_', 'mode_beachhead_'])).toEqual([]);
	});

	it('really translates the Persian intro', () => {
		expect(hasPersianScript(loadMessages('fa').beachhead_intro)).toBe(true);
	});
});
