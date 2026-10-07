/*
 * Random levels for Magyar's Birds, played once the fifteen prepared levels are won. A level is
 * built from a level number alone (the number seeds the generator), so retrying a level or coming
 * back to it later always gives the same fortress, and its best score stays comparable.
 *
 * Fortresses are put together from a few templates that are stable by construction: everything
 * rests flat on the piece below it and nothing overlaps. Some stand on a plateau hill, and low
 * mounds dress up the gaps. Every result is run through validateLevel; the unit tests also let
 * each level stand on its own for a few seconds of physics.
 */
import {
	createRandom,
	pickOne,
	pickWeighted,
	randomInt,
	seedFromString,
	shuffle,
	type Random
} from '../../random';
import { BIRD_KINDS, type BirdKind } from '../birds';
import { HILL_CLEARANCE_X, MAX_HILLS, type LevelHill } from '../terrain';
import {
	LANDMARKS,
	LANDMARK_KINDS,
	MAX_LEVEL_PIECES,
	MAX_SQUAD,
	MAX_WIDTH,
	MIN_STRUCTURE_X,
	MIN_WIDTH,
	pieceBounds,
	validateLevel,
	type BlockShape,
	type LevelBlock,
	type LevelData,
	type LevelDome,
	type LevelLandmark,
	type Material
} from './schema';

/** Number of the first generated level: the one after the last prepared level */
export const FIRST_GENERATED_LEVEL = 16;

/** Tries at a valid layout before the guaranteed fallback is used */
const MAX_ATTEMPTS = 12;
/** Pieces that fit in a level; the generator keeps a few in reserve */
const PIECE_BUDGET = MAX_LEVEL_PIECES - 4;
const MAX_STRUCTURES = 4;

interface Build {
	blocks: LevelBlock[];
	domes: LevelDome[];
	landmarks: LevelLandmark[];
}

interface Context {
	random: Random;
	/** How far past the prepared levels the player is, from 1 */
	depth: number;
	material: Material;
	/** Whether this structure carries a golden dome */
	dome: boolean;
}

type Template = (context: Context) => Build;

const round = (value: number): number => Math.round(value * 1000) / 1000;

function block(
	material: Material,
	shape: BlockShape,
	x: number,
	y: number,
	w: number,
	h: number
): LevelBlock {
	return { material, shape, x: round(x), y: round(y), w: round(w), h: round(h) };
}

function dome(x: number, y: number, size: number): LevelDome {
	return { x: round(x), y: round(y), size: round(size) };
}

/** Stronger materials turn up more often the deeper the player gets */
function pickMaterial(random: Random, depth: number): Material {
	return pickWeighted<Material>(random, [
		{ item: 'wood', weight: 5 },
		{ item: 'ice', weight: Math.max(1.5, 3 - depth * 0.15) },
		{ item: 'stone', weight: 1.5 + Math.min(depth, 20) * 0.25 }
	]);
}

/** Pillars and slabs: one to four floors with a roof; a dome crowns it, or sits inside it */
const house: Template = ({ random, depth, material, dome: withDome }) => {
	const span = 1.6;
	const pillarWidth = 0.4;
	const slabWidth = span + 0.4;
	const floors = randomInt(random, 1, depth >= 6 ? 5 : 4);
	const build: Build = { blocks: [], domes: [], landmarks: [] };
	let y = 0;
	for (let floor = 0; floor < floors; floor++) {
		const floorMaterial = floor === 0 ? material : pickMaterial(random, depth);
		const pillarHeight = pickOne(random, [1.2, 1.4, 1.6]);
		const shape: BlockShape = floorMaterial === 'stone' ? 'pillar' : 'box';
		build.blocks.push(
			block(floorMaterial, shape, -span / 2, y, pillarWidth, pillarHeight),
			block(floorMaterial, shape, span / 2, y, pillarWidth, pillarHeight)
		);
		y += pillarHeight;
		build.blocks.push(block(pickMaterial(random, depth), 'box', 0, y, slabWidth, 0.4));
		y += 0.4;
	}
	if (withDome) {
		build.domes.push(dome(0, y, 0.9 + random() * 0.2));
		// Sometimes a second dome hides on the ground floor, between the pillars
		if (random() < 0.5) build.domes.push(dome(0, 0, 0.8));
	} else {
		build.blocks.push(block('wood', 'spire', 0, y, 1.6, 1.2));
	}
	return build;
};

/** A heap of crates or barrels, each row one smaller than the one below it */
const pyramid: Template = ({ random, depth, material, dome: withDome }) => {
	const unit = 0.8;
	const rows = randomInt(random, 2, 5);
	const shape: BlockShape = pickOne(random, ['crate', 'barrel'] as const);
	const build: Build = { blocks: [], domes: [], landmarks: [] };
	for (let row = 0; row < rows; row++) {
		const count = rows - row;
		const rowMaterial = row === 0 ? material : pickMaterial(random, depth);
		for (let i = 0; i < count; i++) {
			build.blocks.push(
				block(rowMaterial, shape, (i - (count - 1) / 2) * unit, row * unit, unit, unit)
			);
		}
	}
	if (withDome) build.domes.push(dome(0, rows * unit, 0.7));
	else build.blocks.push(block('wood', 'spire', 0, rows * unit, unit, 0.8));
	return build;
};

