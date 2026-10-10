/*
 * Shaping roads: a handful of corner points becomes a smooth, winding road by cutting the corners
 * (Chaikin). Pure geometry with no game imports, so map data can use it.
 */
export interface RoadPoint {
	x: number;
	y: number;
}

/**
 * Cuts the corners of a polyline `rounds` times. The first and last point stay where they are, so
 * the road still enters above the field and ends on the line.
 */
export function smooth(points: readonly RoadPoint[], rounds = 2): RoadPoint[] {
	let current = [...points];
	for (let round = 0; round < rounds; round++) {
		const next: RoadPoint[] = [current[0]];
		for (let i = 0; i < current.length - 1; i++) {
			const a = current[i];
			const b = current[i + 1];
			next.push(
				{ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 },
				{ x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 }
			);
		}
		next.push(current[current.length - 1]);
		current = next;
	}
	// Whole numbers keep the data readable and the shape stable
	return current.map(({ x, y }) => ({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 }));
}
