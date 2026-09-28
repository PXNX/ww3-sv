/*
 * Draws a finished Minefield board onto the share score card (see ScoreCard.drawBoard):
 * blue water, sand for revealed cells, the winning channel in white, red dots for mines.
 */
import type { Board } from './minefieldBoard';

const INK = '#111111';
const SAND = '#e8e1bc';
const WATER = '#4fa8d8';
const PAPER = '#ffffff';
const TIE_RED = '#e5484d';
const EXPLOSION = '#f5c83a';

export function drawMinefieldBoard(
	board: Board,
	channel: readonly number[] | null,
	context: CanvasRenderingContext2D,
	x: number,
	y: number,
	size: number
) {
	const cell = size / Math.max(board.columns, board.rows);
	const offsetX = x + (size - cell * board.columns) / 2;
	const offsetY = y + (size - cell * board.rows) / 2;
	const route = new Set(channel ?? []);

	context.fillStyle = INK;
	context.fillRect(offsetX, offsetY, cell * board.columns, cell * board.rows);
	context.textAlign = 'center';
	context.textBaseline = 'middle';
	context.font = `700 ${Math.round(cell * 0.55)}px 'Baloo 2', system-ui, sans-serif`;

	board.cells.forEach((current, index) => {
		const left = offsetX + (index % board.columns) * cell;
		const top = offsetY + Math.floor(index / board.columns) * cell;
		const inset = Math.max(1, cell * 0.06);
		const revealed = current.state === 'revealed';
		context.fillStyle = route.has(index) ? PAPER : revealed ? SAND : WATER;
		if (current.state === 'detonated') context.fillStyle = EXPLOSION;
		context.fillRect(left + inset, top + inset, cell - inset * 2, cell - inset * 2);

		if (current.mine || current.state === 'flagged') {
			context.fillStyle = current.state === 'flagged' && !current.mine ? PAPER : TIE_RED;
			context.beginPath();
			context.arc(left + cell / 2, top + cell / 2, cell * 0.25, 0, Math.PI * 2);
			context.fill();
			context.lineWidth = Math.max(1, cell * 0.06);
			context.strokeStyle = INK;
			context.stroke();
		} else if (revealed && current.adjacent > 0) {
			context.fillStyle = INK;
			context.fillText(String(current.adjacent), left + cell / 2, top + cell / 2 + cell * 0.04);
		}
	});
}
