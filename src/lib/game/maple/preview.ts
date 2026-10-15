/*
 * Draws the warehouse as a flat cartoon onto the shared score card: shelves, the truck, barrels
 * still on the floor, the cart and the moose. Colours match the field component.
 */
import { guardCell, type GameState } from './state.js';

const INK = '#111111';
const FLOOR = '#e8e1bc';
const SHELF = '#8a5a2b';
const TRUCK = '#e5484d';
const MAPLE = '#c8791a';
const MOOSE = '#6b4423';
const CART = '#4a78c8';

export function drawWarehousePreview(
	context: CanvasRenderingContext2D,
	state: GameState,
	x: number,
	y: number,
	size: number
) {
	const { level } = state;
	const cell = size / Math.max(level.width, level.height);
	const left = x + (size - cell * level.width) / 2;
	const top = y + (size - cell * level.height) / 2;
	const at = (row: number, col: number) => [left + col * cell, top + row * cell] as const;
	const pad = cell * 0.14;

	context.fillStyle = FLOOR;
	context.fillRect(left, top, cell * level.width, cell * level.height);
	context.fillStyle = SHELF;
	level.walls.forEach((line, row) =>
		line.forEach((wall, col) => {
			if (wall) context.fillRect(...at(row, col), cell, cell);
		})
	);

	const [truckX, truckY] = at(level.truck.row, level.truck.col);
	context.fillStyle = TRUCK;
	context.fillRect(truckX + pad, truckY + pad, cell - pad * 2, cell - pad * 2);

	context.lineWidth = Math.max(2, cell * 0.06);
	context.strokeStyle = INK;
	level.barrels.forEach((barrel, index) => {
		if (state.barrels[index] !== 'floor') return;
		const [barrelX, barrelY] = at(barrel.row, barrel.col);
		context.fillStyle = MAPLE;
		context.beginPath();
		context.arc(barrelX + cell / 2, barrelY + cell / 2, cell * 0.32, 0, Math.PI * 2);
		context.fill();
		context.stroke();
	});

	context.fillStyle = CART;
	for (const part of state.cart) {
		const [partX, partY] = at(part.row, part.col);
		context.fillRect(partX + pad, partY + pad, cell - pad * 2, cell - pad * 2);
		context.strokeRect(partX + pad, partY + pad, cell - pad * 2, cell - pad * 2);
	}

	context.fillStyle = MOOSE;
	level.guards.forEach((_guard, guard) => {
		const { row, col } = guardCell(state, guard);
		const [guardX, guardY] = at(row, col);
		context.beginPath();
		context.arc(guardX + cell / 2, guardY + cell / 2, cell * 0.36, 0, Math.PI * 2);
		context.fill();
		context.stroke();
	});

	context.lineWidth = Math.max(4, cell * 0.12);
	context.strokeRect(left, top, cell * level.width, cell * level.height);
}
