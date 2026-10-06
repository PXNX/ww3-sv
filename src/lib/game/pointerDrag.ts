/*
 * Shared direct-manipulation drag helper (roadmap 1.1 and 1.3). The dragged thing stays exactly
 * where it was grabbed: on press the grab offset (offset = thing.pos - pointer.pos) is stored, and
 * on every move thing.pos = pointer.pos + offset, with no easing, velocity or lag.
 *
 * Two layers:
 *  - pure math (grabOffset, followPointer, clamp, clientToLocal, cellAt) that works on plain
 *    numbers and rects, so it is unit tested without a DOM;
 *  - PointerDrag, a small controller around Pointer Events: it ignores secondary pointers, captures
 *    the pointer, handles pointercancel, and reports one session object to its callbacks. It has no
 *    framework dependency; callers copy what they need into their own state ($state in Svelte).
 *
 * Coordinates: everything the controller reports is in client (viewport) pixels. Convert to the
 * playfield with clientToLocal, which uses getBoundingClientRect() values and therefore stays right
 * under CSS scaling and in right-to-left pages (rect.left is always physical, and playfields are
 * kept left-to-right).
 */

export interface Point {
	x: number;
	y: number;
}

export interface Size {
	width: number;
	height: number;
}

/** The shape of a DOMRect that matters here, so tests and callers can pass plain objects */
export interface Rect extends Size {
	left: number;
	top: number;
}

export interface Bounds {
	minX: number;
	maxX: number;
	minY: number;
	maxY: number;
}

export function clamp(value: number, min: number, max: number): number {
	// A degenerate range (min > max) collapses to min instead of flipping around
	return Math.min(Math.max(value, min), Math.max(min, max));
}

export function clampToBounds(point: Point, bounds: Bounds): Point {
	return {
		x: clamp(point.x, bounds.minX, bounds.maxX),
		y: clamp(point.y, bounds.minY, bounds.maxY)
	};
}

/** offset = piece.pos - pointer.pos, measured once when the piece is grabbed */
export function grabOffset(piece: Point, pointer: Point): Point {
	return { x: piece.x - pointer.x, y: piece.y - pointer.y };
}

/** piece.pos = pointer.pos + offset: the piece is exactly where it was grabbed */
export function followPointer(pointer: Point, offset: Point): Point {
	return { x: pointer.x + offset.x, y: pointer.y + offset.y };
}

/**
 * A viewport point in the local coordinates of a rect. Without a size the result is in CSS pixels
 * from the rect's top-left corner. With a size (the logical width and height the rect displays) it
 * is in those logical units, so a canvas scaled by CSS or a transformed board maps correctly.
 */
export function clientToLocal(rect: Rect, client: Point, size?: Size): Point {
	const scaleX = size && rect.width > 0 ? size.width / rect.width : 1;
	const scaleY = size && rect.height > 0 ? size.height / rect.height : 1;
	return { x: (client.x - rect.left) * scaleX, y: (client.y - rect.top) * scaleY };
}

/** Which cell of an evenly divided rect a viewport point is over, or null outside of it */
export function cellAt(
	rect: Rect,
	client: Point,
	columns: number,
	rows: number = columns
): { row: number; col: number } | null {
	if (rect.width <= 0 || rect.height <= 0) return null;
	const col = Math.floor(((client.x - rect.left) / rect.width) * columns);
	const row = Math.floor(((client.y - rect.top) / rect.height) * rows);
	if (row < 0 || col < 0 || row >= rows || col >= columns) return null;
	return { row, col };
}

export interface DragSession {
	pointerId: number;
	pointerType: string;
	/** Where the press happened, in client pixels */
	start: Point;
	/** Where the pointer is now, in client pixels */
	pointer: Point;
	/** piece.pos - pointer.pos, fixed at the press (see grabOffset) */
	offset: Point;
	/** Where the dragged thing is now: pointer + offset, passed through constrain when given */
	position: Point;
	/** False until the press has moved past the threshold; always true with a threshold of 0 */
	dragging: boolean;
	/** Straight-line distance from the press to the pointer */
	travelled: number;
}

export interface PointerDragOptions {
	/** Pixels a press has to move before it counts as a drag (default 0: starts on press) */
	threshold?: number;
	/** The press turned into a drag (immediately when the threshold is 0) */
	onStart?: (session: DragSession) => void;
	onMove?: (session: DragSession) => void;
	/** The pointer was released after a drag */
	onEnd?: (session: DragSession) => void;
	/** The pointer was released without ever passing the threshold */
	onTap?: (session: DragSession) => void;
	/** The browser took the pointer away (pointercancel) or abort() was called mid-drag */
	onCancel?: (session: DragSession) => void;
	/** Limits where the dragged thing may go, in client pixels */
	constrain?: (position: Point) => Point;
}

