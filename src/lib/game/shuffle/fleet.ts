/*
 * The fleet: every ship has a flag of convenience and a name plate, both of which can be repainted
 * mid-shuffle, so neither is a reliable tell. Flags are invented tricolours, not real countries.
 */
import type { Random } from '../random.js';

/** Three stripe colours per flag, top to bottom */
export const FLAGS: readonly (readonly [string, string, string])[] = [
	['#1d4ed8', '#f8fafc', '#dc2626'],
	['#dc2626', '#f8fafc', '#1d4ed8'],
	['#15803d', '#facc15', '#15803d'],
	['#0f172a', '#f59e0b', '#0f172a'],
	['#7c3aed', '#f8fafc', '#0ea5e9'],
	['#ea580c', '#f8fafc', '#16a34a']
];

export const NAMES: readonly string[] = [
	'Nadezhda',
	'Caspian Dawn',
	'Blue Lagoon',
	'Oil Sprite',
	'Sirocco',
	'Pelican',
	'Vostok Star',
	'Quiet Harbor',
	'Lucky Seven',
	'Grey Heron'
];

export type ShipKind = 'tanker' | 'container' | 'sailboat' | 'trawler';

export const DECOY_KINDS: readonly ShipKind[] = ['container', 'sailboat', 'trawler'];

export interface Ship {
	id: number;
	kind: ShipKind;
	flag: number;
	name: number;
	/** AIS switched off: dim, no wake */
	dark: boolean;
	/** Position along the row at the start of the current move */
	slot: number;
}

/** Ships 0..count-1 lined up in order, all with different flags and names, one of them the tanker */
export function createFleet(count: number, random: Random): { ships: Ship[]; tankerId: number } {
	const flags = shuffled(
		FLAGS.map((_, i) => i),
		random
	);
	const names = shuffled(
		NAMES.map((_, i) => i),
		random
	);
	const tankerId = Math.floor(random() * count);
	const ships = Array.from({ length: count }, (_, id): Ship => {
		return {
			id,
			kind: id === tankerId ? 'tanker' : DECOY_KINDS[Math.floor(random() * DECOY_KINDS.length)],
			flag: flags[id % flags.length],
			name: names[id % names.length],
			dark: false,
			slot: id
		};
	});
	return { ships, tankerId };
}

/** A flag and name that differ from the ship's current ones, for a mid-shuffle repaint */
export function repaint(ship: Pick<Ship, 'flag' | 'name'>, random: Random) {
	const flag = (ship.flag + 1 + Math.floor(random() * (FLAGS.length - 1))) % FLAGS.length;
	const name = (ship.name + 1 + Math.floor(random() * (NAMES.length - 1))) % NAMES.length;
	return { flag, name };
}

function shuffled<T>(items: T[], random: Random): T[] {
	const out = [...items];
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
}
