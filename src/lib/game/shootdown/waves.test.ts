import { describe, expect, it } from 'vitest';
import {
	DIFFICULTY_CAP_WAVE,
	MAX_BOSS_HIT_POINTS,
	MAX_COLUMNS,
	MAX_DIVERS,
	MAX_ROWS,
	isBossWave,
	waveDefinition
} from './waves';

const regularWaves = Array.from({ length: 40 }, (_, index) => index + 1).filter(
	(wave) => !isBossWave(wave)
);

describe('waveDefinition', () => {
	it('starts with eight columns by four rows and no boss', () => {
		const first = waveDefinition(1);
		expect(first).toMatchObject({ wave: 1, columns: 8, rows: 4, boss: null, maxDivers: 1 });
	});

	it('makes every fifth wave a boss wave', () => {
		expect([1, 2, 3, 4, 5, 6, 9, 10, 15, 20].map(isBossWave)).toEqual([
			false,
			false,
			false,
			false,
			true,
			false,
			false,
			true,
			true,
			true
		]);
		expect(waveDefinition(5).boss).not.toBeNull();
		expect(waveDefinition(4).boss).toBeNull();
		expect(waveDefinition(6).boss).toBeNull();
	});

	it('gives the Mega-Shahed several hit points, more on later boss waves, up to a cap', () => {
		const hitPoints = [5, 10, 15, 20, 100, 500].map((wave) => waveDefinition(wave).boss!.hitPoints);
		expect(hitPoints[0]).toBeGreaterThan(1);
		for (let i = 1; i < hitPoints.length; i++) {
			expect(hitPoints[i]).toBeGreaterThanOrEqual(hitPoints[i - 1]);
		}
		expect(hitPoints[1]).toBeGreaterThan(hitPoints[0]);
		expect(Math.max(...hitPoints)).toBe(MAX_BOSS_HIT_POINTS);
	});

	it('never gets easier from one regular wave to the next', () => {
		for (let i = 1; i < regularWaves.length; i++) {
			const previous = waveDefinition(regularWaves[i - 1]);
			const next = waveDefinition(regularWaves[i]);
			expect(next.baseSpeed).toBeGreaterThanOrEqual(previous.baseSpeed);
			expect(next.columns * next.rows).toBeGreaterThanOrEqual(previous.columns * previous.rows);
			expect(next.diveSpeed).toBeGreaterThanOrEqual(previous.diveSpeed);
			expect(next.maxDivers).toBeGreaterThanOrEqual(previous.maxDivers);
			expect(next.diveIntervalMs[0]).toBeLessThanOrEqual(previous.diveIntervalMs[0]);
		}
		expect(waveDefinition(4).baseSpeed).toBeGreaterThan(waveDefinition(1).baseSpeed);
	});

	it('stops growing at the cap, so waves stay endless but playable', () => {
		const capped = waveDefinition(DIFFICULTY_CAP_WAVE + 1);
		const far = waveDefinition(DIFFICULTY_CAP_WAVE + 101);
		expect({ ...far, wave: 0 }).toEqual({ ...capped, wave: 0 });
		for (const wave of [1, 12, 50, 999]) {
			const definition = waveDefinition(wave);
			expect(definition.columns).toBeLessThanOrEqual(MAX_COLUMNS);
			expect(definition.rows).toBeLessThanOrEqual(MAX_ROWS);
			expect(definition.maxDivers).toBeLessThanOrEqual(MAX_DIVERS);
		}
	});

	it('treats invalid wave numbers as wave one', () => {
		expect(waveDefinition(0).wave).toBe(1);
		expect(waveDefinition(-3).wave).toBe(1);
	});
});
