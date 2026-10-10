/*
 * Draws a finished Bureaucracy Maze onto the share score card (see ScoreCard.drawBoard): the
 * whole floor plan with the offices walked through, the closed offices striped, locked doors in
 * the color of their document and the goal counter in gold.
 */
import { ITEM_COLORS } from './items';
import { DIRECTIONS, colOf, neighbour, rowOf, type Maze } from './maze';

const INK = '#111111';
const SAND = '#e8e1bc';
const PAPER = '#ffffff';
const TIE_RED = '#e5484d';

export function drawMazeBoard(
	maze: Maze,
	visited: readonly boolean[],
	context: CanvasRenderingContext2D,
	x: number,
	y: number,
	size: number
) {
	const cell = size / Math.max(maze.width, maze.height);
	const left = x + (size - cell * maze.width) / 2;
	const top = y + (size - cell * maze.height) / 2;

	context.fillStyle = SAND;
	context.fillRect(left, top, cell * maze.width, cell * maze.height);

	for (let room = 0; room < maze.width * maze.height; room++) {
		const rx = left + colOf(maze, room) * cell;
		const ry = top + rowOf(maze, room) * cell;
		if (visited[room]) {
			context.fillStyle = PAPER;
			context.fillRect(rx, ry, cell, cell);
		}
		if (maze.closed.includes(room)) {
			context.fillStyle = TIE_RED;
			context.globalAlpha = 0.45;
			context.fillRect(rx, ry, cell, cell);
			context.globalAlpha = 1;
		}
		if (room === maze.goal) {
			context.fillStyle = ITEM_COLORS.permit;
			context.fillRect(rx + cell * 0.15, ry + cell * 0.15, cell * 0.7, cell * 0.7);
		}
	}

	context.lineCap = 'round';
	for (let room = 0; room < maze.width * maze.height; room++) {
		const rx = left + colOf(maze, room) * cell;
		const ry = top + rowOf(maze, room) * cell;
		DIRECTIONS.forEach((direction, index) => {
			const door = maze.doors[room][index];
			const other = neighbour(maze, room, direction);
			// Each edge once: from the lower room, or from the only room that has it
			if (other !== null && other < room) return;
			const [x1, y1, x2, y2] =
				direction === 'up'
					? [rx, ry, rx + cell, ry]
					: direction === 'right'
						? [rx + cell, ry, rx + cell, ry + cell]
						: direction === 'down'
							? [rx, ry + cell, rx + cell, ry + cell]
							: [rx, ry, rx, ry + cell];
			if (!door) {
				context.strokeStyle = INK;
				context.lineWidth = Math.max(2, cell * 0.12);
			} else if (door.lock) {
				context.strokeStyle = ITEM_COLORS[door.lock];
				context.lineWidth = Math.max(3, cell * 0.2);
			} else {
				return;
			}
			context.beginPath();
			context.moveTo(x1, y1);
			context.lineTo(x2, y2);
			context.stroke();
		});
	}

	context.lineWidth = 4;
	context.strokeStyle = INK;
	context.strokeRect(left, top, cell * maze.width, cell * maze.height);
}
