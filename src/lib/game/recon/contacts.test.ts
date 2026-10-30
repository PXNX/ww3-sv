import { describe, expect, it } from 'vitest';
import {
	emptyDossier,
	inferRole,
	nextSensor,
	readSensor,
	type Contact,
	type Dossier
} from './contacts.js';

function contact(traits: Partial<Contact>): Contact {
	return {
		id: 1,
		kind: 'tank',
		role: 'hostile',
		x: 0,
		y: 0,
		heading: 0,
		olive: true,
		covered: false,
		hot: true,
		metal: true,
		...traits
	};
}

function fullDossier(c: Contact): Dossier {
	return { eo: readSensor(c, 'eo'), ir: readSensor(c, 'ir'), sar: readSensor(c, 'sar') };
}

describe('sensor readings', () => {
	it('EO reads colour, and cover hides it behind a net', () => {
		expect(readSensor(contact({}), 'eo')).toBe('military');
		expect(readSensor(contact({ olive: false, role: 'civilian' }), 'eo')).toBe('civilian');
		expect(readSensor(contact({ covered: true }), 'eo')).toBe('netted');
	});

	it('IR reads heat and SAR reads metal, through a net', () => {
		const netted = contact({ covered: true, hot: true, metal: false });
		expect(readSensor(netted, 'ir')).toBe('hot');
		expect(readSensor(netted, 'sar')).toBe('clear');
		expect(readSensor(contact({ hot: false, metal: true }), 'ir')).toBe('cold');
		expect(readSensor(contact({ hot: false, metal: true }), 'sar')).toBe('metal');
	});
});

describe('inferRole', () => {
	it('needs readings before it says anything', () => {
		expect(inferRole(emptyDossier())).toBeNull();
		expect(inferRole({ eo: null, ir: 'hot', sar: 'metal' })).toBeNull();
	});

	it('calls olive with metal or heat hostile, and olive with neither a decoy', () => {
		expect(inferRole({ eo: 'military', ir: null, sar: 'metal' })).toBe('hostile');
		expect(inferRole({ eo: 'military', ir: 'hot', sar: null })).toBe('hostile');
		expect(inferRole({ eo: 'military', ir: 'cold', sar: 'clear' })).toBe('decoy');
		expect(inferRole({ eo: 'military', ir: 'cold', sar: null })).toBeNull();
	});

	it('reads a net by radar first, then by heat', () => {
		expect(inferRole({ eo: 'netted', ir: null, sar: 'metal' })).toBe('hostile');
		expect(inferRole({ eo: 'netted', ir: 'hot', sar: 'clear' })).toBe('civilian');
		expect(inferRole({ eo: 'netted', ir: 'cold', sar: 'clear' })).toBe('decoy');
		expect(inferRole({ eo: 'netted', ir: 'hot', sar: null })).toBeNull();
	});

	it('settles on colour alone for anything that is not olive', () => {
		expect(inferRole({ eo: 'civilian', ir: null, sar: null })).toBe('civilian');
	});
});

describe('nextSensor', () => {
	it('starts with EO and stops once the readings settle the question', () => {
		expect(nextSensor(emptyDossier())).toBe('eo');
		expect(nextSensor({ eo: 'civilian', ir: null, sar: null })).toBeNull();
		expect(nextSensor({ eo: 'military', ir: null, sar: null })).toBe('sar');
		expect(nextSensor({ eo: 'military', ir: null, sar: 'clear' })).toBe('ir');
		expect(nextSensor({ eo: 'military', ir: 'hot', sar: null })).toBeNull();
		expect(nextSensor({ eo: 'netted', ir: null, sar: 'clear' })).toBe('ir');
	});

	it('settles every olive contact once the suggested sensors have been used', () => {
		for (const covered of [false, true]) {
			for (const hot of [false, true]) {
				for (const metal of [false, true]) {
					const truth = contact({ covered, hot, metal });
					const dossier = emptyDossier();
					for (let step = 0; step < 3; step++) {
						const sensor = nextSensor(dossier);
						if (!sensor) break;
						dossier[sensor] = readSensor(truth, sensor);
					}
					expect(inferRole(dossier)).not.toBeNull();
					expect(inferRole(dossier)).toBe(inferRole(fullDossier(truth)));
				}
			}
		}
	});
});
