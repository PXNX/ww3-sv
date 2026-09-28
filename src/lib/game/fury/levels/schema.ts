/*
 * Level data format for Feathered Fury. Levels are hand-authored JSON files in this folder; every
 * file carries a version number so the format can change later without breaking old files.
 * Coordinates are in meters: x is the horizontal center of a piece, y is its bottom edge, and the
 * ground is at y = 0. The slingshot stands at x = 3.
 */
import { isBirdKind, type BirdKind } from '../birds';

export const LEVEL_VERSION = 1;

export type Material = 'wood' | 'stone' | 'ice';
export const MATERIAL_KINDS: readonly Material[] = ['wood', 'stone', 'ice'];

/**
 * box: plain block; crate and barrel: boxes drawn as a crate or an oil barrel;
 * spire: a pointed tower roof (triangle); ball: a round block (w is the diameter, h must equal w)
 */
export type BlockShape = 'box' | 'crate' | 'barrel' | 'spire' | 'ball';
export const BLOCK_SHAPES: readonly BlockShape[] = ['box', 'crate', 'barrel', 'spire', 'ball'];

export interface LevelBlock {
	material: Material;
	shape: BlockShape;
	x: number;
	y: number;
	w: number;
	h: number;
}

/** A golden onion dome, the target: x is its center, y its base, size its width */
export interface LevelDome {
	x: number;
	y: number;
	size: number;
}

export interface LevelData {
	version: typeof LEVEL_VERSION;
	/** level-01 to level-15 */
	id: string;
	/** Width of the playing field in meters; the camera fits it */
	width: number;
	/** The bird squad, launched in this order */
	birds: BirdKind[];
	blocks: LevelBlock[];
	domes: LevelDome[];
}

/** Performance budget: blocks plus domes per level (birds come on top, at most three at a time) */
export const MAX_LEVEL_PIECES = 60;
export const MAX_SQUAD = 6;
export const MIN_WIDTH = 18;
export const MAX_WIDTH = 30;
/** Structures must keep this distance from the slingshot */
export const MIN_STRUCTURE_X = 8;
/** Height of a dome's body relative to its width (the finial on top is decoration only) */
export const DOME_HEIGHT_RATIO = 1.1;

export type LevelValidation = { ok: true; level: LevelData } | { ok: false; errors: string[] };

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const isNumber = (value: unknown): value is number =>
	typeof value === 'number' && Number.isFinite(value);

interface Bounds {
	label: string;
	left: number;
	right: number;
	bottom: number;
	top: number;
}

/** Axis-aligned bounds of a piece; used for the overlap and placement checks */
export function pieceBounds(piece: LevelBlock | LevelDome): Omit<Bounds, 'label'> {
	if ('size' in piece) {
		return {
			left: piece.x - piece.size / 2,
			right: piece.x + piece.size / 2,
			bottom: piece.y,
			top: piece.y + piece.size * DOME_HEIGHT_RATIO
		};
	}
	return {
		left: piece.x - piece.w / 2,
		right: piece.x + piece.w / 2,
		bottom: piece.y,
		top: piece.y + piece.h
	};
}

/** Pieces may touch but must not overlap by more than this */
const OVERLAP_TOLERANCE = 0.005;

function overlaps(a: Bounds, b: Bounds): boolean {
	return (
		Math.min(a.right, b.right) - Math.max(a.left, b.left) > OVERLAP_TOLERANCE &&
		Math.min(a.top, b.top) - Math.max(a.bottom, b.bottom) > OVERLAP_TOLERANCE
	);
}

function validateBlock(value: unknown, index: number, errors: string[]): LevelBlock | null {
	const label = `blocks[${index}]`;
	if (!isRecord(value)) {
		errors.push(`${label} is not an object`);
		return null;
	}
	const { material, shape, x, y, w, h } = value;
	if (!MATERIAL_KINDS.includes(material as Material)) errors.push(`${label}.material is invalid`);
	if (!BLOCK_SHAPES.includes(shape as BlockShape)) errors.push(`${label}.shape is invalid`);
	if (![x, y, w, h].every(isNumber)) {
		errors.push(`${label} needs numeric x, y, w and h`);
		return null;
	}
	const size = { w: w as number, h: h as number };
	if (size.w < 0.2 || size.w > 8 || size.h < 0.2 || size.h > 8) {
		errors.push(`${label} size must be between 0.2 and 8 meters`);
	}
	if (shape === 'ball' && Math.abs(size.w - size.h) > 1e-9) {
		errors.push(`${label} is a ball, so w and h must be equal`);
	}
	return {
		material: material as Material,
		shape: shape as BlockShape,
		x: x as number,
		y: y as number,
		...size
	};
}

