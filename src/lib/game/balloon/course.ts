/*
 * The course of one run, generated up front from the seed: hazards, hot-air puffs and the points
 * of interest along the track. Everything is placed in track units (see config.ts). The hazard gap
 * shrinks along the way, so the run ramps up without any hidden difficulty setting.
 */
import { pickOne, pickWeighted, type Random } from '#lib/game/random.js';
import {
	CEILING_Y,
	CLOUD_RADIUS,
	CROW_RADIUS,
	FLOOR_Y,
	HAZARD_FIRST_X,
	HAZARD_GAP_END,
	HAZARD_GAP_START,
	KITE_RADIUS,
	POI_END_MARGIN,
	POI_FIRST_X,
	POI_GAP,
	POI_KINDS,
	PUFF_GAP,
	TRACK_LENGTH
} from './config.js';

export type HazardKind = 'crow' | 'cloud' | 'kite';
export type PoiKind = (typeof POI_KINDS)[number];

export interface Hazard {
	kind: HazardKind;
	/** Track position; a crow flies on, so this is where it is now */
	x: number;
	/** Altitude around which the hazard bobs */
	baseY: number;
	y: number;
	radius: number;
	/** Bob phase, so no two hazards move in step */
	phase: number;
	/** Asleep until it is about to come on screen */
	active: boolean;
	/** Already hit the balloon, so it can only hurt once */
	spent: boolean;
}

export interface Puff {
	x: number;
	y: number;
	taken: boolean;
}

export interface Poi {
	kind: PoiKind;
	x: number;
	photographed: boolean;
	/** Time the balloon has hovered over it so far */
	dwellMs: number;
}

export interface Course {
	hazards: Hazard[];
	puffs: Puff[];
	pois: Poi[];
}

const HAZARDS = [
	{ item: 'crow' as const, weight: 4 },
	{ item: 'cloud' as const, weight: 3 },
	{ item: 'kite' as const, weight: 3 }
];
const RADIUS: Record<HazardKind, number> = {
	crow: CROW_RADIUS,
	cloud: CLOUD_RADIUS,
	kite: KITE_RADIUS
};

/** Gap to the next hazard at a track position: wide at the start, tight near the coast */
export function hazardGap(x: number): number {
	const t = Math.min(1, Math.max(0, x / TRACK_LENGTH));
	return HAZARD_GAP_START + (HAZARD_GAP_END - HAZARD_GAP_START) * t;
}

function randomY(random: Random, margin: number): number {
	return CEILING_Y + margin + random() * (FLOOR_Y - CEILING_Y - margin * 2);
}

export function generateCourse(random: Random): Course {
	const hazards: Hazard[] = [];
	for (let x = HAZARD_FIRST_X; x < TRACK_LENGTH - 200; x += hazardGap(x) * (0.8 + random() * 0.4)) {
		const kind = pickWeighted(random, HAZARDS);
		const baseY = randomY(random, 10);
		hazards.push({
			kind,
			x,
			baseY,
			y: baseY,
			radius: RADIUS[kind],
			phase: random() * Math.PI * 2,
			active: false,
			spent: false
		});
	}

	const puffs: Puff[] = [];
	for (let x = PUFF_GAP * 0.6; x < TRACK_LENGTH - 100; x += PUFF_GAP * (0.8 + random() * 0.4)) {
		puffs.push({ x, y: randomY(random, 20), taken: false });
	}

	const pois: Poi[] = [];
	for (
		let x = POI_FIRST_X;
		x < TRACK_LENGTH - POI_END_MARGIN;
		x += POI_GAP * (0.85 + random() * 0.3)
	) {
		pois.push({ kind: pickOne(random, POI_KINDS), x, photographed: false, dwellMs: 0 });
	}
	return { hazards, puffs, pois };
}