/** Three columns under a roof beam, a dome in one or both cells, tires in the empty ones */
const fort: Template = ({ random, depth, material, dome: withDome }) => {
	const span = 1.4;
	const pillarWidth = 0.5;
	const height = pickOne(random, [1.8, 2, 2.2]);
	const build: Build = { blocks: [], domes: [], landmarks: [] };
	for (const x of [-span, 0, span]) {
		build.blocks.push(block(material, 'pillar', x, 0, pillarWidth, height));
	}
	build.blocks.push(
		block(pickMaterial(random, depth), 'box', 0, height, 2 * span + pillarWidth + 0.2, 0.4)
	);
	const cells = [-span / 2, span / 2];
	const domeCells = withDome ? (random() < 0.5 ? [pickOne(random, cells)] : cells) : [];
	for (const x of cells) {
		if (domeCells.includes(x)) build.domes.push(dome(x, 0, 0.7));
		else build.blocks.push(block('wood', 'tire', x, 0, 0.8, 0.8));
	}
	build.blocks.push(block('wood', 'spire', 0, height + 0.4, 1.4, 1.2));
	return build;
};

/** Two stacks of barrels carrying a long plank, a dome on top and a tire underneath */
const gate: Template = ({ random, depth, material, dome: withDome }) => {
	const unit = 0.8;
	const stack = randomInt(random, 2, 4);
	const reach = 1.6;
	const build: Build = { blocks: [], domes: [], landmarks: [] };
	for (const x of [-reach, reach]) {
		for (let level = 0; level < stack; level++) {
			build.blocks.push(block(material, 'barrel', x, level * unit, unit, unit));
		}
	}
	build.blocks.push(block(pickMaterial(random, depth), 'box', 0, stack * unit, 4, 0.4));
	build.blocks.push(block('wood', 'tire', 0, 0, 0.9, 0.9));
	if (withDome) build.domes.push(dome(0, stack * unit + 0.4, 1));
	else build.blocks.push(block('wood', 'crate', 0, stack * unit + 0.4, unit, unit));
	return build;
};

/** One of the big landmarks, sometimes with a dome on its roof and a crate stack beside it */
const landmark: Template = ({ random, material, dome: withDome }) => {
	const kind = pickOne(random, LANDMARK_KINDS);
	const spec = LANDMARKS[kind];
	const build: Build = { blocks: [], domes: [], landmarks: [{ kind, x: 0, y: 0 }] };
	// Wide landmarks carry the dome on the roof; narrow ones get it on the ground to their right
	const roofDome = spec.w >= 1.1;
	if (withDome && roofDome) build.domes.push(dome(0, spec.h, 0.8));
	else if (withDome) build.domes.push(dome(spec.w / 2 + 1, 0, 0.9));
	if (random() < 0.6) {
		const side = withDome && !roofDome ? -1 : random() < 0.5 ? -1 : 1;
		const x = side * (spec.w / 2 + 0.6);
		const crates = randomInt(random, 1, 3);
		for (let i = 0; i < crates; i++)
			build.blocks.push(block(material, 'crate', x, i * 0.8, 0.8, 0.8));
	}
	return build;
};

const TEMPLATES: readonly { template: Template; weight: number }[] = [
	{ template: house, weight: 4 },
	{ template: pyramid, weight: 2 },
	{ template: fort, weight: 3 },
	{ template: gate, weight: 2 },
	{ template: landmark, weight: 3 }
];

function pieceCount(build: Build): number {
	return build.blocks.length + build.domes.length + build.landmarks.length;
}

/** Horizontal extent of a build, and its height above the base */
function extent(build: Build): { left: number; right: number } {
	const boxes = [...build.blocks, ...build.domes, ...build.landmarks].map(pieceBounds);
	return {
		left: Math.min(...boxes.map((box) => box.left)),
		right: Math.max(...boxes.map((box) => box.right))
	};
}

function shift(build: Build, dx: number, dy: number): Build {
	return {
		blocks: build.blocks.map((b) => ({ ...b, x: round(b.x + dx), y: round(b.y + dy) })),
		domes: build.domes.map((d) => ({ ...d, x: round(d.x + dx), y: round(d.y + dy) })),
		landmarks: build.landmarks.map((l) => ({ ...l, x: round(l.x + dx), y: round(l.y + dy) }))
	};
}

/** A low mound in the free stretch [from, to], if the stretch is wide enough */
function mound(random: Random, from: number, to: number): LevelHill | null {
	const free = to - from;
	if (free < 2.4) return null;
	const w = Math.min(free, 3 + random() * 1.4);
	return {
		x: round(from + free / 2),
		w: round(w),
		h: round(0.3 + random() * 0.6),
		flat: round(w * 0.3)
	};
}

