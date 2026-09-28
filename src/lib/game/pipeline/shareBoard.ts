/*
 * Draws the final Pipeline Panic board onto the share score card: flat tiles, ink-outlined pipes,
 * oil in the flowing ones, and a red cross on broken ones.
 */
import type { Flow, PipeGrid } from './pipeGrid';
import { openings, type Direction } from './tiles';

const INK = '#111111';
const SAND = '#e8e1bc';
const KHAKI = '#7c8c5c';
const PAPER = '#ffffff';
const OIL = '#2b2f36';
const TIE_RED = '#e5484d';

const ENDS: Record<Direction, [number, number]> = {
	0: [0.5, 0],
	1: [1, 0.5],
	2: [0.5, 1],
	3: [0, 0.5]
};

export function boardDrawer(grid: PipeGrid, flow: Flow) {
	return (context: CanvasRenderingContext2D, x: number, y: number, size: number) => {
		const cell = size / Math.max(grid.rows, grid.cols);
		context.fillStyle = KHAKI;
		context.fillRect(x, y, cell * grid.cols, cell * grid.rows);

		grid.tiles.forEach((tile, index) => {
			const left = x + (index % grid.cols) * cell;
			const top = y + Math.floor(index / grid.cols) * cell;
			const inset = cell * 0.04;
			context.fillStyle = SAND;
			context.fillRect(left + inset, top + inset, cell - 2 * inset, cell - 2 * inset);

			const arms = openings(tile.kind, tile.rotation);
			const layers: [string, number][] = [
				[INK, 0.36],
				[flow.filled[index] ? OIL : PAPER, 0.24]
			];
			for (const [color, width] of layers) {
				context.strokeStyle = color;
				context.lineWidth = cell * width;
				context.lineCap = 'round';
				for (const direction of arms) {
					const [ex, ey] = ENDS[direction];
					context.beginPath();
					context.moveTo(left + cell / 2, top + cell / 2);
					context.lineTo(left + ex * cell, top + ey * cell);
					context.stroke();
				}
			}

			if (tile.broken) {
				context.strokeStyle = TIE_RED;
				context.lineWidth = cell * 0.08;
				context.beginPath();
				context.moveTo(left + cell * 0.25, top + cell * 0.25);
				context.lineTo(left + cell * 0.75, top + cell * 0.75);
				context.moveTo(left + cell * 0.75, top + cell * 0.25);
				context.lineTo(left + cell * 0.25, top + cell * 0.75);
				context.stroke();
			}
		});

		context.strokeStyle = INK;
		context.lineWidth = Math.max(4, cell * 0.08);
		context.strokeRect(x, y, cell * grid.cols, cell * grid.rows);
	};
}
