/*
 * Sensor confidence. A strike is always stronger when more sensors agree on a contact; firing on
 * an untouched blip is reckless and raises the escalation meter even when the target was hostile.
 * This rewards the slow, careful reconnaissance the mode is about without changing what a sensor sees.
 */
import type { Dossier } from './contacts.js';
import { SENSORS } from './contacts.js';

/** How many sensors have read this contact, 0 to 3 */
export function confidence(dossier: Dossier): number {
	return SENSORS.filter((sensor) => dossier[sensor] !== null).length;
}

/** Extra points per corroborating sensor beyond the first */
export const POINTS_PER_EXTRA_SENSOR = 25;
/** Escalation added when firing at a contact nobody has looked at */
export const RECKLESS_ESCALATION = 9;

export function confidenceBonus(dossier: Dossier): number {
	return Math.max(0, confidence(dossier) - 1) * POINTS_PER_EXTRA_SENSOR;
}

export function isReckless(dossier: Dossier): boolean {
	return confidence(dossier) === 0;
}
