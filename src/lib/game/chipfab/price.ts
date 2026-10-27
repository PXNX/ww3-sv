/*
 * Street prices in dollars. Memory gets pricier per gigabyte the bigger the module is, and every
 * price is marked up by the running shortage meter. Jensen Huang's flagship GPU follows the same
 * markup and climbs with every level, because why would it ever get cheaper.
 */
import { moduleGb } from './ram';

/** Price per GB of a 4 GB module, before the tier premium */
export const RAM_PRICE_PER_GB = 3;
/** Every tier up makes each gigabyte this much more expensive */
export const RAM_TIER_PREMIUM = 1.35;
/** The flagship GPU at level 1 with no shortage */
export const GPU_BASE_PRICE = 1999;
/** Each level on top of the first adds this share of the base price */
export const GPU_LEVEL_STEP = 0.25;

/** 1 with no shortage, 2 when the meter is full */
export function shortageMarkup(shortage: number): number {
	if (!Number.isFinite(shortage)) return 1;
	return 1 + Math.min(100, Math.max(0, shortage)) / 100;
}

export function modulePrice(tier: number, shortage = 0): number {
	const premium = RAM_TIER_PREMIUM ** (Math.max(1, tier) - 1);
	return Math.round(moduleGb(tier) * RAM_PRICE_PER_GB * premium * shortageMarkup(shortage));
}

export function gpuPrice(level: number, shortage = 0): number {
	const steps = Number.isFinite(level) ? Math.max(0, Math.floor(level) - 1) : 0;
	return Math.round(GPU_BASE_PRICE * (1 + GPU_LEVEL_STEP * steps) * shortageMarkup(shortage));
}

/** Such as "$2,499" */
export function formatPrice(dollars: number): string {
	return `$${dollars.toLocaleString('en-US')}`;
}
