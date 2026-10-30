<!--
	Starlink Kill Switch playfield: a crisp high-DPI canvas driven by the fixed-step loop. Tap a
	drone to cut its link; with the geofence armed, drag a line across the sky instead. Keyboard:
	G or Space arms the geofence, P pauses. Elon's posts and the angry-customer toasts float over
	the canvas. The playfield never mirrors in right-to-left languages.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { createFixedLoop, onAppHidden } from '#lib/game/loop.js';
	import { drawScene } from '#lib/game/killswitch/render.js';
	import {
		WORLD_HEIGHT,
		WORLD_WIDTH,
		type CivilianKind,
		type PostKind
	} from '#lib/game/killswitch/state.js';
	import type { KillswitchGame } from '#lib/stores/killswitchGame.svelte.js';
	import PauseOverlay from './PauseOverlay.svelte';
	import IconPlay from '~icons/lucide/play';

	let { game }: { game: KillswitchGame } = $props();

	let canvas: HTMLCanvasElement | undefined = $state();
	let context: CanvasRenderingContext2D | null = null;
	/** CSS pixels per world unit */
	let scale = 1;
	let dragPointer: number | null = null;
	let dragStart = { x: 0, y: 0 };

	const POST_LINES: Record<PostKind, readonly (() => string)[]> = {
		purge: [m.killswitch_post_purge_1, m.killswitch_post_purge_2],
		rush: [m.killswitch_post_rush_1, m.killswitch_post_rush_2],
		boost: [m.killswitch_post_boost_1, m.killswitch_post_boost_2]
	};
	const POST_HINTS: Record<PostKind, () => string> = {
		purge: m.killswitch_post_purge_hint,
		rush: m.killswitch_post_rush_hint,
		boost: m.killswitch_post_boost_hint
	};
	const ANGRY: Record<CivilianKind, () => string> = {
		van: m.killswitch_angry_van,
		tractor: m.killswitch_angry_tractor,
		bus: m.killswitch_angry_bus,
		boat: m.killswitch_angry_boat
	};

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
			draw();
		}
	});

	function worldPoint(event: PointerEvent) {
		const rect = canvas!.getBoundingClientRect();
		return {
			x: ((event.clientX - rect.left) / rect.width) * WORLD_WIDTH,
			y: ((event.clientY - rect.top) / rect.height) * WORLD_HEIGHT
		};
	}

	function onDown(event: PointerEvent) {
		if (game.status !== 'playing') return;
		const point = worldPoint(event);
		if (game.fenceArmed) {
			dragPointer = event.pointerId;
			dragStart = point;
			canvas!.setPointerCapture(event.pointerId);
			game.dragFence(point.x, point.y, point.x, point.y);
		} else {
			game.tap(point.x, point.y);
		}
	}

	function onMove(event: PointerEvent) {
		if (event.pointerId !== dragPointer) return;
		const point = worldPoint(event);
		game.dragFence(dragStart.x, dragStart.y, point.x, point.y);
	}

	function onUp(event: PointerEvent) {
		if (event.pointerId !== dragPointer) return;
		dragPointer = null;
		const point = worldPoint(event);
		game.dropFence(dragStart.x, dragStart.y, point.x, point.y);
	}

	function onCancel(event: PointerEvent) {
		if (event.pointerId !== dragPointer) return;
		dragPointer = null;
		game.cancelDrag();
	}

	const isInteractive = (target: EventTarget | null) =>
		target instanceof HTMLElement &&
		target.closest('button, a, input, select, textarea, [contenteditable]') !== null;

	function onKey(event: KeyboardEvent) {
		if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
		switch (event.code) {
			case 'KeyG':
			case 'Space':
				// A focused button handles Space itself
				if (isInteractive(event.target) || game.status !== 'playing') return;
				game.armFence();
				break;
			case 'KeyP':
				if (game.status === 'playing' || game.status === 'paused') game.togglePause();
				else return;
				break;
			case 'Escape':
				game.pause();
				break;
			default:
				return;
		}
		if (game.status === 'playing') event.preventDefault();
	}
</script>

<svelte:window onkeydown={onKey} />

<div data-playfield class="relative w-full select-none">
	<canvas
		bind:this={canvas}
		class="block aspect-[640/420] w-full touch-none rounded-[14px_8px_16px_10px] border-3 border-ink shadow-[4px_4px_0_var(--color-ink)] {game.fenceArmed
			? 'cursor-crosshair'
			: 'cursor-pointer'}"
		aria-label={m.killswitch_playfield_label()}
		onpointerdown={onDown}
		onpointermove={onMove}
		onpointerup={onUp}
		onpointercancel={onCancel}
		oncontextmenu={(event) => event.preventDefault()}
	></canvas>

	<!-- Elon's posts and the angry customers, also read out by screen readers -->
	<div
		class="pointer-events-none absolute inset-x-0 top-2 flex flex-col items-center gap-2 px-2"
		aria-live="polite"
	>
		{#if game.post && game.status === 'playing'}
			{#key game.post.id}
				<div
					class="pop-in flex max-w-sm items-start gap-2 rounded-[12px_8px_14px_10px] border-3 border-ink bg-paper p-2 shadow-[3px_3px_0_var(--color-ink)]"
				>
					<img
						src="/assets/cameos/musk.svg"
						alt=""
						class="size-10 shrink-0 rounded-full border-2 border-ink bg-sand"
					/>
					<div class="min-w-0 text-start leading-tight">
						<p class="font-display text-sm font-bold">
							{POST_LINES[game.post.kind][game.post.line - 1]()}
						</p>
						<p class="mt-0.5 text-xs font-semibold text-ink/70">{POST_HINTS[game.post.kind]()}</p>
					</div>
				</div>
			{/key}
		{/if}
		{#if game.toast && game.status === 'playing'}
			{#key game.toast.id}
				<p
					class="pop-in rounded-[10px_6px_12px_8px] border-3 border-ink bg-tie-red px-3 py-1 text-center font-display text-sm font-bold text-paper shadow-[3px_3px_0_var(--color-ink)]"
				>
					{game.toast.crash ? m.killswitch_crash() : ANGRY[game.toast.kind]()}
				</p>
			{/key}
		{/if}
	</div>

	{#if game.fenceArmed && game.status === 'playing'}
		<p
			class="pointer-events-none absolute inset-x-0 bottom-3 mx-auto w-fit rounded-md border-2 border-ink bg-explosion-yellow px-2 py-0.5 font-display text-sm font-bold"
		>
			{m.killswitch_fence_armed()}
		</p>
	{/if}

	{#if game.status === 'ready'}
		<div
			class="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-[14px_8px_16px_10px] bg-ink/45 p-4"
		>
			<div
				class="sticker pop-in flex max-w-sm flex-col items-center gap-3 p-4 text-center"
				style:--tilt="-1.5deg"
			>
				<p class="leading-snug font-semibold">{m.killswitch_how_to()}</p>
				<p class="hidden text-sm sm:block">{m.killswitch_keyboard_hint()}</p>
				<button type="button" class="btn-chunky bg-tie-red text-xl" onclick={() => game.start()}>
					<IconPlay class="size-5" aria-hidden="true" />
					{m.killswitch_start()}
				</button>
			</div>
		</div>
	{:else if game.status === 'paused'}
		<PauseOverlay onResume={() => game.resume()} />
	{/if}
</div>
