import { describe, expect, it } from 'vitest';
import {
	BASE_COLS,
	BASE_ROWS,
	LAYOUT_KEYS,
	MAX_MINES,
	MINE_COST,
	addMine,
	canPlace,
	defaultLayout,
	footprintOf,
	moveBuilding,
	moveMine,
	normalizeLayout,
	occupantAt,
	positionOf,
	removeMine
} from './baseLayout';
import {
	buyMine,
	layoutOf,
	moveBuildingTo,
	moveMineTo,
	newSave,
	parseSave,
	sellMine
} from './campaign';

describe('building footprints', () => {
	it('makes the headquarters 5 × 5, the training ground and dojo 3 × 3, small buildings 2 × 2 and mines one cell', () => {
		expect(footprintOf('hq')).toEqual({ width: 5, height: 5 });
		expect(footprintOf('training')).toEqual({ width: 3, height: 3 });
		expect(footprintOf('dojo')).toEqual({ width: 3, height: 3 });
		expect(footprintOf('radar')).toEqual({ width: 2, height: 2 });
		expect(footprintOf('warehouse-gold-1')).toEqual({ width: 2, height: 2 });
		for (const kind of ['mine-emp', 'mine-personnel', 'mine-at'] as const) {
			expect(footprintOf(kind)).toEqual({ width: 1, height: 1 });
		}
	});
});

describe('the default island', () => {
	it('places every building inside the grid without any overlap', () => {
		const layout = defaultLayout();
		const taken = new Set<string>();
		for (const key of LAYOUT_KEYS) {
			const at = positionOf(layout, key);
			const size = footprintOf(key);
			expect(at.x, key).toBeGreaterThanOrEqual(0);
			expect(at.y, key).toBeGreaterThanOrEqual(0);
			expect(at.x + size.width, key).toBeLessThanOrEqual(BASE_COLS);
			expect(at.y + size.height, key).toBeLessThanOrEqual(BASE_ROWS);
			for (let dx = 0; dx < size.width; dx++) {
				for (let dy = 0; dy < size.height; dy++) {
					const cell = `${at.x + dx},${at.y + dy}`;
					expect(taken.has(cell), `${key} overlaps at ${cell}`).toBe(false);
					taken.add(cell);
				}
			}
		}
	});

	it('has the headquarters, training ground, radar, dojo, bunker and all eight warehouses', () => {
		expect(LAYOUT_KEYS).toHaveLength(13);
		expect(LAYOUT_KEYS.filter((key) => key.startsWith('warehouse-'))).toHaveLength(8);
	});

	it('leaves room to move things around', () => {
		const layout = defaultLayout();
		const used = LAYOUT_KEYS.reduce((sum, key) => {
			const size = footprintOf(key);
			return sum + size.width * size.height;
		}, 0);
		expect(used).toBeLessThan(BASE_COLS * BASE_ROWS * 0.6);
		expect(occupantAt(layout, 7, 5)).toEqual({ kind: 'building', key: 'hq' });
		expect(occupantAt(layout, 0, BASE_ROWS - 1)).toBeNull();
	});
});

describe('the cottages and the quarry', () => {
	it('are ground nobody can build on', () => {
		const layout = defaultLayout();
		expect(canPlace(layout, { width: 1, height: 1 }, { x: 2, y: 4 })).toBe(false);
		expect(canPlace(layout, { width: 1, height: 1 }, { x: 10, y: 13 })).toBe(false);
		expect(moveBuilding(layout, 'radar', { x: 10, y: 12 })).toBeNull();
	});
});

describe('the forest and the mountain', () => {
	it('are not building land: nothing can stand or be mined there', () => {
		const layout = defaultLayout();
		expect(canPlace(layout, { width: 1, height: 1 }, { x: 5, y: 0 })).toBe(false);
		expect(canPlace(layout, { width: 1, height: 1 }, { x: 13, y: 13 })).toBe(false);
		expect(moveBuilding(layout, 'training', { x: 4, y: 0 })).toBeNull();
		expect(moveBuilding(layout, 'radar', { x: 12, y: 12 })).toBeNull();
		expect(addMine(layout, 'mine-at', { x: 12, y: 12 })).toBeNull();
	});

	it('are never taken by the default arrangement or by a mine bought on the first free cell', () => {
		const layout = addMine(defaultLayout(), 'mine-emp')!;
		const mine = layout.mines[0];
		expect(canPlace(defaultLayout(), { width: 1, height: 1 }, { x: mine.x, y: mine.y })).toBe(true);
		expect(mine.x < 12 || mine.y < 12).toBe(true);
	});
});

