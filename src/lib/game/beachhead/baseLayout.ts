/*
 * The player's own island: a grid the buildings stand on and can be moved around on. The headquarters
 * is the big 5 × 5 block, training ground and dojo are 3 × 3, the radar and the warehouses 2 × 2 and
 * the mines a single cell. The landing craft are moored in the water beside the island, so they have
 * no cell. Pure data and rules, so the placement can be tested without a canvas.
 */
import { MINE_KINDS, type MineKind } from './config.js';

/** The guns from the other game modes that the headquarters unlocks for your own base */
export type GuardKind =
	'sniper' | 'flame' | 'mortar' | 'fpv-nest' | 'patriot' | 'himars' | 'jammer';
export type DefenseKind = MineKind | GuardKind;
export const GUARD_KINDS: readonly GuardKind[] = [
	'sniper',
	'flame',
	'mortar',
	'fpv-nest',
	'patriot',
	'himars',
	'jammer'
];
export const DEFENSE_KINDS: readonly DefenseKind[] = [...MINE_KINDS, ...GUARD_KINDS];

/** The headquarters level that unlocks each gun */
export const GUARD_UNLOCK_HQ: Record<GuardKind, number> = {
	sniper: 2,
	flame: 3,
	mortar: 3,
	'fpv-nest': 4,
	patriot: 5,
	himars: 6,
	jammer: 7
};

export function isGuard(kind: DefenseKind): kind is GuardKind {
	return (GUARD_KINDS as readonly string[]).includes(kind);
}

/** Whether a headquarters of this level may buy the defence; mines are open from the start */
export function defenseUnlocked(kind: DefenseKind, hqLevel: number): boolean {
	return !isGuard(kind) || hqLevel >= GUARD_UNLOCK_HQ[kind];
}

export const BASE_COLS = 14;
export const BASE_ROWS = 14;
/** At most this many mines and guns fit on the island, so the grid cannot be filled with them */
export const MAX_MINES = 24;

type LayoutResource = 'wood' | 'stone' | 'iron' | 'gold';
/** The buildings that stand on the grid; the boats are moored in the water instead */
export type LayoutKey =
	'hq' | 'training' | 'radar' | 'dojo' | 'bunker' | `warehouse-${LayoutResource}-${number}`;

export interface Cell {
	x: number;
	y: number;
}

export interface Footprint {
	width: number;
	height: number;
}

export interface PlacedMine extends Cell {
	id: number;
	kind: DefenseKind;
}

export interface BaseLayout {
	/** Top-left cell of every building on the grid */
	positions: Record<string, Cell>;
	mines: PlacedMine[];
	nextMineId: number;
}

/** Ground the island keeps for itself: a forest that gives wood and a little mountain with an iron mine */
export const FOREST: Footprint & Cell = { x: 5, y: 0, width: 4, height: 2 };
export const MOUNTAIN: Footprint & Cell = { x: 0, y: 0, width: 2, height: 2 };

/** Three cottages whose families pay taxes in gold, and the quarry ditch dug beside the mountain */
export const HOUSES: Footprint & Cell = { x: 1, y: 4, width: 3, height: 1 };
export const QUARRY: Footprint & Cell = { x: 0, y: 2, width: 2, height: 2 };

export function touchesNature(cell: Cell, footprint: Footprint): boolean {
	return [FOREST, MOUNTAIN, HOUSES, QUARRY].some((rect) => overlaps(cell, footprint, rect, rect));
}

export const LAYOUT_KEYS: readonly LayoutKey[] = [
	'hq',
	'training',
	'radar',
	'dojo',
	'bunker',
	...(['wood', 'stone', 'iron', 'gold'] as const).flatMap(
		(resource) => [0, 1].map((index) => `warehouse-${resource}-${index}` as const) as LayoutKey[]
	)
];

export function isLayoutKey(key: string): key is LayoutKey {
	return (LAYOUT_KEYS as readonly string[]).includes(key);
}

export function footprintOf(key: LayoutKey | DefenseKind): Footprint {
	if (key === 'hq') return { width: 5, height: 5 };
	if (key === 'training' || key === 'dojo') return { width: 3, height: 3 };
	if (key === 'radar' || key === 'bunker' || key.startsWith('warehouse-'))
		return { width: 2, height: 2 };
	return { width: 1, height: 1 };
}

const DEFAULT_POSITIONS: Record<LayoutKey, Cell> = {
	hq: { x: 5, y: 3 },
	training: { x: 2, y: 1 },
	dojo: { x: 10, y: 1 },
	radar: { x: 11, y: 5 },
	bunker: { x: 3, y: 7 },
	'warehouse-wood-0': { x: 1, y: 5 },
	'warehouse-wood-1': { x: 1, y: 7 },
	'warehouse-stone-0': { x: 3, y: 10 },
	'warehouse-stone-1': { x: 5, y: 10 },
	'warehouse-iron-0': { x: 7, y: 10 },
	'warehouse-iron-1': { x: 9, y: 10 },
	'warehouse-gold-0': { x: 11, y: 8 },
	'warehouse-gold-1': { x: 11, y: 10 }
};

