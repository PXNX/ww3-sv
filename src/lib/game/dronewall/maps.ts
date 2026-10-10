/*
 * The maps of Drone Wall, ready to play on: the road as a Path, and a fixed scatter of scenery
 * (trees, rocks, ruins) on the empty ground, the same every time for a map.
 */
import {
	MAP_DEFS,
	WORLD_HEIGHT,
	WORLD_WIDTH,
	type DecorKind,
	type MapDef,
	type MapId,
	type Point
} from './config';
import { createPath, distanceBetween, type Path } from './path';

export interface Decor {
	kind: DecorKind;
	x: number;
	y: number;
	/** Size multiplier, 0.8 to 1.3 */
	size: number;
	/** Picks one of the theme's leaf colours */
	tint: number;
}

export interface DroneWallMap extends MapDef {
	road: Path;
	decor: readonly Decor[];
}

/** A small deterministic generator, so a map always looks the same */
function lcg(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
		return state / 0x100000000;
	};
}

function distanceToPath(point: Point, path: Path): number {
	let best = Infinity;
	for (let i = 0; i < path.points.length - 1; i++) {
		const a = path.points[i];
		const b = path.points[i + 1];
		const dx = b.x - a.x;
		const dy = b.y - a.y;
		const t = Math.max(
			0,
			Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy))
		);
		best = Math.min(best, distanceBetween(point, { x: a.x + t * dx, y: a.y + t * dy }));
	}
	return best;
}

function scatterDecor(map: MapDef, road: Path, seed: number): Decor[] {
	const random = lcg(seed);
	const props: Decor[] = [];
	// Bigger maps get more scenery, about the same amount per screen
	const wanted = Math.round((18 * map.height) / WORLD_HEIGHT);
	for (let attempt = 0; attempt < wanted * 25 && props.length < wanted; attempt++) {
		const x = 14 + random() * (WORLD_WIDTH - 28);
		const y = 14 + random() * (map.lineY - 30);
		const spot = { x, y };
		if (distanceToPath(spot, road) < 36) continue;
		if (map.slots.some((slot) => distanceBetween(slot, spot) < 40)) continue;
		if (props.some((prop) => distanceBetween(prop, spot) < 34)) continue;
		// Keep the corner with the helmet counter clear
		if (x > WORLD_WIDTH - 110 && y < 50) continue;
		props.push({
			kind: map.theme.decor[Math.floor(random() * map.theme.decor.length)],
			x,
			y,
			size: 0.8 + random() * 0.5,
			tint: Math.floor(random() * map.theme.leaves.length)
		});
	}
	// Back to front, so nearer props overlap farther ones
	return props.sort((a, b) => a.y - b.y);
}

export const MAPS: readonly DroneWallMap[] = MAP_DEFS.map((def, index) => {
	const road = createPath(def.points);
	return { ...def, road, decor: scatterDecor(def, road, 7919 * (index + 1)) };
});

export function getMap(id: MapId): DroneWallMap {
	return MAPS.find((map) => map.id === id) ?? MAPS[0];
}