describe('moving buildings', () => {
	it('moves a building to a free spot and keeps the rest where they were', () => {
		const layout = defaultLayout();
		const moved = moveBuilding(layout, 'training', { x: 0, y: 9 })!;
		expect(positionOf(moved, 'training')).toEqual({ x: 0, y: 9 });
		expect(positionOf(moved, 'hq')).toEqual(positionOf(layout, 'hq'));
		// The original is not touched
		expect(positionOf(layout, 'training')).toEqual({ x: 1, y: 1 });
	});

	it('lets a building slide over its own old cells', () => {
		const layout = defaultLayout();
		const at = positionOf(layout, 'hq');
		expect(moveBuilding(layout, 'hq', { x: at.x, y: at.y + 1 })).not.toBeNull();
	});

	it('refuses a spot that is taken, off the grid or unchanged', () => {
		const layout = defaultLayout();
		expect(moveBuilding(layout, 'training', { x: 5, y: 3 })).toBeNull();
		expect(moveBuilding(layout, 'hq', { x: 10, y: 0 })).toBeNull();
		expect(moveBuilding(layout, 'hq', { x: -1, y: 3 })).toBeNull();
		expect(moveBuilding(layout, 'hq', { x: BASE_COLS - 4, y: 3 })).toBeNull();
		expect(moveBuilding(layout, 'training', { x: 1.5, y: 1 })).toBeNull();
		expect(moveBuilding(layout, 'training', { x: 1, y: 1 })).toBeNull();
	});

	it('cannot put anything where a mine is, or a mine where a building is', () => {
		const layout = addMine(defaultLayout(), 'mine-at', { x: 0, y: 9 })!;
		expect(moveBuilding(layout, 'training', { x: 0, y: 9 })).toBeNull();
		expect(addMine(layout, 'mine-emp', { x: 5, y: 3 })).toBeNull();
		expect(addMine(layout, 'mine-emp', { x: 0, y: 9 })).toBeNull();
	});
});