export function defaultLayout(): BaseLayout {
	return {
		positions: Object.fromEntries(LAYOUT_KEYS.map((key) => [key, { ...DEFAULT_POSITIONS[key] }])),
		mines: [],
		nextMineId: 1
	};
}

export function positionOf(layout: BaseLayout, key: LayoutKey): Cell {
	return layout.positions[key] ?? DEFAULT_POSITIONS[key];
}

/** What one mine of each kind costs; a sold mine pays back half */
export const MINE_COST: Record<MineKind, Record<LayoutResource, number>> = {
	'mine-personnel': { wood: 10, stone: 8, iron: 12, gold: 0 },
	'mine-at': { wood: 12, stone: 10, iron: 30, gold: 1 },
	'mine-emp': { wood: 10, stone: 10, iron: 40, gold: 4 }
};

/** What every defence costs: the mines, and the guns that grow dearer with the headquarters level they need */
export const DEFENSE_COST: Record<DefenseKind, Record<LayoutResource, number>> = {
	...MINE_COST,
	sniper: { wood: 60, stone: 40, iron: 60, gold: 4 },
	flame: { wood: 70, stone: 50, iron: 80, gold: 6 },
	mortar: { wood: 90, stone: 80, iron: 100, gold: 8 },
	'fpv-nest': { wood: 100, stone: 60, iron: 140, gold: 12 },
	patriot: { wood: 160, stone: 120, iron: 240, gold: 24 },
	himars: { wood: 220, stone: 160, iron: 320, gold: 32 },
	jammer: { wood: 180, stone: 140, iron: 280, gold: 36 }
};

export function mineRefund(kind: DefenseKind): Record<LayoutResource, number> {
	const cost = DEFENSE_COST[kind];
	return {
		wood: Math.floor(cost.wood / 2),
		stone: Math.floor(cost.stone / 2),
		iron: Math.floor(cost.iron / 2),
		gold: Math.floor(cost.gold / 2)
	};
}

export function isInside(cell: Cell, footprint: Footprint): boolean {
	return (
		Number.isInteger(cell.x) &&
		Number.isInteger(cell.y) &&
		cell.x >= 0 &&
		cell.y >= 0 &&
		cell.x + footprint.width <= BASE_COLS &&
		cell.y + footprint.height <= BASE_ROWS
	);
}

function overlaps(a: Cell, af: Footprint, b: Cell, bf: Footprint): boolean {
	return (
		a.x < b.x + bf.width && b.x < a.x + af.width && a.y < b.y + bf.height && b.y < a.y + af.height
	);
}

/** What stands on a cell, as a building key or a mine id; null for open ground */
export type Occupant = { kind: 'building'; key: LayoutKey } | { kind: 'mine'; id: number };

export function occupantAt(layout: BaseLayout, x: number, y: number): Occupant | null {
	for (const key of LAYOUT_KEYS) {
		const at = positionOf(layout, key);
		const size = footprintOf(key);
		if (x >= at.x && x < at.x + size.width && y >= at.y && y < at.y + size.height) {
			return { kind: 'building', key };
		}
	}
	for (const mine of layout.mines) {
		if (mine.x === x && mine.y === y) return { kind: 'mine', id: mine.id };
	}
	return null;
}

/** Whether a footprint fits at a cell without leaving the grid or touching anything but itself */
export function canPlace(
	layout: BaseLayout,
	footprint: Footprint,
	cell: Cell,
	ignore?: { key?: LayoutKey; mineId?: number }
): boolean {
	if (!isInside(cell, footprint) || touchesNature(cell, footprint)) return false;
	for (const key of LAYOUT_KEYS) {
		if (key === ignore?.key) continue;
		if (overlaps(cell, footprint, positionOf(layout, key), footprintOf(key))) return false;
	}
	for (const mine of layout.mines) {
		if (mine.id === ignore?.mineId) continue;
		if (overlaps(cell, footprint, mine, { width: 1, height: 1 })) return false;
	}
	return true;
}

/** Moves a building to a new top-left cell; null when it would not fit there */
export function moveBuilding(layout: BaseLayout, key: LayoutKey, cell: Cell): BaseLayout | null {
	if (!canPlace(layout, footprintOf(key), cell, { key })) return null;
	const current = positionOf(layout, key);
	if (current.x === cell.x && current.y === cell.y) return null;
	return { ...layout, positions: { ...layout.positions, [key]: { x: cell.x, y: cell.y } } };
}

