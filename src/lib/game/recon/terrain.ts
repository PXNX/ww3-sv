/*
 * The ground under the drone: patchwork fields, woods, two roads and a few villages. Pure data;
 * render.ts paints it differently for each sensor.
 */
import { MAP_H, MAP_W } from './config.js';
import { randomInt, type Random } from '../random.js';

export interface Field {
	x: number;
	y: number;
	w: number;
	h: number;
	/** 0 to 3, picks a colour */
	tone: number;
	/** Furrows run along the long side */
	vertical: boolean;
}

export interface Wood {
	x: number;
	y: number;
	trees: { x: number; y: number; r: number }[];
}

export interface Point {
	x: number;
	y: number;
}

export interface Road {
	points: Point[];
	width: number;
}

export interface House {
	x: number;
	y: number;
	w: number;
	h: number;
	/** 0 to 2, picks a roof colour */
	roof: number;
}

export interface Village {
	x: number;
	y: number;
	r: number;
}

export interface Barn {
	x: number;
	y: number;
	w: number;
	h: number;
}

export interface Pylon {
	x: number;
	y: number;
	h: number;
}

export interface Bridge {
	x: number;
	y: number;
	w: number;
	h: number;
}

export interface Block {
	x: number;
	y: number;
	w: number;
	h: number;
}

export interface Warehouse {
	x: number;
	y: number;
	w: number;
	h: number;
}

export interface Terrain {
	fields: Field[];
	woods: Wood[];
	roads: Road[];
	villages: Village[];
	houses: House[];
	barns: Barn[];
	pylons: Pylon[];
	bridges: Bridge[];
	warehouses: Warehouse[];
	bunkers: Warehouse[];
	river: Point[];
	/** A dense cluster of buildings close together on a grid */
	blocks: Block[];
	/** Substations that boost power returns */
	substations: Warehouse[];
}

const COLS = 4;
const ROWS = 5;

function range(random: Random, min: number, max: number): number {
	return min + random() * (max - min);
}

export function generateTerrain(random: Random): Terrain {
	const cellW = MAP_W / COLS;
	const cellH = MAP_H / ROWS;
	const fields: Field[] = [];
	for (let row = 0; row < ROWS; row++) {
		for (let col = 0; col < COLS; col++) {
			const inset = range(random, 4, 14);
			fields.push({
				x: col * cellW + inset,
				y: row * cellH + inset,
				w: cellW - inset * 2,
				h: cellH - inset * 2,
				tone: randomInt(random, 0, 4),
				vertical: random() < 0.5
			});
		}
	}

	const woods: Wood[] = [];
	const woodCount = randomInt(random, 9, 13);
	for (let i = 0; i < woodCount; i++) {
		const x = range(random, 40, MAP_W - 40);
		const y = range(random, 40, MAP_H - 40);
		const trees = Array.from({ length: randomInt(random, 4, 8) }, () => ({
			x: x + range(random, -26, 26),
			y: y + range(random, -22, 22),
			r: range(random, 12, 22)
		}));
		woods.push({ x, y, trees });
	}

	// One road runs roughly west to east, one roughly north to south
	const roads: Road[] = [];
	const wave = range(random, 20, 50);
	const phase = range(random, 0, Math.PI * 2);
	const baseY = range(random, MAP_H * 0.3, MAP_H * 0.6);
	roads.push({
		width: 14,
		points: Array.from({ length: 13 }, (_, i) => ({
			x: (i / 12) * MAP_W,
			y: baseY + Math.sin(phase + i * 0.7) * wave
		}))
	});
	const baseX = range(random, MAP_W * 0.3, MAP_W * 0.7);
	roads.push({
		width: 11,
		points: Array.from({ length: 16 }, (_, i) => ({
			x: baseX + Math.sin(phase * 1.7 + i * 0.6) * wave,
			y: (i / 15) * MAP_H
		}))
	});

	const villages: Village[] = [];
	const houses: House[] = [];
	const villageCount = randomInt(random, 3, 5);
	for (let i = 0; i < villageCount; i++) {
		const village = { x: range(random, 90, MAP_W - 90), y: range(random, 110, MAP_H - 260), r: 58 };
		villages.push(village);
		const count = randomInt(random, 5, 9);
		for (let j = 0; j < count; j++) {
			const angle = random() * Math.PI * 2;
			const dist = range(random, 6, village.r - 12);
			houses.push({
				x: village.x + Math.cos(angle) * dist,
				y: village.y + Math.sin(angle) * dist,
				w: range(random, 10, 16),
				h: range(random, 8, 13),
				roof: randomInt(random, 0, 3)
			});
		}
	}

	const barns: Barn[] = [];
	for (let i = 0; i < randomInt(random, 2, 4); i++) {
		barns.push({
			x: range(random, 60, MAP_W - 60),
			y: range(random, 60, MAP_H - 60),
			w: range(random, 24, 40),
			h: range(random, 16, 28)
		});
	}

	const pylons: Pylon[] = [];
	for (let i = 0; i < randomInt(random, 1, 3); i++) {
		pylons.push({
			x: range(random, 80, MAP_W - 80),
			y: range(random, 80, MAP_H - 120),
			h: range(random, 30, 60)
		});
	}

	const bridges: Bridge[] = [];
	for (let i = 0; i < randomInt(random, 1, 2); i++) {
		bridges.push({
			x: range(random, 100, MAP_W - 100),
			y: range(random, 200, MAP_H - 200),
			w: range(random, 40, 70),
			h: 6
		});
	}

	const warehouses: Warehouse[] = [];
	const bunkers: Warehouse[] = [];
	for (let i = 0; i < randomInt(random, 2, 5); i++) warehouses.push({ x: range(random, 60, MAP_W - 60), y: range(random, 60, MAP_H - 60), w: range(random, 30, 50), h: range(random, 16, 30) });
	for (let i = 0; i < randomInt(random, 0, 2); i++) bunkers.push({ x: range(random, 100, MAP_W - 100), y: range(random, 120, MAP_H - 120), w: range(random, 20, 35), h: range(random, 10, 20) });

	const river: Point[] = [];
	if (random() < 0.5) {
		const ry = range(random, MAP_H * 0.35, MAP_H * 0.65);
		for (let x = 0; x <= MAP_W; x += 40) river.push({ x, y: ry + Math.sin(x / 180) * 18 });
	}

	const blocks: Block[] = [];
	for (let i = 0; i < randomInt(random, 1, 3); i++) blocks.push({ x: range(random, 50, MAP_W - 150), y: range(random, 50, MAP_H - 150), w: range(random, 120, 200), h: range(random, 120, 200) });
	const substations: Warehouse[] = [];
	for (let i = 0; i < randomInt(random, 1, 2); i++) substations.push({ x: range(random, 150, MAP_W - 150), y: range(random, 150, MAP_H - 150), w: range(random, 18, 28), h: range(random, 14, 20) });

	return { fields, woods, roads, villages, houses, barns, pylons, bridges, warehouses, bunkers, river, blocks, substations };
}
