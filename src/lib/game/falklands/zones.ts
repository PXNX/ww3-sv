/*
 * The chart of Falklands: what lies in each sea zone. Hazards (mines, submarines, air raids) cut
 * the hull; pickups (tanker, repair stores, chaff, intercepted signals) help. The chart is three
 * legs and every leg is meaner than the one before. Generated once per run from the seeded random
 * source, so the same seed gives the same sea.
 */
import type { Random } from '../random.js';
import { DISTANCE, LEG_ENDS } from './config.js';

export type Hazard = 'mine' | 'sub' | 'raid';
export type Pickup = 'tanker' | 'repair' | 'chaff' | 'intel';
export type ZoneKind = Hazard | Pickup;

/** Index zero (the port) and DISTANCE (the islands) are always clear */
export type Zones = Array<ZoneKind | null>;

export function isHazard(kind: ZoneKind): kind is Hazard {
	return kind === 'mine' || kind === 'sub' || kind === 'raid';
}

/** Leg 1 is open sea, leg 2 the mine belt, leg 3 the air corridor */
export function legAt(zone: number): 1 | 2 | 3 {
	if (zone <= LEG_ENDS[0]) return 1;
	if (zone <= LEG_ENDS[1]) return 2;
	return 3;
}

const HAZARD_CHANCE = { 1: 0.12, 2: 0.3, 3: 0.32 } as const;
const PICKUP_CHANCE = 0.15;

function hazardFor(leg: 1 | 2 | 3, roll: number): Hazard {
	if (leg === 1) return 'mine';
	if (leg === 2) return roll < 0.5 ? 'mine' : 'sub';
	return roll < 0.5 ? 'sub' : 'raid';
}

function pickupFor(roll: number): Pickup {
	if (roll < 0.4) return 'tanker';
	if (roll < 0.65) return 'repair';
	if (roll < 0.85) return 'chaff';
	return 'intel';
}

/** DISTANCE + 1 zones: a few hazards, a few pickups and a tanker guaranteed in each of two stretches */
export function createZones(random: Random): Zones {
	const zones: Zones = Array.from({ length: DISTANCE + 1 }, () => null);
	for (let zone = 1; zone < DISTANCE; zone++) {
		const leg = legAt(zone);
		const roll = random();
		const pick = random();
		if (roll < HAZARD_CHANCE[leg]) zones[zone] = hazardFor(leg, pick);
		else if (roll > 1 - PICKUP_CHANCE) zones[zone] = pickupFor(pick);
	}
	// A tanker somewhere in zones 2-4 and 6-8, replacing whatever was there
	zones[2 + Math.floor(random() * 3)] = 'tanker';
	zones[6 + Math.floor(random() * 3)] = 'tanker';
	return zones;
}
