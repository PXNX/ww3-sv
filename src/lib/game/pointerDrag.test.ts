import { describe, expect, it, vi } from 'vitest';
import {
	PointerDrag,
	cellAt,
	clamp,
	clampToBounds,
	clientToLocal,
	followPointer,
	grabOffset,
	type PointerDragOptions
} from './pointerDrag';

function pointer(
	type: string,
	x: number,
	y: number,
	extra: Partial<{
		pointerId: number;
		isPrimary: boolean;
		pointerType: string;
		button: number;
	}> = {}
) {
	return {
		type,
		clientX: x,
		clientY: y,
		pointerId: 1,
		isPrimary: true,
		pointerType: 'touch',
		button: 0,
		...extra
	} as unknown as PointerEvent;
}

describe('grab offset math', () => {
	it('stores piece minus pointer and reproduces the piece position under no movement', () => {
		const piece = { x: 120, y: 300 };
		const down = { x: 130, y: 320 };
		const offset = grabOffset(piece, down);
		expect(offset).toEqual({ x: -10, y: -20 });
		expect(followPointer(down, offset)).toEqual(piece);
	});

	it('moves the piece by exactly the pointer movement, with no easing', () => {
		const offset = grabOffset({ x: 50, y: 50 }, { x: 60, y: 45 });
		for (const move of [
			{ x: 61, y: 45 },
			{ x: 200, y: -30 },
			{ x: 0, y: 0 }
		]) {
			expect(followPointer(move, offset)).toEqual({ x: move.x - 10, y: move.y + 5 });
		}
	});
});

describe('clamping', () => {
	it('keeps a value inside the range', () => {
		expect(clamp(5, 0, 10)).toBe(5);
		expect(clamp(-3, 0, 10)).toBe(0);
		expect(clamp(42, 0, 10)).toBe(10);
	});

	it('collapses an inverted range to its minimum instead of flipping', () => {
		expect(clamp(5, 3, 1)).toBe(3);
	});

	it('clamps both axes of a point', () => {
		const bounds = { minX: 0, maxX: 100, minY: 10, maxY: 50 };
		expect(clampToBounds({ x: -20, y: 80 }, bounds)).toEqual({ x: 0, y: 50 });
		expect(clampToBounds({ x: 40, y: 20 }, bounds)).toEqual({ x: 40, y: 20 });
	});
});

describe('rect conversion', () => {
	const rect = { left: 100, top: 40, width: 200, height: 400 };

	it('is relative to the rect corner in CSS pixels', () => {
		expect(clientToLocal(rect, { x: 150, y: 140 })).toEqual({ x: 50, y: 100 });
	});

	it('scales into logical units, so a CSS-scaled playfield maps correctly', () => {
		// A 5.5 by 6 unit field drawn at 200 by 400 pixels
		const local = clientToLocal(rect, { x: 200, y: 240 }, { width: 5.5, height: 6 });
		expect(local.x).toBeCloseTo(2.75);
		expect(local.y).toBeCloseTo(3);
	});

	it('follows the rect when the page is scaled or scrolled (rect values change, math does not)', () => {
		const half = { left: 10, top: 10, width: 100, height: 200 };
		const logical = { width: 5.5, height: 6 };
		const a = clientToLocal(rect, { x: 200, y: 240 }, logical);
		const b = clientToLocal(half, { x: 60, y: 110 }, logical);
		expect(b.x).toBeCloseTo(a.x);
		expect(b.y).toBeCloseTo(a.y);
	});

	it('uses the physical left edge, which is what a right-to-left page reports too', () => {
		// In an RTL layout the board can sit anywhere; only the physical rect matters
		const board = { left: 0, top: 0, width: 160, height: 160 };
		expect(cellAt(board, { x: 5, y: 5 }, 8)).toEqual({ row: 0, col: 0 });
		expect(cellAt(board, { x: 155, y: 5 }, 8)).toEqual({ row: 0, col: 7 });
	});

	it('finds the cell under a point and rejects points outside', () => {
		const board = { left: 10, top: 10, width: 80, height: 80 };
		expect(cellAt(board, { x: 10, y: 10 }, 8)).toEqual({ row: 0, col: 0 });
		expect(cellAt(board, { x: 35, y: 85 }, 8)).toEqual({ row: 7, col: 2 });
		expect(cellAt(board, { x: 9, y: 50 }, 8)).toBeNull();
		expect(cellAt(board, { x: 90, y: 50 }, 8)).toBeNull();
		expect(cellAt({ ...board, width: 0 }, { x: 10, y: 10 }, 8)).toBeNull();
	});
});

