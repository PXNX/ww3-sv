<!--
	Suez Stuck playfield: a crisp high-DPI canvas driven by the fixed-step loop. Every finger holds
	one end of the ship (the end stays exactly where it was grabbed, see pointerDrag.ts), so two
	thumbs can swing it; a mouse drags the nearest end. A press on a bank tile away from the ship
	calls the excavator. The playfield never mirrors in right-to-left languages and never scrolls
	(touch-action: none).
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { createFixedLoop, onAppHidden } from '#lib/game/loop.js';
	import { clientToLocal, type Rect } from '#lib/game/pointerDrag.js';
	import { WORLD_HEIGHT, WORLD_WIDTH } from '#lib/game/suez/config.js';
	import { drawScene } from '#lib/game/suez/render.js';
	import type { SuezGame } from '#lib/stores/suezGame.svelte.js';
	import PauseOverlay from './PauseOverlay.svelte';
	import IconPlay from '~icons/lucide/play';

	let { game }: { game: SuezGame } = $props();

	let canvas: HTMLCanvasElement | undefined = $state();
	let context: CanvasRenderingContext2D | null = null;
	/** CSS pixels per world unit */
	let scale = 1;

	function draw() {
		if (!canvas || !context) return;
		const ratio = window.devicePixelRatio || 1;
		context.setTransform(scale * ratio, 0, 0, scale * ratio, 0, 0);
		drawScene(context, game.state, game.sceneExtras());
	}

	function resize() {
		if (!canvas) return;
		const ratio = window.devicePixelRatio || 1;
		const width = canvas.clientWidth;
		scale = width / WORLD_WIDTH;
		canvas.width = Math.round(width * ratio);
		canvas.height = Math.round(((width * WORLD_HEIGHT) / WORLD_WIDTH) * ratio);
		draw();
	}

	const loop = createFixedLoop({ update: (dtMs) => game.update(dtMs), render: draw });

	onMount(() => {
		if (!canvas) return;
		context = canvas.getContext('2d');
		const observer = new ResizeObserver(resize);
		observer.observe(canvas);
		const stopHidden = onAppHidden(() => game.pause());
		return () => {
			loop.pause();
			observer.disconnect();
			stopHidden();
		};
	});

	$effect(() => {
		if (game.status === 'playing') {
			loop.start();
		} else {
			loop.pause();
		}
		// Redraw when the state changes while the loop is stopped (pause, a new game, game over)
		void game.status;
		draw();
	});

	/** The drawn area in viewport pixels (inside the border), for mapping pointers to the world */
	function fieldRect(): Rect | null {
		if (!canvas) return null;
		const rect = canvas.getBoundingClientRect();
		return {
			left: rect.left + canvas.clientLeft,
			top: rect.top + canvas.clientTop,
			width: canvas.clientWidth,
			height: canvas.clientHeight
		};
	}

	function worldPoint(event: PointerEvent) {
		const rect = fieldRect();
		if (!rect) return null;
		return clientToLocal(
			rect,
			{ x: event.clientX, y: event.clientY },
			{ width: WORLD_WIDTH, height: WORLD_HEIGHT }
		);
	}

	function onDown(event: PointerEvent) {
		if (game.status !== 'playing') return;
		if (event.pointerType === 'mouse' && event.button !== 0) return;
		const point = worldPoint(event);
		if (!point) return;
		const result = game.press(event.pointerId, point.x, point.y, event.pointerType);
		if (result.kind === 'grab') {
			// Keep getting moves when the finger slides off the field
			try {
				canvas?.setPointerCapture(event.pointerId);
			} catch {
				// The pointer is already gone: the window-level release below still cleans up
			}
		}
		event.preventDefault();
	}

	function onMove(event: PointerEvent) {
		const point = worldPoint(event);
		if (point) game.move(event.pointerId, point.x, point.y);
	}

	function onUp(event: PointerEvent) {
		game.release(event.pointerId);
	}

	const isInteractive = (target: EventTarget | null) =>
		target instanceof HTMLElement &&
		target.closest('button, a, input, select, textarea, [contenteditable]') !== null;

	function onKey(event: KeyboardEvent) {
		if (game.status === 'over' || event.ctrlKey || event.metaKey || event.altKey) return;
		if (event.code === 'Escape') {
			if (game.status === 'playing') game.pause();
		} else if (event.code === 'KeyP' && !event.repeat && !isInteractive(event.target)) {
			game.togglePause();
		}
	}
</script>

<svelte:window onkeydown={onKey} />

<div data-playfield class="flex w-full flex-col gap-3 select-none">
	<div class="relative">
		<canvas
			bind:this={canvas}
			class="block aspect-[9/14] w-full touch-none rounded-[14px_8px_16px_10px] border-3 border-ink shadow-[4px_4px_0_var(--color-ink)]"
			style:touch-action="none"
			aria-label={m.suez_playfield_label()}
			onpointerdown={onDown}
			onpointermove={onMove}
			onpointerup={onUp}
			onpointercancel={onUp}
			onlostpointercapture={onUp}
			oncontextmenu={(event) => event.preventDefault()}
		></canvas>

		<!-- A red flash around the field whenever a heart is lost -->
		{#key game.hurtCount}
			{#if game.hurtCount > 0 && game.status === 'playing'}
				<div
					class="hurt pointer-events-none absolute inset-0 rounded-[14px_8px_16px_10px] border-8 border-tie-red"
				></div>
			{/if}
		{/key}

		{#if game.status === 'ready'}
			<div
				class="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-[14px_8px_16px_10px] bg-ink/35 p-4"
			>
				<div
					class="sticker pop-in flex w-full max-w-xs flex-col items-center gap-3 p-4 text-center"
					style:--tilt="-1.5deg"
				>
					<p dir="auto" class="text-sm leading-snug font-semibold">{m.suez_ready_hint()}</p>
					{#if game.best !== null}
						<p class="text-sm font-semibold">{m.suez_best({ score: game.best })}</p>
					{/if}
					<button type="button" class="btn-chunky bg-tie-red text-xl" onclick={() => game.start()}>
						<IconPlay class="size-5" aria-hidden="true" />
						{m.suez_start()}
					</button>
				</div>
			</div>
		{:else if game.status === 'paused'}
			<PauseOverlay onResume={() => game.resume()} />
		{/if}
	</div>
</div>

<style>
	.hurt {
		animation: hurt 420ms ease-out forwards;
	}

	@keyframes hurt {
		from {
			opacity: 0.85;
		}
		to {
			opacity: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.hurt {
			animation-duration: 1ms;
		}
	}
</style>
