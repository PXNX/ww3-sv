import { describe, expect, it } from 'vitest';
import { createRandom } from '#lib/game/random.js';
import { ALARM_HEAT, assign, createGpuGrid, JOBS, MAX_ALARMS, flushCoolant } from './state.js';

const random = () => createRandom(21);

describe('gpu grid', () => {
	it('starts with cool racks and a job', () => {
		const state = createGpuGrid(random());
		expect(state.heat).toEqual([10, 10, 10]);
		expect(state.job).not.toBeNull();
	});

	it('heats the chosen rack and cools the others', () => {
		const state = createGpuGrid(random());
		const next = assign(state, 0, random());
		expect(next.heat[0]!).toBeGreaterThan(state.heat[0]!);
		expect(next.heat[1]!).toBeLessThan(state.heat[1]!);
		expect(next.last?.rack).toBe(0);
	});

	it('pays nothing and raises an alarm on an overheated rack', () => {
		const state = createGpuGrid(random());
		state.heat = [ALARM_HEAT - 1, 10, 10];
		state.job = { label: 'render', size: 3 };
		const next = assign(state, 0, random());
		expect(next.alarms).toBe(1);
		expect(next.last?.points).toBe(0);
	});

	it('ends after all jobs or three alarms', () => {
		let state = createGpuGrid(random());
		state.turn = JOBS - 1;
		state.job = { label: 'inference', size: 1 };
		expect(assign(state, 0, random()).status).toBe('won');

		state = createGpuGrid(random());
		state.alarms = MAX_ALARMS - 1;
		state.heat = [ALARM_HEAT, 10, 10];
		state.job = { label: 'render', size: 3 };
		expect(assign(state, 0, random()).status).toBe('lost');
	});
});

describe('coolant', () => {
	it('cools every rack twice', () => {
		const state = createGpuGrid(random());
		state.heat = [80, 70, 60];
		const once = flushCoolant(state);
		expect(once.heat[0]).toBeLessThan(80);
		expect(once.coolant).toBe(1);
		const twice = flushCoolant(once);
		expect(twice.coolant).toBe(0);
		expect(flushCoolant(twice)).toBe(twice);
	});
});
