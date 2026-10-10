/*
 * Level generation helpers, used by scripts/generate-beltroad-levels.ts (the levels themselves are
 * committed as JSON; nothing here runs in the game). A solved board comes first: a random
 * Hamiltonian path through the grid ("backbite" moves on a snake) cut into one route per pair. The
 * route ends become the ports, so every generated puzzle has at least one solution by construction.
 */
import { randomInt, type Random } from '../random';
import { adjacent, type Cell } from './board';

/** A path through every cell of the grid, starting from the usual back-and-forth snake */
export function randomHamiltonianPath(width: number, height: number, random: Random): Cell[] {
	let path: Cell[] = [];
	for (let row = 0; row < height; row++) {
		for (let step = 0; step < width; step++) {
			path.push([row, row % 2 === 0 ? step : width - 1 - step]);
		}
	}
	const at = (cell: Cell) => path.findIndex((item) => item[0] === cell[0] && item[1] === cell[1]);
	const rounds = width * height * 30;
	for (let round = 0; round < rounds; round++) {
		const fromHead = random() < 0.5;
		const end = fromHead ? path[0] : path[path.length - 1];
		const options: Cell[] = [
			[end[0] - 1, end[1]],
			[end[0] + 1, end[1]],
			[end[0], end[1] - 1],
			[end[0], end[1] + 1]
		].filter(
			(cell): cell is [number, number] =>
				cell[0] >= 0 && cell[1] >= 0 && cell[0] < height && cell[1] < width
		);
		const next = options[randomInt(random, 0, options.length)];
		const index = at(next);
		if (fromHead) {
			// Reverse everything before the neighbor: the head joins it and the cell before it leads
			if (index > 1) path = [...path.slice(0, index).reverse(), ...path.slice(index)];
		} else if (index < path.length - 2) {
			path = [...path.slice(0, index + 1), ...path.slice(index + 1).reverse()];
		}
	}
	return path;
}

/** Splits a path into `parts` consecutive pieces of at least `minLength` cells each */
export function randomCut(
	path: readonly Cell[],
	parts: number,
	minLength: number,
	random: Random
): Cell[][] {
	if (parts * minLength > path.length) throw new Error('The path is too short for that many parts');
	const lengths = Array.from({ length: parts }, () => minLength);
	for (let spare = path.length - parts * minLength; spare > 0; spare--) {
		lengths[randomInt(random, 0, parts)]++;
	}
	const pieces: Cell[][] = [];
	let from = 0;
	for (const length of lengths) {
		pieces.push(path.slice(from, from + length));
		from += length;
	}
	return pieces;
}

/** Whether every consecutive pair of cells in a route touches (a self-check for the generator) */
export function isRoute(cells: readonly Cell[]): boolean {
	return cells.every((cell, index) => index === 0 || adjacent(cells[index - 1], cell));
}
