<!--
	Canvas for Iceberg Curling: a crisp high-DPI canvas driven by the fixed-step loop. While aiming,
	drag back from anywhere (like a slingshot) to set the direction and power and let go to throw;
	while the stone slides, press and hold anywhere to sweep. The keyboard does the same: arrows
	aim, Space throws and sweeps, C switches the curl, G the gamble, P pauses. Overlays (the end
	summary) go in as children. The playfield never mirrors in right-to-left languages.
-->
<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { MAX_ANGLE, WORLD_H, WORLD_W } from '#lib/game/curling/config.js';
	import { drawScene } from '#lib/game/curling/render.js';
	import { createFixedLoop, onAppHidden } from '#lib/game/loop.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { CurlingGame } from '#lib/stores/curlingGame.svelte.js';

	let { game, children }: { game: CurlingGame; children?: Snippet } = $props();

	/** Pull distance (world units) that means full power, and the shortest pull that counts as a throw */
	const FULL_PULL = 130;
	const MIN_PULL = 26;

	let canvas: HTMLCanvasElement | undefined = $state();
	let context: CanvasRenderingContext2D | null = null;
	let dragging = $state(false);
	let dragStart = { x: 0, y: 0 };
	let pointerId = -1;
	let cachedHint: { key: string; points: { x: number; y: number }[] | null } = {
		key: '',
		points: null
	};

	function currentHint() {
		const key = `${game.endIndex}|${game.angle.toFixed(2)}|${game.power.toFixed(3)}|${game.spin}|${game.gamble}|${game.phase}`;
		if (cachedHint.key !== key) cachedHint = { key, points: game.hint };
		return cachedHint.points;
	}

	function draw() {
		if (!canvas || !context) return;
		const ratio = canvas.width / WORLD_W || 1;
		context.setTransform(ratio, 0, 0, ratio, 0, 0);
		drawScene(context, game.state, game.fx, {
			labels: { forSale: m.curling_sign_for_sale(), sold: m.curling_sign_sold() },
			hint: currentHint(),
			dragging
		});
	}

	function resize() {
		if (!canvas) return;
		const ratio = window.devicePixelRatio || 1;
		canvas.width = Math.round(canvas.clientWidth * ratio);
		canvas.height = Math.round(canvas.clientHeight * ratio);
		draw();
	}

	const loop = createFixedLoop({
		update: (dtMs: number) => game.update(dtMs),
		render: () => draw()
	});

	onMount(() => {
		if (!canvas) return;
		context = canvas.getContext('2d');
		const observer = new ResizeObserver(resize);
		observer.observe(canvas);
		const stopHidden = onAppHidden(() => game.pause());
		loop.start();
		return () => {
			loop.pause();
			observer.disconnect();
			stopHidden();
		};
	});

	function worldPoint(event: PointerEvent) {
		const rect = canvas!.getBoundingClientRect();
		return {
			x: ((event.clientX - rect.left) / rect.width) * WORLD_W,
			y: ((event.clientY - rect.top) / rect.height) * WORLD_H
		};
	}

	/** Aim from a pull: dragging down and to the left throws up and to the right */
	function aimFromPull(point: { x: number; y: number }) {
		const dx = dragStart.x - point.x;
		const dy = Math.max(1, point.y - dragStart.y);
		const length = Math.hypot(dx, point.y - dragStart.y);
		if (length < 6) return length;
		const angle = (Math.atan2(dx, dy) * 180) / Math.PI;
		game.aim(Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, angle)), length / FULL_PULL);
		return length;
	}

	function onDown(event: PointerEvent) {
		if (game.paused) return;
		if (game.phase === 'aiming') {
			dragging = true;
			pointerId = event.pointerId;
			dragStart = worldPoint(event);
			canvas?.setPointerCapture(event.pointerId);
		} else if (game.phase === 'sliding') {
			pointerId = event.pointerId;
			canvas?.setPointerCapture(event.pointerId);
			game.setSweeping(true);
		}
	}

	function onMove(event: PointerEvent) {
		if (!dragging || event.pointerId !== pointerId || game.phase !== 'aiming') return;
		aimFromPull(worldPoint(event));
	}

	function onUp(event: PointerEvent) {
		if (event.pointerId !== pointerId) return;
		pointerId = -1;
		if (dragging) {
			dragging = false;
			if (game.phase === 'aiming') {
				const length = aimFromPull(worldPoint(event));
				if (length >= MIN_PULL) game.throw();
			}
		}
		game.setSweeping(false);
	}

	function onCancel() {
		dragging = false;
		pointerId = -1;
		game.setSweeping(false);
	}

	const isInteractive = (target: EventTarget | null) =>
		target instanceof HTMLElement &&
		target.closest('button, a, input, select, textarea, [contenteditable], dialog') !== null;

	function onKeyDown(event: KeyboardEvent) {
		if (event.ctrlKey || event.metaKey || event.altKey || isInteractive(event.target)) return;
		const code = event.code;
		if (code === 'KeyP' || code === 'Escape') {
			event.preventDefault();
			if (!event.repeat) game.togglePause();
			return;
		}
		if (game.paused) return;
		if (game.phase === 'aiming') {
			if (code === 'ArrowLeft') game.nudgeAim(-1.5, 0);
			else if (code === 'ArrowRight') game.nudgeAim(1.5, 0);
			else if (code === 'ArrowUp') game.nudgeAim(0, 0.03);
			else if (code === 'ArrowDown') game.nudgeAim(0, -0.03);
			else if (code === 'KeyC' && !event.repeat) game.toggleSpin();
			else if (code === 'KeyG' && !event.repeat) game.toggleGamble();
			else if (code === 'Space' && !event.repeat) game.throw();
			else return;
			event.preventDefault();
		} else if (game.phase === 'sliding' && code === 'Space') {
			event.preventDefault();
			game.setSweeping(true);
		} else if (
			game.phase === 'summary' &&
			(code === 'Space' || code === 'Enter') &&
			!event.repeat
		) {
			event.preventDefault();
			game.nextEnd();
		}
	}

	function onKeyUp(event: KeyboardEvent) {
		if (event.code === 'Space' && game.phase === 'sliding') game.setSweeping(false);
	}
</script>

<svelte:window onkeydown={onKeyDown} onkeyup={onKeyUp} />

<div class="relative w-full select-none">
	<canvas
		bind:this={canvas}
		class="block aspect-[640/420] w-full touch-none rounded-[14px_8px_16px_10px] border-3 border-ink shadow-[4px_4px_0_var(--color-ink)]"
		aria-label={m.curling_playfield_label()}
		onpointerdown={onDown}
		onpointermove={onMove}
		onpointerup={onUp}
		onpointercancel={onCancel}
		oncontextmenu={(event) => event.preventDefault()}
	></canvas>
	{@render children?.()}
</div>
