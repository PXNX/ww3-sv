/*
 * The defence test: your own base as an island you can attack with your own army, to see how the
 * layout holds. The home grid is 14 × 14 and the battle grid 12 × 8 with the beach on the left, so
 * every building and mine is squeezed onto the battle sand by its place on the home grid, and the
 * collisions that causes are resolved by moving things to the nearest free cell. The headquarters
 * keeps its place as the target; every other building stands in as a depot, and the mines are real.
 */
import { BUILDINGS, COLUMNS, ROWS, SHORE_X, type Island, type IslandBuilding } from './config.js';
import {
	BASE_COLS,
	BASE_ROWS,
	HOUSES,
	footprintOf,
	positionOf,
	LAYOUT_KEYS,
	type BaseLayout
} from './baseLayout.js';

/** Id of the island the test is played on, so nothing is stored for it */
export const TEST_ISLAND_ID = 'home-test';

interface Wanted {
	kind: IslandBuilding['kind'];
	x: number;
	y: number;
	/** Where the overcharge crystal of this building is kept: a building key or defense:<id> */
	target: string;
	hpScale?: number;
}

function squeeze(cellX: number, cellY: number): { x: number; y: number } {
	return {
		x: SHORE_X + Math.floor((cellX / BASE_COLS) * (COLUMNS - SHORE_X)),
		y: Math.floor((cellY / BASE_ROWS) * ROWS)
	};
}

/** The island your base becomes when somebody attacks it */
export function testIslandOf(
	layout: BaseLayout,
	crystalAt: (target: string) => IslandBuilding['crystal'] = () => undefined,
	houseLevel: (index: number) => number = () => 1
): Island {
	const wanted: Wanted[] = [];

	const hq = positionOf(layout, 'hq');
	const hqSize = footprintOf('hq');
	const at = squeeze(hq.x + hqSize.width / 2, hq.y + hqSize.height / 2);
	wanted.push({ kind: 'hq', x: at.x - 1, y: at.y - 1, target: 'hq' });
	for (const key of LAYOUT_KEYS) {
		if (key === 'hq') continue;
		const position = positionOf(layout, key);
		const size = footprintOf(key);
		const spot = squeeze(position.x + size.width / 2, position.y + size.height / 2);
		wanted.push({ kind: 'depot', x: spot.x, y: spot.y, target: key });
	}
	// The cottages stand in your base too; the higher their level, the sturdier they are
	for (let house = 0; house < HOUSES.width; house++) {
		const spot = squeeze(HOUSES.x + house + 0.5, HOUSES.y + 0.5);
		wanted.push({
			kind: 'depot',
			x: spot.x,
			y: spot.y,
			target: `house-${house}`,
			hpScale: 1 + 0.25 * (houseLevel(house) - 1)
		});
	}
	for (const mine of layout.mines) {
		const spot = squeeze(mine.x + 0.5, mine.y + 0.5);
		wanted.push({ kind: mine.kind, x: spot.x, y: spot.y, target: `defense:${mine.id}` });
	}

	const taken = new Set<string>();
	const buildings: IslandBuilding[] = [];
	for (const item of wanted) {
		const stats = BUILDINGS[item.kind];
		const spot = nearestFree(item.x, item.y, stats.width, stats.height, taken);
		if (!spot) continue;
		for (let dx = 0; dx < stats.width; dx++) {
			for (let dy = 0; dy < stats.height; dy++) taken.add(`${spot.x + dx},${spot.y + dy}`);
		}
		const crystal = crystalAt(item.target);
		buildings.push({
			kind: item.kind,
			x: spot.x,
			y: spot.y,
			...(crystal ? { crystal } : {}),
			...(item.hpScale && item.hpScale !== 1 ? { hpScale: item.hpScale } : {})
		});
	}
	return { id: TEST_ISLAND_ID, buildings };
}

/** The free spot nearest to where a building wants to stand, searched in growing rings */
function nearestFree(
	wantX: number,
	wantY: number,
	width: number,
	height: number,
	taken: ReadonlySet<string>
): { x: number; y: number } | null {
	const fits = (x: number, y: number): boolean => {
		if (x < SHORE_X + 1 || y < 0 || x + width > COLUMNS || y + height > ROWS) return false;
		for (let dx = 0; dx < width; dx++) {
			for (let dy = 0; dy < height; dy++) if (taken.has(`${x + dx},${y + dy}`)) return false;
		}
		return true;
	};
	const x0 = Math.min(Math.max(wantX, SHORE_X + 1), COLUMNS - width);
	const y0 = Math.min(Math.max(wantY, 0), ROWS - height);
	for (let ring = 0; ring <= COLUMNS; ring++) {
		let best: { x: number; y: number } | null = null;
		let bestDistance = Number.POSITIVE_INFINITY;
		for (let dx = -ring; dx <= ring; dx++) {
			for (let dy = -ring; dy <= ring; dy++) {
				if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
				const x = x0 + dx;
				const y = y0 + dy;
				if (!fits(x, y)) continue;
				const distance = Math.hypot(dx, dy);
				if (distance < bestDistance) {
					best = { x, y };
					bestDistance = distance;
				}
			}
		}
		if (best) return best;
	}
	return null;
}
