<!--
	Radar Slice playfield: a crisp high-DPI canvas driven by the fixed-step loop. Swiping a finger,
	pen or mouse across it draws the trail and slices whatever it crosses. The playfield never
	mirrors in right-to-left languages and never scrolls (touch-action: none).
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { createFixedLoop, onAppHidden } from '#lib/game/loop.js';
	import { PointerDrag, clientToLocal, type Rect } from '#lib/game/pointerDrag.js';
	import { WORLD_HEIGHT, WORLD_WIDTH } from '#lib/game/slice/config.js';
	import { drawScene } from '#lib/game/slice/render.js';
	import type { SliceGame } from '#lib/stores/sliceGame.svelte.js';
	import PauseOverlay from './PauseOverlay.svelte';
	import IconPlay from '~icons/lucide/play';

	let { game }: { game: SliceGame } = $props();

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

	function toWorld(client: { x: number; y: number }) {
		const rect = fieldRect();
		return rect ? clientToLocal(rect, client, { width: WORLD_WIDTH, height: WORLD_HEIGHT }) : null;
	}

	const dragger = new PointerDrag({
		onStart: (session) => {
			const point = toWorld(session.start);
			if (point) game.pointerDown(point.x, point.y);
		},
		onMove: (session) => {
			const point = toWorld(session.pointer);
			if (point) game.pointerMove(point.x, point.y);
		}
	});

	function onCanvasDown(event: PointerEvent) {
		if (game.status !== 'playing') return;
		if (dragger.begin(event, { capture: canvas })) event.preventDefault();
	}

	function onPointerMove(event: PointerEvent) {
		if (dragger.pointerMove(event)) event.preventDefault();
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

	// Pausing mid-swipe drops the swipe
	$effect(() => {
		if (game.status !== 'playing') dragger.abort();
	});
</script>

<svelte:window
	onkeydown={onKey}
	onpointermove={onPointerMove}
	onpointerup={(event) => dragger.pointerUp(event)}
	onpointercancel={(event) => dragger.pointerCancel(event)}
/>

<div data-playfield class="flex w-full flex-col gap-3 select-none">
	<div class="relative">
		<canvas
			bind:this={canvas}
			class="block aspect-[9/14] w-full touch-none rounded-[14px_8px_16px_10px] border-3 border-ink shadow-[4px_4px_0_var(--color-ink)]"
			style:touch-action="none"
			aria-label={m.slice_playfield_label()}
			onpointerdown={onCanvasDown}
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
				class="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-[14px_8px_16px_10px] bg-ink/35 p-5"
			>
				<div
					class="sticker pop-in flex max-w-xs flex-col items-center gap-3 p-4 text-center"
					style:--tilt="-1.5deg"
				>
					<p dir="auto" class="text-sm leading-snug font-semibold">{m.slice_ready_hint()}</p>
					<button type="button" class="btn-chunky bg-tie-red text-xl" onclick={() => game.start()}>
						<IconPlay class="size-5" aria-hidden="true" />
						{m.slice_start()}
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
