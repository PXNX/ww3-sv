/*
 * Contacts and what the three sensors tell about them.
 *
 * Every contact has a hidden role (hostile, civilian or decoy) and four physical traits: whether
 * it is painted military olive, whether it is under cover, whether it is warm and whether it
 * returns radar. The generator only ever builds combinations that the three sensors can tell apart:
 *   - EO sees colour: olive is military, anything else civilian, and cover shows up as a net.
 *   - IR sees heat, SAR sees metal, both straight through a net.
 *   - Olive with metal or heat is hostile; olive with neither is a decoy.
 *   - Under a net, metal is hostile, heat alone is civilian, and nothing at all is a decoy.
 * inferRole encodes exactly that, so tests can prove every generated sortie is solvable.
 */

export type Sensor = 'eo' | 'ir' | 'sar';
export const SENSORS: readonly Sensor[] = ['eo', 'ir', 'sar'];

export type Role = 'hostile' | 'civilian' | 'decoy';

export type ContactKind =
	| 'tank'
	| 'truck'
	| 'artillery'
	| 'aa'
	| 'troops'
	| 'command'
	| 'car'
	| 'tractor'
	| 'bus'
	| 'herd'
	| 'farm';

export const HOSTILE_KINDS: readonly ContactKind[] = ['tank', 'truck', 'artillery', 'command'];
export const DECOY_KINDS: readonly ContactKind[] = ['tank', 'truck', 'artillery'];
export const CIVILIAN_KINDS: readonly ContactKind[] = ['car', 'tractor', 'bus', 'herd'];

export interface Contact {
	id: number;
	kind: ContactKind;
	role: Role;
	x: number;
	y: number;
	/** Radians; which way the vehicle points */
	heading: number;
	/** Painted military olive (hostile units and decoys) */
	olive: boolean;
	/** Hidden under a camouflage net or a tarp */
	covered: boolean;
	hot: boolean;
	metal: boolean;
}

export type Reading = 'military' | 'civilian' | 'netted' | 'hot' | 'cold' | 'metal' | 'clear';

/** What one sensor reports for a contact */
export function readSensor(contact: Contact, sensor: Sensor): Reading {
	switch (sensor) {
		case 'eo':
			return contact.covered ? 'netted' : contact.olive ? 'military' : 'civilian';
		case 'ir':
			return contact.hot ? 'hot' : 'cold';
		case 'sar':
			return contact.metal ? 'metal' : 'clear';
	}
}

/** The readings logged so far for one contact; null means not looked at yet */
export type Dossier = Record<Sensor, Reading | null>;

export function emptyDossier(): Dossier {
	return { eo: null, ir: null, sar: null };
}

/** The role the readings prove, or null while they leave more than one possibility */
export function inferRole(d: Dossier): Role | null {
	if (d.eo === 'civilian') return 'civilian';
	if (d.eo === 'military') {
		if (d.sar === 'metal' || d.ir === 'hot') return 'hostile';
		if (d.sar === 'clear' && d.ir === 'cold') return 'decoy';
		return null;
	}
	if (d.eo === 'netted') {
		if (d.sar === 'metal') return 'hostile';
		if (d.sar === 'clear' && d.ir === 'hot') return 'civilian';
		if (d.sar === 'clear' && d.ir === 'cold') return 'decoy';
		return null;
	}
	return null;
}

/** The sensor worth using next, or null once the readings settle the question */
export function nextSensor(d: Dossier): Sensor | null {
	if (d.eo === null) return 'eo';
	if (inferRole(d) !== null) return null;
	if (d.sar === null) return 'sar';
	if (d.ir === null) return 'ir';
	return null;
}

export function isHostile(contact: Contact): boolean {
	return contact.role === 'hostile';
}