describe('mines on the island', () => {
	it('start on the first free cell at the front and can be moved and removed', () => {
		let layout = addMine(defaultLayout(), 'mine-personnel')!;
		expect(layout.mines).toHaveLength(1);
		expect(layout.mines[0]).toMatchObject({ x: 0, y: BASE_ROWS - 1, kind: 'mine-personnel' });
		const id = layout.mines[0].id;
		layout = moveMine(layout, id, { x: 6, y: 9 })!;
		expect(layout.mines[0]).toMatchObject({ x: 6, y: 9 });
		expect(moveMine(layout, id, { x: 5, y: 3 })).toBeNull();
		layout = removeMine(layout, id)!;
		expect(layout.mines).toHaveLength(0);
		expect(removeMine(layout, id)).toBeNull();
	});

	it('give every mine its own id, even after one is sold', () => {
		let layout = addMine(defaultLayout(), 'mine-at')!;
		layout = addMine(layout, 'mine-emp')!;
		layout = removeMine(layout, layout.mines[0].id)!;
		layout = addMine(layout, 'mine-personnel')!;
		const ids = layout.mines.map((mine) => mine.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('stop at the limit', () => {
		let layout = defaultLayout();
		for (let index = 0; index < MAX_MINES; index++) layout = addMine(layout, 'mine-at')!;
		expect(layout.mines).toHaveLength(MAX_MINES);
		expect(addMine(layout, 'mine-at')).toBeNull();
	});

	it('canPlace agrees with the moves', () => {
		const layout = defaultLayout();
		expect(canPlace(layout, { width: 1, height: 1 }, { x: 0, y: 13 })).toBe(true);
		expect(canPlace(layout, { width: 1, height: 1 }, { x: 5, y: 3 })).toBe(false);
		expect(canPlace(layout, { width: 1, height: 1 }, { x: 14, y: 0 })).toBe(false);
	});
});

describe('reading a stored layout', () => {
	it('gives the default for nothing or garbage', () => {
		expect(normalizeLayout(undefined)).toEqual(defaultLayout());
		expect(normalizeLayout('nope')).toEqual(defaultLayout());
		expect(normalizeLayout({ positions: 4, mines: 'x' })).toEqual(defaultLayout());
	});

	it('keeps a valid arrangement', () => {
		const moved = moveBuilding(defaultLayout(), 'radar', { x: 8, y: 12 })!;
		const withMine = addMine(moved, 'mine-emp', { x: 4, y: 4 })!;
		expect(normalizeLayout(JSON.parse(JSON.stringify(withMine)))).toEqual(withMine);
	});

	it('puts a building that overlaps another one back on its default spot', () => {
		const messy = defaultLayout();
		messy.positions.training = { x: 5, y: 3 };
		messy.positions.dojo = { x: 99, y: -4 };
		const fixed = normalizeLayout(messy);
		expect(positionOf(fixed, 'hq')).toEqual({ x: 5, y: 3 });
		expect(positionOf(fixed, 'training')).toEqual({ x: 1, y: 1 });
		expect(positionOf(fixed, 'dojo')).toEqual({ x: 10, y: 1 });
	});

	it('drops mines that are on a building, off the grid or of an unknown kind', () => {
		const stored = {
			...defaultLayout(),
			mines: [
				{ id: 1, kind: 'mine-at', x: 5, y: 3 },
				{ id: 2, kind: 'mine-at', x: 40, y: 3 },
				{ id: 3, kind: 'mine-nuke', x: 0, y: 13 },
				{ id: 4, kind: 'mine-emp', x: 0, y: 13 },
				{ id: 4, kind: 'mine-emp', x: 1, y: 13 }
			],
			nextMineId: 2
		};
		const fixed = normalizeLayout(stored);
		expect(fixed.mines).toEqual([{ id: 4, kind: 'mine-emp', x: 0, y: 13 }]);
		expect(fixed.nextMineId).toBe(5);
	});
});

describe('the island in a save', () => {
	it('is the default arrangement for a fresh or an older save', () => {
		const save = newSave(0);
		expect(save.layout).toBeUndefined();
		expect(layoutOf(save)).toEqual(defaultLayout());
	});

	it('saves a move and survives a round trip through storage', () => {
		const save = moveBuildingTo(newSave(0), 'training', { x: 0, y: 9 })!;
		expect(positionOf(layoutOf(save), 'training')).toEqual({ x: 0, y: 9 });
		const loaded = parseSave(JSON.parse(JSON.stringify(save)))!;
		expect(positionOf(layoutOf(loaded), 'training')).toEqual({ x: 0, y: 9 });
	});

	it('ignores moves for buildings that are not on the grid, such as boats', () => {
		expect(moveBuildingTo(newSave(0), 'boat-0', { x: 1, y: 1 })).toBeNull();
	});

	it('repairs a damaged layout while loading instead of losing the save', () => {
		const broken = { ...newSave(0), layout: { positions: { hq: { x: -9, y: -9 } }, mines: 3 } };
		const loaded = parseSave(JSON.parse(JSON.stringify(broken)))!;
		expect(loaded.layout).toEqual(defaultLayout());
	});

	it('buys a mine for its price and refuses when the stock is too low', () => {
		const save = newSave(0);
		const bought = buyMine(save, 'mine-personnel')!;
		const cost = MINE_COST['mine-personnel'];
		expect(bought.resources.wood).toBe(save.resources.wood - cost.wood);
		expect(bought.resources.iron).toBe(save.resources.iron - cost.iron);
		expect(layoutOf(bought).mines).toHaveLength(1);
		const broke = { ...save, resources: { wood: 0, stone: 0, iron: 0, gold: 0 } };
		expect(buyMine(broke, 'mine-emp')).toBeNull();
	});

	it('sells a mine for half and lets it be moved', () => {
		const bought = buyMine(newSave(0), 'mine-at')!;
		const id = layoutOf(bought).mines[0].id;
		const moved = moveMineTo(bought, id, { x: 8, y: 9 })!;
		expect(layoutOf(moved).mines[0]).toMatchObject({ x: 8, y: 9 });
		const sold = sellMine(moved, id)!;
		expect(layoutOf(sold).mines).toHaveLength(0);
		expect(sold.resources.iron).toBe(
			bought.resources.iron + Math.floor(MINE_COST['mine-at'].iron / 2)
		);
		expect(sellMine(sold, id)).toBeNull();
	});
});