/** The first free cell for a new mine, searching from the front of the island */
export function freeMineCell(layout: BaseLayout): Cell | null {
	for (let y = BASE_ROWS - 1; y >= 0; y--) {
		for (let x = 0; x < BASE_COLS; x++) {
			if (canPlace(layout, { width: 1, height: 1 }, { x, y })) return { x, y };
		}
	}
	return null;
}

export function addMine(layout: BaseLayout, kind: DefenseKind, cell?: Cell): BaseLayout | null {
	if (layout.mines.length >= MAX_MINES) return null;
	const at = cell ?? freeMineCell(layout);
	if (!at || !canPlace(layout, { width: 1, height: 1 }, at)) return null;
	return {
		...layout,
		mines: [...layout.mines, { id: layout.nextMineId, kind, x: at.x, y: at.y }],
		nextMineId: layout.nextMineId + 1
	};
}

export function moveMine(layout: BaseLayout, id: number, cell: Cell): BaseLayout | null {
	const mine = layout.mines.find((candidate) => candidate.id === id);
	if (!mine || (mine.x === cell.x && mine.y === cell.y)) return null;
	if (!canPlace(layout, { width: 1, height: 1 }, cell, { mineId: id })) return null;
	return {
		...layout,
		mines: layout.mines.map((candidate) =>
			candidate.id === id ? { ...candidate, x: cell.x, y: cell.y } : candidate
		)
	};
}

export function removeMine(layout: BaseLayout, id: number): BaseLayout | null {
	if (!layout.mines.some((mine) => mine.id === id)) return null;
	return { ...layout, mines: layout.mines.filter((mine) => mine.id !== id) };
}

/** Like canPlace, but only against what the layout actually holds so far, not against default spots */
function fitsAmongPlaced(layout: BaseLayout, footprint: Footprint, cell: Cell): boolean {
	if (!isInside(cell, footprint) || touchesNature(cell, footprint)) return false;
	for (const key of LAYOUT_KEYS) {
		const at = layout.positions[key];
		if (at && overlaps(cell, footprint, at, footprintOf(key))) return false;
	}
	return !layout.mines.some((mine) => overlaps(cell, footprint, mine, { width: 1, height: 1 }));
}

function isCell(value: unknown): value is Cell {
	if (typeof value !== 'object' || value === null) return false;
	const candidate = value as Partial<Cell>;
	return Number.isInteger(candidate.x) && Number.isInteger(candidate.y);
}

/**
 * Reads a stored layout. Anything missing, off the grid or overlapping something already placed falls
 * back to the default spot, and if that is taken too the whole layout resets, so a damaged save can
 * never leave a building stuck inside another one.
 */
export function normalizeLayout(value: unknown): BaseLayout {
	if (typeof value !== 'object' || value === null) return defaultLayout();
	const candidate = value as Partial<BaseLayout>;
	const stored =
		typeof candidate.positions === 'object' && candidate.positions !== null
			? (candidate.positions as Record<string, unknown>)
			: {};

	let layout: BaseLayout = { positions: {}, mines: [], nextMineId: 1 };
	for (const key of LAYOUT_KEYS) {
		const wanted = stored[key];
		const size = footprintOf(key);
		const fallback = DEFAULT_POSITIONS[key];
		const choice =
			isCell(wanted) && fitsAmongPlaced(layout, size, wanted)
				? { x: wanted.x, y: wanted.y }
				: fitsAmongPlaced(layout, size, fallback)
					? { ...fallback }
					: null;
		if (!choice) return defaultLayout();
		layout = { ...layout, positions: { ...layout.positions, [key]: choice } };
	}

	const mines: unknown[] = Array.isArray(candidate.mines) ? candidate.mines : [];
	let highest = 0;
	for (const entry of mines) {
		if (typeof entry !== 'object' || entry === null) continue;
		const { id, kind, x, y } = entry as Record<string, unknown>;
		if (typeof kind !== 'string' || !(DEFENSE_KINDS as readonly string[]).includes(kind)) continue;
		if (typeof id !== 'number' || !Number.isInteger(id) || id < 1) continue;
		if (typeof x !== 'number' || typeof y !== 'number') continue;
		if (layout.mines.some((placed) => placed.id === id)) continue;
		if (layout.mines.length >= MAX_MINES) break;
		if (!fitsAmongPlaced(layout, { width: 1, height: 1 }, { x, y })) continue;
		layout = { ...layout, mines: [...layout.mines, { id, kind: kind as DefenseKind, x, y }] };
		highest = Math.max(highest, id);
	}
	const storedNext = Number.isInteger(candidate.nextMineId) ? (candidate.nextMineId as number) : 0;
	return { ...layout, nextMineId: Math.max(highest + 1, storedNext, 1) };
}

/** Where a landing craft is moored, outside the grid on the water to the right of the island */
export function boatDock(index: number): { x: number; y: number } {
	return { x: BASE_COLS + 1.1, y: 0.4 + index * 1.7 };
}
