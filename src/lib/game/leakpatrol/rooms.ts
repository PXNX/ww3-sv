/* The rooms of the West Wing cross-section: ids for the texts, and their place on the grid */
import { ROOM_COLUMNS, ROOM_COUNT } from './config.js';

export const ROOMS = ['oval', 'press', 'situation', 'cabinet', 'kitchen', 'garden'] as const;
export type RoomId = (typeof ROOMS)[number];

/** Grid column and row of a room, both counted from 0 */
export function roomCell(index: number): { column: number; row: number } {
	return { column: index % ROOM_COLUMNS, row: Math.floor(index / ROOM_COLUMNS) };
}

/** The keyboard key of a room: the digits 1 to 6 */
export function roomKey(index: number): string {
	return String(index + 1);
}

/** The room a digit key belongs to, or -1 */
export function roomOfKey(code: string): number {
	const match = /^(?:Digit|Numpad)([1-9])$/.exec(code);
	if (!match) return -1;
	const index = Number(match[1]) - 1;
	return index < ROOM_COUNT ? index : -1;
}

/** Rooms sharing a wall with this one (up, down, left, right on the cross-section grid) */
export function adjacentRooms(index: number): number[] {
	const { column, row } = roomCell(index);
	const neighbours: number[] = [];
	for (const [dc, dr] of [
		[1, 0],
		[-1, 0],
		[0, 1],
		[0, -1]
	]) {
		const c = column + dc;
		const r = row + dr;
		if (c < 0 || c >= ROOM_COLUMNS || r < 0) continue;
		const other = r * ROOM_COLUMNS + c;
		if (other < ROOM_COUNT) neighbours.push(other);
	}
	return neighbours;
}