function squadFor(random: Random, domes: number): BirdKind[] {
	const size = Math.min(MAX_SQUAD, Math.max(3, 2 + domes));
	const weights = BIRD_KINDS.map((item) => ({
		item,
		weight: item === 'flamingo' || item === 'pelican' ? 3 : 2
	}));
	return Array.from({ length: size }, () => pickWeighted(random, weights));
}

function attempt(random: Random, number: number): LevelData {
	const depth = number - FIRST_GENERATED_LEVEL + 1;
	const reach = Math.min(MAX_WIDTH, 23 + randomInt(random, 0, 3) + Math.floor(depth / 4));
	const wantedStructures = Math.min(
		MAX_STRUCTURES,
		2 + randomInt(random, 0, 2) + Math.floor(depth / 8)
	);
	const withDome = new Set(
		shuffle(random, [...Array(wantedStructures).keys()]).slice(
			0,
			Math.min(wantedStructures, 1 + Math.floor(depth / 5) + randomInt(random, 0, 2))
		)
	);
	// One of the two nearest fortresses always carries a dome, so a short field never ends up without
	withDome.add(randomInt(random, 0, 2));

	const blocks: LevelBlock[] = [];
	const domes: LevelDome[] = [];
	const landmarks: LevelLandmark[] = [];
	const hills: LevelHill[] = [];
	/** Free stretches of flat ground between the slingshot, the fortresses and the field's end */
	const spans: { left: number; right: number }[] = [];
	let cursor = MIN_STRUCTURE_X + 0.4 + random() * 1.4;
	let freeFrom = HILL_CLEARANCE_X + 0.1;
	let pieces = 0;

	for (let index = 0; index < wantedStructures; index++) {
		const { template } = pickWeighted(
			random,
			TEMPLATES.map((entry) => ({ item: entry, weight: entry.weight }))
		);
		const build = template({
			random,
			depth,
			material: pickMaterial(random, depth),
			dome: withDome.has(index)
		});
		if (pieces + pieceCount(build) > PIECE_BUDGET) break;
		const { left, right } = extent(build);
		const width = right - left;

		// Some fortresses stand on a plateau; its slopes need room on both sides
		const plateau = hills.length < MAX_HILLS - 2 && random() < 0.4;
		const lift = plateau ? round(0.5 + random() * 1.1) : 0;
		const slope = plateau ? round(lift * 1.5 + 0.8) : 0;
		const pad = plateau ? 0.4 : 0;
		const footprint = width + 2 * (slope + pad);
		if (cursor + footprint > reach) break;

		const hillLeft = cursor;
		const standLeft = hillLeft + slope + pad;
		const placed = shift(build, standLeft - left, lift);
		blocks.push(...placed.blocks);
		domes.push(...placed.domes);
		landmarks.push(...placed.landmarks);
		pieces += pieceCount(build);
		if (plateau) {
			hills.push({
				x: round(hillLeft + footprint / 2),
				w: round(footprint),
				h: lift,
				flat: round(width + 2 * pad)
			});
		}
		spans.push({ left: freeFrom, right: hillLeft - 0.15 });
		freeFrom = hillLeft + footprint + 0.15;
		cursor = hillLeft + footprint + 0.5 + random() * 1.1;
	}

	// Mounds in the gaps, at the front and between the fortresses
	for (const span of spans) {
		if (hills.length >= MAX_HILLS || random() > 0.65) continue;
		const hill = mound(random, span.left, span.right);
		if (hill) hills.push(hill);
	}
	hills.sort((a, b) => a.x - b.x);

	const right = Math.max(
		...[...blocks, ...domes, ...landmarks].map((piece) => pieceBounds(piece).right),
		...hills.map((hill) => hill.x + hill.w / 2)
	);
	return {
		version: 1,
		id: `level-${String(number).padStart(2, '0')}`,
		width: Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.ceil(right + 1.2))),
		birds: squadFor(random, domes.length),
		blocks,
		domes,
		landmarks,
		hills
	};
}

/** Used if no random layout passes validation: a plain house and a dome, always valid */
function fallback(number: number): LevelData {
	return {
		version: 1,
		id: `level-${String(number).padStart(2, '0')}`,
		width: 22,
		birds: ['flamingo', 'pelican', 'stork', 'goose'],
		blocks: [
			block('wood', 'box', 13.2, 0, 0.4, 1.4),
			block('wood', 'box', 14.8, 0, 0.4, 1.4),
			block('wood', 'box', 14, 1.4, 2, 0.4)
		],
		domes: [dome(14, 1.8, 1)],
		landmarks: [],
		hills: []
	};
}

/** The generated level with the given number (16 and up); the same number always gives the same level */
export function generateLevel(number: number): LevelData {
	const random = createRandom(seedFromString(`fury:level:${number}`));
	for (let tries = 0; tries < MAX_ATTEMPTS; tries++) {
		const level = attempt(random, number);
		if (level.domes.length === 0) continue;
		const result = validateLevel(level);
		if (result.ok) return result.level;
	}
	return fallback(number);
}