function validateDome(value: unknown, index: number, errors: string[]): LevelDome | null {
	const label = `domes[${index}]`;
	if (!isRecord(value) || ![value.x, value.y, value.size].every(isNumber)) {
		errors.push(`${label} needs numeric x, y and size`);
		return null;
	}
	const dome = { x: value.x as number, y: value.y as number, size: value.size as number };
	if (dome.size < 0.6 || dome.size > 2.5) errors.push(`${label}.size must be 0.6 to 2.5 meters`);
	return dome;
}

/** Checks untrusted level data (a parsed JSON file) and returns either the level or all problems */
export function validateLevel(data: unknown): LevelValidation {
	const errors: string[] = [];
	if (!isRecord(data)) return { ok: false, errors: ['level is not an object'] };

	if (data.version !== LEVEL_VERSION) errors.push(`version must be ${LEVEL_VERSION}`);
	if (typeof data.id !== 'string' || !/^level-\d{2}$/.test(data.id)) {
		errors.push('id must look like level-01');
	}
	const width = data.width;
	if (!isNumber(width) || width < MIN_WIDTH || width > MAX_WIDTH) {
		errors.push(`width must be between ${MIN_WIDTH} and ${MAX_WIDTH}`);
	}

	const birds = Array.isArray(data.birds) ? data.birds : [];
	if (birds.length === 0) errors.push('the bird squad is empty');
	if (birds.length > MAX_SQUAD) errors.push(`the bird squad has more than ${MAX_SQUAD} birds`);
	if (!birds.every(isBirdKind)) errors.push('the bird squad contains an unknown bird');

	const rawBlocks = Array.isArray(data.blocks) ? data.blocks : null;
	const rawDomes = Array.isArray(data.domes) ? data.domes : null;
	if (!rawBlocks) errors.push('blocks must be a list');
	if (!rawDomes || rawDomes.length === 0) errors.push('a level needs at least one golden dome');

	const blocks = (rawBlocks ?? []).map((block, index) => validateBlock(block, index, errors));
	const domes = (rawDomes ?? []).map((dome, index) => validateDome(dome, index, errors));
	if (blocks.length + domes.length > MAX_LEVEL_PIECES) {
		errors.push(`blocks plus domes exceed the limit of ${MAX_LEVEL_PIECES}`);
	}

	// Placement: inside the field, on or above the ground, and no two pieces overlapping
	const bounds: Bounds[] = [];
	blocks.forEach((block, index) => {
		if (block) bounds.push({ label: `blocks[${index}]`, ...pieceBounds(block) });
	});
	domes.forEach((dome, index) => {
		if (dome) bounds.push({ label: `domes[${index}]`, ...pieceBounds(dome) });
	});
	for (const box of bounds) {
		if (box.bottom < -1e-9) errors.push(`${box.label} is below the ground`);
		if (box.left < MIN_STRUCTURE_X - 1e-9)
			errors.push(`${box.label} is too close to the slingshot`);
		if (isNumber(width) && box.right > width + 1e-9)
			errors.push(`${box.label} is outside the field`);
	}
	for (let i = 0; i < bounds.length; i++) {
		for (let j = i + 1; j < bounds.length; j++) {
			if (overlaps(bounds[i], bounds[j])) {
				errors.push(`${bounds[i].label} overlaps ${bounds[j].label}`);
			}
		}
	}

	if (errors.length > 0) return { ok: false, errors };
	return {
		ok: true,
		level: {
			version: LEVEL_VERSION,
			id: data.id as string,
			width: width as number,
			birds: birds as BirdKind[],
			blocks: blocks as LevelBlock[],
			domes: domes as LevelDome[]
		}
	};
}
