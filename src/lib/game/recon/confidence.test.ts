import { describe, expect, it } from 'vitest';
import { emptyDossier, type Dossier } from './contacts.js';
import { confidence, confidenceBonus, isReckless, POINTS_PER_EXTRA_SENSOR } from './confidence.js';

const withSensors = (...sensors: (keyof Dossier)[]): Dossier => {
	const dossier = emptyDossier();
	for (const sensor of sensors) dossier[sensor] = 'clear';
	return dossier;
};

describe('recon sensor confidence', () => {
	it('counts the sensors that have read a contact', () => {
		expect(confidence(emptyDossier())).toBe(0);
		expect(confidence(withSensors('eo', 'sar'))).toBe(2);
		expect(confidence(withSensors('eo', 'ir', 'sar'))).toBe(3);
	});

	it('pays more for corroborated strikes', () => {
		expect(confidenceBonus(withSensors('eo'))).toBe(0);
		expect(confidenceBonus(withSensors('eo', 'ir'))).toBe(POINTS_PER_EXTRA_SENSOR);
		expect(confidenceBonus(withSensors('eo', 'ir', 'sar'))).toBe(POINTS_PER_EXTRA_SENSOR * 2);
	});

	it('calls a strike on an unread blip reckless', () => {
		expect(isReckless(emptyDossier())).toBe(true);
		expect(isReckless(withSensors('eo'))).toBe(false);
	});
});
