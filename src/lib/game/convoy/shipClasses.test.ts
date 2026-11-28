import { describe, expect, it } from 'vitest';
import { createRandom } from '#lib/game/random.js';
import { FUEL_PER_UNIT, FUEL_START, SHIPS } from './constants.js';
import { createRunner, speedAt, stepRunner } from './runnerStep.js';

const random = () => createRandom(7);

describe('convoy ship classes', () => {
	it('starts each class with its own hull and escort', () => {
		expect(createRunner('tanker')).toMatchObject({ ship: 'tanker', hull: 3, escort: false });
		expect(createRunner('corvette')).toMatchObject({ ship: 'corvette', hull: 2, escort: false });
		expect(createRunner('tug')).toMatchObject({ ship: 'tug', hull: 2, escort: true });
	});

	it('makes the corvette faster and the tug slower', () => {
		expect(speedAt(0, false, 'corvette')).toBeGreaterThan(speedAt(0, false, 'tanker'));
		expect(speedAt(0, false, 'tug')).toBeLessThan(speedAt(0, false, 'tanker'));
	});

	it('burns fuel slowest in the tug', () => {
		const tanker = stepRunner(createRunner('tanker'), 1000, random());
		const tug = stepRunner(createRunner('tug'), 1000, random());
		expect(tug.fuel).toBeGreaterThan(tanker.fuel);
		expect(tanker.fuel).toBeCloseTo(FUEL_START - tanker.distance * FUEL_PER_UNIT, 6);
	});

	it('lets the narrow corvette slip through a gap the tanker cannot', () => {
		const state = createRunner('corvette');
		state.obstacles = [
			{
				id: 99,
				kind: 'mine',
				lane: 1,
				targetLane: 1,
				x: 1,
				y: state.distance,
				push: 1,
				passed: false
			}
		];
		state.x = 1.55;
		state.dragX = 1.55;
		const after = stepRunner(state, 16, random());
		expect(after.hull).toBe(2);
	});

	it('keeps the default tanker identical to before the choice existed', () => {
		const state = createRunner();
		expect(state.ship).toBe('tanker');
		expect(state.hull).toBe(SHIPS.tanker.hull);
	});
});
