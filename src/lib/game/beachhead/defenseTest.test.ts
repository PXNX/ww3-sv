import { describe, expect, it } from 'vitest';
import { BUILDINGS, COLUMNS, ROWS, SHORE_X, isMine } from './config';
import { addMine, defaultLayout } from './baseLayout';
import { TEST_ISLAND_ID, testIslandOf } from './defenseTest';
import { createBattle } from './battle';

describe('the defence test island', () => {
	it('has your headquarters as the only target to destroy, plus depots for the rest', () => {
		const island = testIslandOf(defaultLayout());
		expect(island.id).toBe(TEST_ISLAND_ID);
		expect(island.buildings.filter((b) => b.kind === 'hq')).toHaveLength(1);
		expect(island.buildings.filter((b) => b.kind === 'depot')).toHaveLength(15);
	});

	it('brings every mine you placed along, of the same kind', () => {
		let layout = addMine(defaultLayout(), 'mine-at')!;
		layout = addMine(layout, 'mine-emp')!;
		layout = addMine(layout, 'mine-personnel')!;
		const kinds = testIslandOf(layout)
			.buildings.filter((b) => isMine(b.kind))
			.map((b) => b.kind)
			.sort();
		expect(kinds).toEqual(['mine-at', 'mine-emp', 'mine-personnel']);
	});

	it('keeps everything on the sand without overlaps', () => {
		let layout = defaultLayout();
		for (let index = 0; index < 8; index++) layout = addMine(layout, 'mine-personnel')!;
		const island = testIslandOf(layout);
		const taken = new Set<string>();
		for (const building of island.buildings) {
			const stats = BUILDINGS[building.kind];
			expect(building.x).toBeGreaterThan(SHORE_X);
			expect(building.x + stats.width).toBeLessThanOrEqual(COLUMNS);
			expect(building.y + stats.height).toBeLessThanOrEqual(ROWS);
			for (let dx = 0; dx < stats.width; dx++) {
				for (let dy = 0; dy < stats.height; dy++) {
					const key = `${building.x + dx},${building.y + dy}`;
					expect(taken.has(key), key).toBe(false);
					taken.add(key);
				}
			}
		}
	});

	it('is a battle the game can run', () => {
		const state = createBattle(testIslandOf(defaultLayout()));
		expect(state.buildings.length).toBeGreaterThan(5);
		expect(state.status).toBe('playing');
	});
});

describe('which side the test attack comes from', () => {
	it('lands on the beach side of the base: what lies at the front of the island stands nearest the shore', () => {
		const layout = defaultLayout();
		const island = testIslandOf(layout);
		const hq = island.buildings.find((b) => b.kind === 'hq')!;
		// The headquarters is at the back of the home island, so it ends up far from the beach...
		const front = addMine(layout, 'mine-at', { x: 6, y: 12 })!;
		const withMine = testIslandOf(front);
		const mine = withMine.buildings.find((b) => b.kind === 'mine-at')!;
		// ...and a mine at the front stands closer to the beach than the headquarters
		expect(mine.x).toBeLessThan(hq.x);
	});
});
