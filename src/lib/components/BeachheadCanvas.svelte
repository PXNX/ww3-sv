<!--
	Beachhead playfield: the island drawn on a crisp high-DPI canvas that fits the available space
	without scrolling (the water shows on the sides where the screen is wider than 12:8). A tap on
	the water or sand lands the next squad on that row; a tap on a building focuses the troops on
	it. Number keys 1 to 8 land a squad on that row, Escape or P pauses.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { COLUMNS, ROWS } from '#lib/game/beachhead/config.js';
	import { drawScene } from '#lib/game/beachhead/render.js';
	import { createFixedLoop, onAppHidden } from '#lib/game/loop.js';
	import type { BeachheadGame } from '#lib/stores/beachheadGame.svelte.js';

	let { game }: { game: BeachheadGame } = $props();

	let stage: HTMLDivElement | undefined = $state();
	let canvas: HTMLCanvasElement | undefined = $state();
	let context: CanvasRenderingContext2D | null = null;
	/** CSS pixels per grid cell */
	let scale = 1;

	function draw() {
		if (!canvas || !context) return;
		const ratio = window.devicePixelRatio || 1;
		context.setTransform(scale * ratio, 0, 0, scale * ratio, 0, 0);
		drawScene(context, game.battle, game.sceneExtras());
	}

	// The island is 12 by 8 cells; whatever does not fit is left as a calm border, never cropped
	function resize() {
		if (!stage || !canvas) return;
		const width = stage.clientWidth;
		const height = stage.clientHeight;
		if (width === 0 || height === 0) return;
		scale = Math.min(width / COLUMNS, height / ROWS);
		const ratio = window.devicePixelRatio || 1;
		canvas.style.width = `${COLUMNS * scale}px`;
		canvas.style.height = `${ROWS * scale}px`;
		canvas.width = Math.round(COLUMNS * scale * ratio);
		canvas.height = Math.round(ROWS * scale * ratio);
		draw();
	}

	const loop = createFixedLoop({ update: (dtMs) => game.update(dtMs), render: draw });

	onMount(() => {
		if (!stage || !canvas) return;
		context = canvas.getContext('2d');
		const observer = new ResizeObserver(resize);
		observer.observe(stage);
		resize();
		const stopHidden = onAppHidden(() => game.pause());
		return () => {
			loop.pause();
			observer.disconnect();
			stopHidden();
		};
	});

	$effect(() => {
		if (game.status === 'playing') loop.start();
		else loop.pause();
		// Redraw while the loop is stopped (a pause, a result, a new island)
		void game.status;
		void game.islandIndex;
		draw();
	});

	function onPointerDown(event: PointerEvent) {
		if (event.pointerType === 'mouse' && event.button !== 0) return;
		const rect = canvas?.getBoundingClientRect();
		if (!rect || rect.width === 0 || rect.height === 0) return;
		event.preventDefault();
		game.tap(
			((event.clientX - rect.left) / rect.width) * COLUMNS,
			((event.clientY - rect.top) / rect.height) * ROWS
		);
	}

	const isInteractive = (target: EventTarget | null) =>
		target instanceof HTMLElement &&
		target.closest('button, a, input, select, textarea, [contenteditable]') !== null;

	function onKey(event: KeyboardEvent) {
		if (event.ctrlKey || event.metaKey || event.altKey || isInteractive(event.target)) return;
		const digit = /^(?:Digit|Numpad)([1-8])$/.exec(event.code);
		if (digit) {
			if (game.status !== 'playing') return;
			game.tap(1, Number(digit[1]) - 0.5);
			event.preventDefault();
			return;
		}
		if (event.code === 'Escape' || event.code === 'KeyP') {
			if (event.repeat) return;
			if (game.status === 'playing' || game.status === 'paused') {
				game.togglePause();
				event.preventDefault();
			}
		}
	}
</script>

<svelte:window onkeydown={onKey} />

<div
	bind:this={stage}
	class="relative flex min-h-0 flex-1 touch-none items-center justify-center overflow-hidden px-2 pt-[calc(var(--hud-top)+0.5rem)] pb-[calc(0.5rem+env(safe-area-inset-bottom))] select-none"
>
	<canvas
		bind:this={canvas}
		class="block touch-none rounded-[10px] shadow-[4px_4px_0_var(--color-ink)]"
		aria-label={m.beachhead_tap_beach()}
		onpointerdown={onPointerDown}
		oncontextmenu={(event) => event.preventDefault()}
	></canvas>
</div>
