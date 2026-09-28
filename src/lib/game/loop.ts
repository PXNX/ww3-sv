/*
 * Fixed-timestep game loop. Game logic advances in constant steps regardless of frame rate, so
 * it behaves identically on slow and fast devices and can be unit tested by calling the step
 * function directly.
 */

export interface AdvanceResult {
	steps: number;
	accumulatorMs: number;
}

/**
 * Adds elapsed frame time to the accumulator and returns how many fixed steps to run.
 * Caps the number of steps so a long stall (for example a background tab) cannot freeze the game.
 */
export function advanceAccumulator(
	accumulatorMs: number,
	elapsedMs: number,
	stepMs: number,
	maxSteps = 5
): AdvanceResult {
	let total = accumulatorMs + Math.max(0, elapsedMs);
	let steps = Math.floor(total / stepMs);
	if (steps > maxSteps) {
		steps = maxSteps;
		total = 0;
	} else {
		total -= steps * stepMs;
	}
	return { steps, accumulatorMs: total };
}

export interface FixedLoopOptions {
	/** Length of one logic step in milliseconds (default: 1000 / 60) */
	stepMs?: number;
	/** Advances the game by one fixed step of stepMs milliseconds */
	update: (stepMs: number) => void;
	/** Draws the current state; alpha is the fraction of a step since the last update */
	render: (alpha: number) => void;
}

export interface FixedLoop {
	start(): void;
	pause(): void;
	readonly running: boolean;
}

export function createFixedLoop({
	stepMs = 1000 / 60,
	update,
	render
}: FixedLoopOptions): FixedLoop {
	let frame = 0;
	let running = false;
	let last = 0;
	let accumulator = 0;

	const tick = (now: number) => {
		if (!running) return;
		const result = advanceAccumulator(accumulator, now - last, stepMs);
		last = now;
		accumulator = result.accumulatorMs;
		for (let i = 0; i < result.steps && running; i++) update(stepMs);
		render(accumulator / stepMs);
		if (running) frame = requestAnimationFrame(tick);
	};

	return {
		start() {
			if (running) return;
			running = true;
			accumulator = 0;
			last = performance.now();
			frame = requestAnimationFrame(tick);
		},
		pause() {
			running = false;
			cancelAnimationFrame(frame);
		},
		get running() {
			return running;
		}
	};
}

/** Calls onHidden when the tab is hidden or the window loses focus; returns a cleanup function */
export function onAppHidden(onHidden: () => void): () => void {
	const onVisibility = () => {
		if (document.visibilityState === 'hidden') onHidden();
	};
	document.addEventListener('visibilitychange', onVisibility);
	window.addEventListener('blur', onHidden);
	return () => {
		document.removeEventListener('visibilitychange', onVisibility);
		window.removeEventListener('blur', onHidden);
	};
}

/** Whether the operating system asks for reduced motion */
export function prefersReducedMotion(): boolean {
	return (
		typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
	);
}
