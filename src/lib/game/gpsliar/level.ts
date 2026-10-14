/*
 * Level generator. A level spec (levels.ts) says how big the sea is, which coast is land, how many
 * of everything there is and how badly the GPS lies; the generator scatters rocks, shallows, buoys
 * and lighthouses with a seeded random so a level is always the same sea. Everything keeps a wide
 * berth from everything else (the gaps are always several boat widths), so every level can be
 * sailed, and the tests prove it. The sea is built facing north (land at the top, the boat at the
 * bottom) and then turned to the spec's coast.
 */
import { createRandom, pickOne, shuffle, type Random } from '../random.js';
import {
	BOAT_MAX_SPEED,
	COAST_DEPTH,
	PAR_CUSHION_S,
	PAR_SPEED_FRACTION,
	TANKER_RADIUS
} from './config.js';
import type { LieParams, Vec } from './lie.js';

export type Side = 'north' | 'south' | 'east' | 'west';
export type Cargo = 'herring' | 'stones';

export interface Circle extends Vec {
	r: number;
}

export interface Buoy extends Vec {
	number: number;
}

export interface Lighthouse extends Vec {
	/** How many flashes in a row, 1 to 4: this is how you tell lighthouses apart */
	flashes: number;
}

export interface Port extends Vec {
	cargo: Cargo;
}

export interface TankerRoute {
	from: Vec;
	to: Vec;
}

export interface LevelSpec {
	id: string;
	seed: number;
	/** Sea size in units, as the map is finally shown */
	width: number;
	height: number;
	land: Side;
	stops: number;
	rocks: number;
	shallows: number;
	buoys: number;
	lighthouses: number;
	tanker: boolean;
	lie: LieParams;
	/** How far the boat can see through the fog, in units */
	fogRadius: number;
	crossChecks: number;
}

export interface Level {
	id: string;
	width: number;
	height: number;
	land: Side;
	start: Vec;
	stops: readonly Port[];
	rocks: readonly Circle[];
	shallows: readonly Circle[];
	buoys: readonly Buoy[];
	lighthouses: readonly Lighthouse[];
	tanker: TankerRoute | null;
	lie: LieParams;
	lieSeed: number;
	fogRadius: number;
	crossChecks: number;
	/** The time the star rating asks for, in seconds */
	par: number;
}

/** Radius of a lighthouse islet, which is as solid as a rock */
export const LIGHTHOUSE_RADIUS = 0.45;

/** Clear water kept around everything, so a boat always fits through */
const GAP = 1.7;
const START_CLEARANCE = 3.2;
const PORT_CLEARANCE = 2.4;
const TRIES = 600;

const distance = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);

export function distanceToSegment(point: Vec, from: Vec, to: Vec): number {
	const dx = to.x - from.x;
	const dy = to.y - from.y;
	const t = Math.max(
		0,
		Math.min(1, ((point.x - from.x) * dx + (point.y - from.y) * dy) / (dx * dx + dy * dy))
	);
	return Math.hypot(point.x - (from.x + t * dx), point.y - (from.y + t * dy));
}

/** Turns a point made facing north to the real coast */
function turn(point: Vec, side: Side, canonicalHeight: number): Vec {
	switch (side) {
		case 'north':
			return point;
		case 'south':
			return { x: point.x, y: canonicalHeight - point.y };
		case 'west':
			return { x: point.y, y: point.x };
		case 'east':
			return { x: canonicalHeight - point.y, y: point.x };
	}
}

/** Where the boat can go: the sea inside the border, minus the strip of land along the coast */
export function seaBounds(level: Pick<Level, 'width' | 'height' | 'land'>, margin = 0) {
	return {
		minX: margin + (level.land === 'west' ? COAST_DEPTH : 0),
		maxX: level.width - margin - (level.land === 'east' ? COAST_DEPTH : 0),
		minY: margin + (level.land === 'north' ? COAST_DEPTH : 0),
		maxY: level.height - margin - (level.land === 'south' ? COAST_DEPTH : 0)
	};
}

/** Scatters circles inside a box, each at least `gap` of clear water from everything already placed */
function scatter(
	random: Random,
	count: number,
	box: { minX: number; maxX: number; minY: number; maxY: number },
	radius: () => number,
	taken: Circle[],
	accept: (point: Circle) => boolean = () => true,
	gap = GAP
): Circle[] {
	const placed: Circle[] = [];
	for (let attempt = 0; attempt < TRIES && placed.length < count; attempt++) {
		const r = radius();
		const candidate = {
			x: box.minX + r + random() * (box.maxX - box.minX - 2 * r),
			y: box.minY + r + random() * (box.maxY - box.minY - 2 * r),
			r
		};
		const clear = [...taken, ...placed].every(
			(other) => distance(candidate, other) >= candidate.r + other.r + gap
		);
		if (clear && accept(candidate)) placed.push(candidate);
	}
	return placed;
}

