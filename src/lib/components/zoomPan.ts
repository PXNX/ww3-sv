/*
 * Pinch to zoom and drag to pan for a picture inside a container: the sea chart, your own island and
 * the battle. Put the action on the container; it scales the element inside it that carries
 * data-zoom (the picture), around its centre. Two fingers pinch and pan, the mouse wheel zooms at
 * the cursor, and a single finger or the mouse pans once the picture is zoomed in. A gesture swallows
 * the taps that would otherwise end it, so zooming never lands a boat or opens an island by accident.
 */
export interface ZoomPanOptions {
	min?: number;
	max?: number;
	/** Whether a single pointer may pan; the island turns it off while buildings are being dragged */
	singlePan?: () => boolean;
}

export function zoomPan(node: HTMLElement, options: ZoomPanOptions = {}) {
	let opts = options;
	let scale = 1;
	let tx = 0;
	let ty = 0;
	const pointers = new Map<number, { x: number; y: number }>();
	let pinchDistance = 0;
	let moved = false;
	let panning = false;
	let origin = { x: 0, y: 0 };
	let swallowNext = false;

	node.style.touchAction = 'none';

	const content = (): HTMLElement | null => node.querySelector<HTMLElement>('[data-zoom]');

	let announced = 0;
	let settle: ReturnType<typeof setTimeout> | undefined;

	/**
	 * Tells the picture how far it is zoomed, so canvases can redraw sharp instead of stretching pixels.
	 * Only once the gesture has paused: resizing a canvas bitmap on every step clears it and makes the
	 * animated scenery stutter, while the CSS transform alone scales smoothly in the meantime.
	 */
	function announce() {
		clearTimeout(settle);
		settle = setTimeout(() => {
			if (Math.abs(scale - announced) < 0.05) return;
			announced = scale;
			node.dispatchEvent(new CustomEvent('zoomchange', { detail: { scale } }));
		}, 160);
	}

	function clampAndApply() {
		const target = content();
		if (!target) return;
		const min = opts.min ?? 1;
		const max = opts.max ?? 3.5;
		scale = Math.min(max, Math.max(min, scale));
		const slackX =
			Math.max(0, (target.offsetWidth * scale - node.clientWidth) / 2) + target.offsetWidth * 0.1;
		const slackY =
			Math.max(0, (target.offsetHeight * scale - node.clientHeight) / 2) +
			target.offsetHeight * 0.1;
		tx = scale <= 1.001 ? 0 : Math.min(slackX, Math.max(-slackX, tx));
		ty = scale <= 1.001 ? 0 : Math.min(slackY, Math.max(-slackY, ty));
		target.style.transformOrigin = '50% 50%';
		announce();
		target.style.transform =
			scale === 1 && tx === 0 && ty === 0 ? '' : `translate(${tx}px, ${ty}px) scale(${scale})`;
	}

	/** Zooms by a factor keeping the point under (cx, cy), relative to the container centre, where it is */
	function zoomAt(factor: number, cx: number, cy: number) {
		const next = Math.min(opts.max ?? 3.5, Math.max(opts.min ?? 1, scale * factor));
		const ratio = next / scale;
		tx = cx - (cx - tx) * ratio;
		ty = cy - (cy - ty) * ratio;
		scale = next;
		clampAndApply();
	}

	const centreOf = (event: { clientX: number; clientY: number }) => {
		const rect = node.getBoundingClientRect();
		return {
			x: event.clientX - rect.left - rect.width / 2,
			y: event.clientY - rect.top - rect.height / 2
		};
	};

	function onWheel(event: WheelEvent) {
		if (event.ctrlKey || Math.abs(event.deltaY) > 0) {
			event.preventDefault();
			const at = centreOf(event);
			zoomAt(Math.exp(-event.deltaY * (event.ctrlKey ? 0.01 : 0.0016)), at.x, at.y);
		}
	}

	function onPointerDown(event: PointerEvent) {
		pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
		if (pointers.size === 2) {
			// The second finger starts a pinch: nothing underneath should see it
			event.stopPropagation();
			const [a, b] = [...pointers.values()];
			pinchDistance = Math.hypot(a.x - b.x, a.y - b.y);
			moved = true;
			swallowNext = true;
		} else if (pointers.size === 1) {
			moved = false;
			panning = false;
			swallowNext = false;
			origin = { x: event.clientX, y: event.clientY };
		}
	}

	function onPointerMove(event: PointerEvent) {
		const previous = pointers.get(event.pointerId);
		if (!previous) return;
		const current = { x: event.clientX, y: event.clientY };
		if (pointers.size >= 2) {
			const others = [...pointers.entries()].filter(([id]) => id !== event.pointerId);
			const other = others[0]?.[1];
			if (!other) return;
			const before = Math.hypot(previous.x - other.x, previous.y - other.y);
			const after = Math.hypot(current.x - other.x, current.y - other.y);
			const centre = centreOf({
				clientX: (current.x + other.x) / 2,
				clientY: (current.y + other.y) / 2
			});
			if (before > 0 && after > 0) zoomAt(after / before, centre.x, centre.y);
			// The midpoint of the two fingers drags the picture along
			tx += (current.x - previous.x) / 2;
			ty += (current.y - previous.y) / 2;
			clampAndApply();
			pointers.set(event.pointerId, current);
			event.stopPropagation();
			return;
		}
		pointers.set(event.pointerId, current);
		if (!moved && Math.hypot(current.x - origin.x, current.y - origin.y) > 8) moved = true;
		if (moved && scale > 1.001 && (opts.singlePan?.() ?? true)) {
			if (!panning) {
				panning = true;
				swallowNext = true;
				try {
					node.setPointerCapture(event.pointerId);
				} catch {
					// The pointer may already be gone; panning still works through move events
				}
			}
			tx += current.x - previous.x;
			ty += current.y - previous.y;
			clampAndApply();
			event.stopPropagation();
		}
	}

	function onPointerEnd(event: PointerEvent) {
		pointers.delete(event.pointerId);
		if (swallowNext) {
			// The lift that ends a pinch or a pan is not a tap
			event.stopPropagation();
			if (pointers.size === 0) swallowNext = false;
		}
		if (pointers.size < 2) pinchDistance = 0;
	}

	function onClick(event: MouseEvent) {
		if (moved && (panning || pinchDistance > 0 || scale > 1.001)) event.stopPropagation();
	}

	function onDoubleClick(event: MouseEvent) {
		// A double click on the empty picture returns to the whole view
		if (
			event.target === node ||
			(event.target as HTMLElement | null)?.dataset?.zoom !== undefined
		) {
			scale = 1;
			tx = 0;
			ty = 0;
			clampAndApply();
		}
	}

	node.addEventListener('wheel', onWheel, { passive: false });
	node.addEventListener('pointerdown', onPointerDown, true);
	node.addEventListener('pointermove', onPointerMove, true);
	node.addEventListener('pointerup', onPointerEnd, true);
	node.addEventListener('pointercancel', onPointerEnd, true);
	node.addEventListener('click', onClick, true);
	node.addEventListener('dblclick', onDoubleClick);
	const observer = new ResizeObserver(clampAndApply);
	observer.observe(node);

	return {
		update(next: ZoomPanOptions) {
			opts = next;
		},
		destroy() {
			node.removeEventListener('wheel', onWheel);
			node.removeEventListener('pointerdown', onPointerDown, true);
			node.removeEventListener('pointermove', onPointerMove, true);
			node.removeEventListener('pointerup', onPointerEnd, true);
			node.removeEventListener('pointercancel', onPointerEnd, true);
			node.removeEventListener('click', onClick, true);
			node.removeEventListener('dblclick', onDoubleClick);
			observer.disconnect();
			clearTimeout(settle);
		}
	};
}
