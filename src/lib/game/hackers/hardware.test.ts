import { describe, expect, it } from 'vitest';
import {
	HARDWARE_SPECS,
	emptyHardware,
	hardwareCost,
	hardwareEffects,
	hardwareSpec,
	isHardware
} from './hardware';

describe('hardware specs', () => {
	it('includes all four parts', () => {
		const ids = HARDWARE_SPECS.map((s) => s.id);
		expect(ids).toContain('cpu');
		expect(ids).toContain('ram');
		expect(ids).toContain('gpu');
		expect(ids).toContain('cable');
		expect(ids).toHaveLength(4);
	});

	it('returns a spec for cable', () => {
		const spec = hardwareSpec('cable');
		expect(spec.id).toBe('cable');
		expect(spec.maxLevel).toBeGreaterThan(0);
	});
});

describe('empty hardware', () => {
	it('starts with zero for all parts including cable', () => {
		const h = emptyHardware();
		expect(h.cpu).toBe(0);
		expect(h.ram).toBe(0);
		expect(h.gpu).toBe(0);
		expect(h.cable).toBe(0);
	});
});

describe('hardware cost', () => {
	it('returns null when maxed', () => {
		const spec = HARDWARE_SPECS.find((s) => s.id === 'cpu')!;
		expect(hardwareCost('cpu', spec.maxLevel)).toBeNull();
		expect(hardwareCost('cable', 5)).toBeNull();
	});

	it('computes cost for cable level 1', () => {
		const cost = hardwareCost('cable', 0);
		expect(cost).not.toBeNull();
		expect(cost).toBeGreaterThan(0);
	});
});

describe('hardware effects', () => {
	it('computes effects with cable present', () => {
		const effects = hardwareEffects({ cpu: 0, ram: 0, gpu: 0, cable: 3 });
		expect(typeof effects.minerMultiplier).toBe('number');
		expect(typeof effects.creepMultiplier).toBe('number');
		expect(typeof effects.siphonBonus).toBe('number');
	});
});

describe('isHardware', () => {
	it('validates a hardware record with cable', () => {
		expect(isHardware({ cpu: 1, ram: 2, gpu: 3, cable: 4 })).toBe(true);
	});
});