export function buildLevel(spec: LevelSpec): Level {
	const random = createRandom(spec.seed);
	const sideways = spec.land === 'west' || spec.land === 'east';
	// The facing-north sea: land along the top edge, the boat at the bottom
	const width = sideways ? spec.height : spec.width;
	const height = sideways ? spec.width : spec.height;

	const start: Circle = {
		x: width * (0.3 + random() * 0.4),
		y: height - 2.2,
		r: START_CLEARANCE - GAP
	};
	// Harbours sit along the coast, spread across the width, in a shuffled order so the boat has
	// to cross the sea from one to the next
	const cargoFirst = pickOne(random, ['herring', 'stones'] as const);
	const slot = (width - 6) / spec.stops;
	const harbours = Array.from({ length: spec.stops }, (_, i) => ({
		x: 3 + slot * (i + 0.35 + random() * 0.3),
		y: COAST_DEPTH + 1.6 + random() * 1.4,
		r: PORT_CLEARANCE - GAP,
		cargo: ((i % 2 === 0) === (cargoFirst === 'herring') ? 'herring' : 'stones') as Cargo
	}));
	const order = shuffle(random, harbours);
	const taken: Circle[] = [start, ...harbours];

	// A tanker patrols a straight run through the middle of the sea
	let tanker: TankerRoute | null = null;
	if (spec.tanker) {
		const y = COAST_DEPTH + (height - COAST_DEPTH) * (0.45 + random() * 0.15);
		const length = Math.min(8, width * 0.3);
		const x = 3 + random() * (width - 6 - length);
		tanker = { from: { x, y }, to: { x: x + length, y } };
	}
	const route = tanker;
	const awayFromTanker = (point: Circle) =>
		route === null ||
		distanceToSegment(point, route.from, route.to) >= TANKER_RADIUS + point.r + GAP;

	const bounds = { minX: 1, maxX: width - 1, minY: COAST_DEPTH, maxY: height - 1 };
	const rocks = scatter(
		random,
		spec.rocks,
		bounds,
		() => 0.45 + random() * 0.35,
		taken,
		awayFromTanker
	);
	const islets = scatter(
		random,
		spec.lighthouses,
		bounds,
		() => LIGHTHOUSE_RADIUS,
		[...taken, ...rocks],
		awayFromTanker
	);
	// Shallows may lap round rocks (that is the point), but never cover the start or a harbour
	const shallows = scatter(
		random,
		spec.shallows,
		bounds,
		() => 1.1 + random() * 0.8,
		taken,
		awayFromTanker,
		0.4
	);
	const buoys = scatter(random, spec.buoys, bounds, () => 0.25, [...taken, ...rocks, ...islets]);
	const patterns = shuffle(
		random,
		Array.from({ length: spec.lighthouses }, (_, i) => (i % 4) + 1)
	);

	const turned = (point: Vec) => turn(point, spec.land, height);
	const stops = order.map((stop) => ({ ...turned(stop), cargo: stop.cargo }));
	const startPoint = turned(start);

	// Par: a straight run through every harbour at a relaxed pace, plus a cushion
	let runLength = 0;
	let from: Vec = startPoint;
	for (const stop of stops) {
		runLength += distance(from, stop);
		from = stop;
	}
	const par = Math.ceil(runLength / (BOAT_MAX_SPEED * PAR_SPEED_FRACTION) + PAR_CUSHION_S);

	return {
		id: spec.id,
		width: spec.width,
		height: spec.height,
		land: spec.land,
		start: startPoint,
		stops,
		rocks: rocks.map((rock) => ({ ...turned(rock), r: rock.r })),
		shallows: shallows.map((shallow) => ({ ...turned(shallow), r: shallow.r })),
		buoys: buoys.map((buoy, index) => ({ ...turned(buoy), number: index + 1 })),
		lighthouses: islets.map((islet, index) => ({ ...turned(islet), flashes: patterns[index] })),
		tanker: tanker && { from: turned(tanker.from), to: turned(tanker.to) },
		lie: spec.lie,
		lieSeed: spec.seed ^ 0x9e3779b9,
		fogRadius: spec.fogRadius,
		crossChecks: spec.crossChecks,
		par
	};
}

/** The unit vector pointing from the sea to the land, which is where the gulls fly */
export function landVector(side: Side): Vec {
	switch (side) {
		case 'north':
			return { x: 0, y: -1 };
		case 'south':
			return { x: 0, y: 1 };
		case 'west':
			return { x: -1, y: 0 };
		case 'east':
			return { x: 1, y: 0 };
	}
}
