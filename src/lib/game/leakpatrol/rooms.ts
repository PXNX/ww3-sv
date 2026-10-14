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