describe('PointerDrag', () => {
	function setup(options: PointerDragOptions = {}) {
		const log = {
			start: vi.fn(),
			move: vi.fn(),
			end: vi.fn(),
			tap: vi.fn(),
			cancel: vi.fn()
		};
		const drag = new PointerDrag({
			onStart: log.start,
			onMove: log.move,
			onEnd: log.end,
			onTap: log.tap,
			onCancel: log.cancel,
			...options
		});
		return { drag, log };
	}

	it('keeps the grab offset for the whole drag', () => {
		const { drag, log } = setup();
		drag.begin(pointer('pointerdown', 110, 210), { origin: { x: 100, y: 200 } });
		expect(log.start).toHaveBeenCalledTimes(1);
		drag.pointerMove(pointer('pointermove', 160, 260));
		expect(drag.session?.position).toEqual({ x: 150, y: 250 });
		drag.pointerMove(pointer('pointermove', 20, 5));
		expect(drag.session?.position).toEqual({ x: 10, y: -5 });
		drag.pointerUp(pointer('pointerup', 30, 40));
		expect(log.end).toHaveBeenCalledTimes(1);
		expect(log.end.mock.calls[0][0].position).toEqual({ x: 20, y: 30 });
		expect(drag.active).toBe(false);
	});

	it('passes the position through constrain', () => {
		const { drag } = setup({
			constrain: (position) => clampToBounds(position, { minX: 0, maxX: 100, minY: 0, maxY: 100 })
		});
		drag.begin(pointer('pointerdown', 50, 50), { origin: { x: 40, y: 50 } });
		drag.pointerMove(pointer('pointermove', 500, -500));
		expect(drag.session?.position).toEqual({ x: 100, y: 0 });
		// Leaving the bounds and coming back is still 1:1 relative to the pointer
		drag.pointerMove(pointer('pointermove', 80, 70));
		expect(drag.session?.position).toEqual({ x: 70, y: 70 });
	});

	it('waits for the threshold before it becomes a drag, and reports a plain tap otherwise', () => {
		const { drag, log } = setup({ threshold: 6 });
		drag.begin(pointer('pointerdown', 0, 0));
		expect(drag.pointerMove(pointer('pointermove', 3, 3))).toBe(false);
		expect(log.start).not.toHaveBeenCalled();
		drag.pointerUp(pointer('pointerup', 3, 3));
		expect(log.tap).toHaveBeenCalledTimes(1);
		expect(log.end).not.toHaveBeenCalled();

		drag.begin(pointer('pointerdown', 0, 0));
		drag.pointerMove(pointer('pointermove', 20, 0));
		expect(log.start).toHaveBeenCalledTimes(1);
		expect(drag.dragging).toBe(true);
	});

	it('ignores secondary pointers and other mouse buttons', () => {
		const { drag } = setup();
		expect(drag.begin(pointer('pointerdown', 0, 0, { isPrimary: false }))).toBe(false);
		expect(drag.begin(pointer('pointerdown', 0, 0, { pointerType: 'mouse', button: 2 }))).toBe(
			false
		);
		expect(drag.begin(pointer('pointerdown', 0, 0, { pointerId: 1 }))).toBe(true);
		// A second finger neither restarts nor disturbs the drag
		expect(drag.begin(pointer('pointerdown', 90, 90, { pointerId: 2 }))).toBe(false);
		expect(drag.pointerMove(pointer('pointermove', 50, 50, { pointerId: 2 }))).toBe(false);
		expect(drag.pointerUp(pointer('pointerup', 50, 50, { pointerId: 2 }))).toBe(false);
		expect(drag.session?.pointerId).toBe(1);
		expect(drag.session?.pointer).toEqual({ x: 0, y: 0 });
	});

	it('cancels on pointercancel without reporting a drop', () => {
		const { drag, log } = setup();
		drag.begin(pointer('pointerdown', 0, 0));
		drag.pointerMove(pointer('pointermove', 30, 30));
		expect(drag.pointerCancel(pointer('pointercancel', 30, 30))).toBe(true);
		expect(log.cancel).toHaveBeenCalledTimes(1);
		expect(log.end).not.toHaveBeenCalled();
		expect(drag.active).toBe(false);
		// Late events from the cancelled pointer are ignored
		expect(drag.pointerUp(pointer('pointerup', 30, 30))).toBe(false);
	});

	it('captures the pointer and releases it when the drag ends', () => {
		const element = {
			setPointerCapture: vi.fn(),
			releasePointerCapture: vi.fn(),
			hasPointerCapture: vi.fn(() => true)
		};
		const { drag } = setup();
		drag.begin(pointer('pointerdown', 0, 0, { pointerId: 7 }), {
			capture: element as unknown as Element
		});
		expect(element.setPointerCapture).toHaveBeenCalledWith(7);
		drag.pointerUp(pointer('pointerup', 0, 0, { pointerId: 7 }));
		expect(element.releasePointerCapture).toHaveBeenCalledWith(7);
	});

	it('still works when the pointer cannot be captured', () => {
		const element = {
			setPointerCapture: () => {
				throw new Error('NotFoundError');
			}
		};
		const { drag } = setup();
		expect(
			drag.begin(pointer('pointerdown', 0, 0), { capture: element as unknown as Element })
		).toBe(true);
	});

	it('can re-measure the grab offset mid-drag', () => {
		const { drag } = setup();
		drag.begin(pointer('pointerdown', 100, 100), { origin: { x: 90, y: 100 } });
		drag.pointerMove(pointer('pointermove', 120, 100));
		expect(drag.session?.position.x).toBe(110);
		drag.regrab({ x: 200, y: 100 });
		expect(drag.session?.position.x).toBe(200);
		drag.pointerMove(pointer('pointermove', 130, 100));
		expect(drag.session?.position.x).toBe(210);
	});
});