export interface BeginOptions {
	/** Where the dragged thing is right now, in client pixels; defaults to the pointer (no offset) */
	origin?: Point;
	/** Element that should capture the pointer so moves keep arriving outside it */
	capture?: Element | null;
}

export class PointerDrag {
	#options: PointerDragOptions;
	#session: DragSession | null = null;
	#captured: Element | null = null;

	constructor(options: PointerDragOptions = {}) {
		this.#options = options;
	}

	/** The press or drag in progress, if any */
	get session(): DragSession | null {
		return this.#session;
	}

	get active(): boolean {
		return this.#session !== null;
	}

	get dragging(): boolean {
		return this.#session?.dragging ?? false;
	}

	/**
	 * Starts tracking a press. Returns false, and changes nothing, for a secondary pointer (a second
	 * finger), a non-primary mouse button, or while another pointer is already being tracked.
	 */
	begin(event: PointerEvent, { origin, capture }: BeginOptions = {}): boolean {
		if (this.#session || !event.isPrimary) return false;
		if (event.pointerType === 'mouse' && event.button !== 0) return false;
		const pointer = { x: event.clientX, y: event.clientY };
		const offset = origin ? grabOffset(origin, pointer) : { x: 0, y: 0 };
		this.#session = {
			pointerId: event.pointerId,
			pointerType: event.pointerType,
			start: pointer,
			pointer,
			offset,
			position: this.#place(pointer, offset),
			dragging: false,
			travelled: 0
		};
		if (capture) {
			try {
				capture.setPointerCapture(event.pointerId);
				this.#captured = capture;
			} catch {
				// The pointer is already gone (or capture is unsupported): window listeners still work
			}
		}
		if ((this.#options.threshold ?? 0) <= 0) this.#startDragging();
		return true;
	}

	/** Re-measures the grab offset so the thing stays where it is now, under the current pointer */
	regrab(origin: Point) {
		if (!this.#session) return;
		this.#session.offset = grabOffset(origin, this.#session.pointer);
		this.#session.position = this.#place(this.#session.pointer, this.#session.offset);
	}

	/** Feed pointermove events; returns whether this drag consumed the event */
	pointerMove(event: PointerEvent): boolean {
		const session = this.#session;
		if (!session || event.pointerId !== session.pointerId) return false;
		this.#track(session, event);
		if (!session.dragging) {
			if (session.travelled < (this.#options.threshold ?? 0)) return false;
			this.#startDragging();
		}
		this.#options.onMove?.(session);
		return true;
	}

	/** Feed pointerup events; returns whether this drag consumed the event */
	pointerUp(event: PointerEvent): boolean {
		const session = this.#session;
		if (!session || event.pointerId !== session.pointerId) return false;
		this.#track(session, event);
		this.#finish();
		if (session.dragging) this.#options.onEnd?.(session);
		else this.#options.onTap?.(session);
		return true;
	}

	/** Feed pointercancel events; the dragged thing should go back where it came from */
	pointerCancel(event: PointerEvent): boolean {
		const session = this.#session;
		if (!session || event.pointerId !== session.pointerId) return false;
		this.abort();
		return true;
	}

	/** Drops the drag as if the browser had cancelled it (for example on Escape) */
	abort() {
		const session = this.#session;
		if (!session) return;
		this.#finish();
		if (session.dragging) this.#options.onCancel?.(session);
	}

	#startDragging() {
		const session = this.#session;
		if (!session) return;
		session.dragging = true;
		this.#options.onStart?.(session);
	}

	#track(session: DragSession, event: PointerEvent) {
		session.pointer = { x: event.clientX, y: event.clientY };
		session.travelled = Math.hypot(
			session.pointer.x - session.start.x,
			session.pointer.y - session.start.y
		);
		session.position = this.#place(session.pointer, session.offset);
	}

	#place(pointer: Point, offset: Point): Point {
		const position = followPointer(pointer, offset);
		return this.#options.constrain ? this.#options.constrain(position) : position;
	}

	#finish() {
		const session = this.#session;
		this.#session = null;
		const element = this.#captured;
		this.#captured = null;
		if (session && element?.hasPointerCapture?.(session.pointerId)) {
			try {
				element.releasePointerCapture(session.pointerId);
			} catch {
				// Already released by the browser
			}
		}
	}
}
