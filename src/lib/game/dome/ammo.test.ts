import { describe, expect, it } from 'vitest';
import { canFire, createAmmo, fire, reloadProgress, tickAmmo } from './ammo.js';
import { MAX_AMMO, RELOAD_MS, SHOT_COOLDOWN_MS } from './config.js';

describe('ammo', () => {
	it('starts full and ready', () => {
		const ammo = createAmmo();
		expect(ammo.loaded).toBe(MAX_AMMO);
		expect(canFire(ammo)).toBe(true);
		expect(reloadProgress(ammo)).toBe(0);
	});

	it('uses one interceptor per shot and then waits out the cooldown', () => {
		const ammo = createAmmo();
		expect(fire(ammo)).toBe(true);
		expect(ammo.loaded).toBe(MAX_AMMO - 1);
		expect(canFire(ammo)).toBe(false);
		expect(fire(ammo)).toBe(false);
		expect(ammo.loaded).toBe(MAX_AMMO - 1);
		tickAmmo(ammo, SHOT_COOLDOWN_MS);
		expect(canFire(ammo)).toBe(true);
	});

	it('cannot fire with an empty magazine', () => {
		const ammo = createAmmo();
		for (let i = 0; i < MAX_AMMO; i++) {
			expect(fire(ammo)).toBe(true);
			ammo.cooldownMs = 0;
		}
		expect(ammo.loaded).toBe(0);
		expect(canFire(ammo)).toBe(false);
		expect(fire(ammo)).toBe(false);
	});

	it('reloads one interceptor at a time and stops when full', () => {
		const ammo = createAmmo();
		ammo.loaded = MAX_AMMO - 2;
		tickAmmo(ammo, RELOAD_MS / 2);
		expect(reloadProgress(ammo)).toBeCloseTo(0.5);
		tickAmmo(ammo, RELOAD_MS / 2);
		expect(ammo.loaded).toBe(MAX_AMMO - 1);
		tickAmmo(ammo, RELOAD_MS);
		expect(ammo.loaded).toBe(MAX_AMMO);
		tickAmmo(ammo, RELOAD_MS * 5);
		expect(ammo.loaded).toBe(MAX_AMMO);
		expect(ammo.reloadMs).toBe(0);
	});

	it('reloads more slowly during a blackout', () => {
		const normal = createAmmo();
		const dark = createAmmo();
		normal.loaded = 0;
		dark.loaded = 0;
		tickAmmo(normal, RELOAD_MS);
		tickAmmo(dark, RELOAD_MS, true);
		expect(normal.loaded).toBe(1);
		expect(dark.loaded).toBe(0);
		expect(reloadProgress(dark)).toBeCloseTo(0.5);
	});
});
