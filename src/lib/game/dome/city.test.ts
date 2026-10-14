import { describe, expect, it } from 'vitest';
import { FIELD_START, SEA_END, TARGETS } from './config.js';
import { groundAt, standingValue, targetIndexAt } from './city.js';

describe('city', () => {
	it('finds the building under a column and nothing between or outside them', () => {
		TARGETS.forEach((target, index) => {
			expect(targetIndexAt(target.x)).toBe(index);
			expect(targetIndexAt(target.x + target.halfWidth)).toBe(index);
		});
		expect(targetIndexAt(40)).toBeNull();
		expect(targetIndexAt(600)).toBeNull();
		expect(targetIndexAt(TARGETS[0].x + TARGETS[0].halfWidth + 1)).toBeNull();
	});

	it('keeps buildings apart from the sea and the field', () => {
		for (const target of TARGETS) {
			expect(target.x - target.halfWidth).toBeGreaterThan(SEA_END);
			expect(target.x + target.halfWidth).toBeLessThan(FIELD_START);
		}
		expect(groundAt(10)).toBe('sea');
		expect(groundAt(300)).toBe('city');
		expect(groundAt(FIELD_START)).toBe('field');
	});

	it('values a standing building and nothing once it is in ruins', () => {
		const ruined = TARGETS.map(() => false);
		expect(standingValue(2, ruined)).toBe(TARGETS[2].value);
		ruined[2] = true;
		expect(standingValue(2, ruined)).toBe(0);
		expect(standingValue(null, ruined)).toBe(0);
	});

	it('ranks the hospital above the power plant above a house', () => {
		const find = (kind: string) => TARGETS.find((target) => target.kind === kind)!;
		expect(find('hospital').value).toBeGreaterThan(find('plant').value);
		expect(find('plant').value).toBeGreaterThan(find('house').value);
		expect(find('hospital').cost).toBeGreaterThan(find('plant').cost);
		expect(find('plant').cost).toBeGreaterThan(find('house').cost);
	});
});
