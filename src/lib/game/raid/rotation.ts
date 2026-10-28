/*
 * The battlefield rotation: one map is open at a time and the next takes over every twelve
 * hours, at local midnight and noon, going round the maps in order. A local day therefore always
 * has the same two battlefields, which the daily map quest picks from.
 */
import { MAP_IDS, type MapId } from './config';

export const ROTATION_MS = 12 * 60 * 60 * 1000;

/** Whole days from 1970-01-01 to the calendar day of this "YYYY-MM-DD" key */
function dayOrdinal(day: string): number {
	const [year, month, date] = day.split('-').map(Number);
	return Math.round(Date.UTC(year, month - 1, date) / 86_400_000);
}

const mapOfSlot = (slot: number) =>
	MAP_IDS[((slot % MAP_IDS.length) + MAP_IDS.length) % MAP_IDS.length];

/** The two battlefields of a local day, the morning one first */
export function mapsOfDay(day: string): readonly [MapId, MapId] {
	const slot = dayOrdinal(day) * 2;
	return [mapOfSlot(slot), mapOfSlot(slot + 1)];
}

export interface Rotation {
	map: MapId;
	/** When this battlefield closes and the next opens, in epoch milliseconds */
	endsAt: number;
	next: MapId;
}

/** The battlefield open at this moment (local time), when it closes and which comes next */
export function rotationAt(now: number): Rotation {
	const date = new Date(now);
	const ordinal = Math.round(
		Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000
	);
	const afternoon = date.getHours() >= 12;
	const slot = ordinal * 2 + (afternoon ? 1 : 0);
	const end = new Date(now);
	end.setHours(afternoon ? 24 : 12, 0, 0, 0);
	return { map: mapOfSlot(slot), endsAt: end.getTime(), next: mapOfSlot(slot + 1) };
}
