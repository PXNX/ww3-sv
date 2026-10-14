import { describe, expect, it } from 'vitest';
import { ROOM_COUNT } from './config.js';
import { ROOMS, roomCell, roomKey, roomOfKey } from './rooms.js';

describe('rooms', () => {
	it('has one id per room', () => {
		expect(ROOMS).toHaveLength(ROOM_COUNT);
		expect(new Set(ROOMS).size).toBe(ROOM_COUNT);
	});

	it('lays the rooms out row by row', () => {
		expect(roomCell(0)).toEqual({ column: 0, row: 0 });
		expect(roomCell(2)).toEqual({ column: 2, row: 0 });
		expect(roomCell(3)).toEqual({ column: 0, row: 1 });
		expect(roomCell(5)).toEqual({ column: 2, row: 1 });
	});

	it('maps digit keys to rooms and back', () => {
		for (let i = 0; i < ROOM_COUNT; i++) {
			expect(roomOfKey(`Digit${roomKey(i)}`)).toBe(i);
			expect(roomOfKey(`Numpad${roomKey(i)}`)).toBe(i);
		}
		expect(roomOfKey('Digit7')).toBe(-1);
		expect(roomOfKey('Digit0')).toBe(-1);
		expect(roomOfKey('KeyA')).toBe(-1);
	});
});
