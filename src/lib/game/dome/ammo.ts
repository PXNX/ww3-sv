/*
 * The interceptor magazine: a few are loaded, each shot uses one and leaves a short cooldown, and
 * the missing ones reload one at a time. While the power plant is out (blackout) reloading is slower.
 */
import { BLACKOUT_RELOAD_FACTOR, MAX_AMMO, RELOAD_MS, SHOT_COOLDOWN_MS } from './config.js';

export interface Ammo {
	loaded: number;
	/** Progress of the interceptor that is reloading, 0 to RELOAD_MS */
	reloadMs: number;
	/** Time until the next shot is allowed */
	cooldownMs: number;
}

export function createAmmo(): Ammo {
	return { loaded: MAX_AMMO, reloadMs: 0, cooldownMs: 0 };
}

export function canFire(ammo: Ammo): boolean {
	return ammo.loaded > 0 && ammo.cooldownMs <= 0;
}

/** Uses one interceptor; returns false (and changes nothing) when none is ready */
export function fire(ammo: Ammo): boolean {
	if (!canFire(ammo)) return false;
	ammo.loaded -= 1;
	ammo.cooldownMs = SHOT_COOLDOWN_MS;
	return true;
}

export function tickAmmo(ammo: Ammo, dtMs: number, blackout = false): void {
	ammo.cooldownMs = Math.max(0, ammo.cooldownMs - dtMs);
	if (ammo.loaded >= MAX_AMMO) {
		ammo.loaded = MAX_AMMO;
		ammo.reloadMs = 0;
		return;
	}
	ammo.reloadMs += blackout ? dtMs / BLACKOUT_RELOAD_FACTOR : dtMs;
	while (ammo.reloadMs >= RELOAD_MS && ammo.loaded < MAX_AMMO) {
		ammo.reloadMs -= RELOAD_MS;
		ammo.loaded += 1;
	}
	if (ammo.loaded >= MAX_AMMO) ammo.reloadMs = 0;
}

/** How far the reloading interceptor is, 0 to 1 (0 when the magazine is full) */
export function reloadProgress(ammo: Ammo): number {
	return ammo.loaded >= MAX_AMMO ? 0 : Math.min(1, ammo.reloadMs / RELOAD_MS);
}
