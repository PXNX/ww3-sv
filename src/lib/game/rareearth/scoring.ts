import { COMBO_STEP, DELIVERY_POINTS, MAX_MULTIPLIER, SPEED_BONUS_POINTS } from './config.js';

/** x1 to start, one more for every COMBO_STEP by-the-book deliveries in a row, up to the cap */
export function comboMultiplier(combo: number): number {
	const whole = Number.isFinite(combo) ? Math.max(0, Math.floor(combo)) : 0;
	return Math.min(MAX_MULTIPLIER, 1 + Math.floor(whole / COMBO_STEP));
}

export interface DeliveryScore {
	points: number;
	/** The combo after this delivery */
	combo: number;
	multiplier: number;
}

/**
 * Points for an on-time delivery: a base plus a bonus for the share of the deadline that was left.
 * A delivery that followed the rules (never took a tariffed lane) extends the combo and gets the
 * multiplier; one that did not scores the plain points and leaves the combo as it was.
 */
export function scoreDelivery(
	combo: number,
	timeLeftShare: number,
	byTheBook: boolean
): DeliveryScore {
	const share = Math.min(1, Math.max(0, Number.isFinite(timeLeftShare) ? timeLeftShare : 0));
	const base = DELIVERY_POINTS + Math.round(SPEED_BONUS_POINTS * share);
	if (!byTheBook) return { points: base, combo, multiplier: 1 };
	const next = combo + 1;
	const multiplier = comboMultiplier(next);
	return { points: base * multiplier, combo: next, multiplier };
}
