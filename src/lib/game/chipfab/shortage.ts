/*
 * The shortage meter, 0 to 100. It rises all the time, faster with every level and a little
 * faster the longer a level drags on. Perfect layers, finished wafers and big memory modules
 * push it back down. When it reaches the top the player loses a heart and the meter falls back to
 * a middle value so that one slip does not cost every heart at once.
 */

export const SHORTAGE_MAX = 100;
/** Where the meter restarts after it cost a heart */
export const HEART_RESET = 55;
/** The first module size that counts as high-tier output: tier 3, 16 GB */
export const HIGH_TIER = 3;
/** Relief for the first high tier; every further tier is worth 70% more than the one before */
export const HIGH_TIER_RELIEF = 8;
const HIGH_TIER_GROWTH = 1.7;
export const PERFECT_RELIEF = 1.5;
export const WAFER_RELIEF = 10;
/** Seconds over which the rise reaches its full time factor */
const RAMP_SECONDS = 90;
const RAMP_EXTRA = 0.5;
const MAX_RATE = 6;

/** Meter points per second at the start of a level */
export function baseRate(level: number): number {
	return Math.min(MAX_RATE, 1.4 + 0.45 * (Math.max(1, Math.floor(level)) - 1));
}

/** Meter points per second after `levelSeconds` into the level: up to 50% faster over 90 seconds */
export function shortageRate(level: number, levelSeconds: number): number {
	const ramp = Math.min(1, Math.max(0, levelSeconds) / RAMP_SECONDS);
	return baseRate(level) * (1 + RAMP_EXTRA * ramp);
}

export function clampShortage(value: number): number {
	if (!Number.isFinite(value)) return 0;
	return Math.min(SHORTAGE_MAX, Math.max(0, value));
}

/** The meter after `dtMs` of the shortage getting worse; `rateScale` comes from news cards */
export function tickShortage(
	value: number,
	dtMs: number,
	level: number,
	levelSeconds: number,
	rateScale = 1
): number {
	const scale = Number.isFinite(rateScale) ? Math.max(0, rateScale) : 1;
	return clampShortage(
		value + (shortageRate(level, levelSeconds) * scale * Math.max(0, dtMs)) / 1000
	);
}

/** How much a freshly created memory module of this tier eases the shortage; 0 below high tier */
export function reliefForTier(tier: number): number {
	if (tier < HIGH_TIER) return 0;
	return Math.round(HIGH_TIER_RELIEF * HIGH_TIER_GROWTH ** (tier - HIGH_TIER));
}

export function applyRelief(value: number, amount: number): number {
	return clampShortage(value - Math.max(0, amount));
}

export function isShortageFull(value: number): boolean {
	return value >= SHORTAGE_MAX;
}
