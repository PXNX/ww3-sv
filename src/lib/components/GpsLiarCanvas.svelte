<!--
	GPS Liar playfield: a crisp high-DPI canvas driven by the fixed-step loop, with the cross-check
	button under it. Drag a finger (or hold the mouse) anywhere on the sea to steer toward it: the
	farther from the boat, the harder the push. Arrow keys or WASD steer, C or Space cross-checks.
	The playfield never mirrors in right-to-left languages and never scrolls (touch-action: none).
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { SCENE_H, SCENE_W, UNIT, boatOnScreen, drawScene } from '#lib/game/gpsliar/render.js';
	import { isSteerKey } from '#lib/game/gpsliar/input.js';
	import { createFixedLoop, onAppHidden } from '#lib/game/loop.js';
	import type { GpsLiarGame } from '#lib/stores/gpsliarGame.svelte.js';
	import PauseOverlay from './PauseOverlay.svelte';
	import IconList from '~icons/lucide/list';
	import IconPlay from '~icons/lucide/play';
	import IconRotate from '~icons/lucide/rotate-ccw';
	import IconScanEye from '~icons/lucide/scan-eye';

	let { game, levelName }: { game: GpsLiarGame; levelName: string } = $props();

	let canvas: HTMLCanvasElement | undefined = $state();
	let context: CanvasRenderingContext2D | null = null;
	/** CSS pixels per scene pixel */
	let scale = 1;
	/** The pointer that steers, so a second finger cannot take over */
	let steerer: number | null = null;

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
		scale = width / SCENE_W;
		canvas.width = Math.round(width * ratio);
		canvas.height = Math.round(width * (SCENE_H / SCENE_W) * ratio);
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
			game.setPointer(null);
		};
	});

	$effect(() => {
		if (game.status === 'playing') {
			loop.start();
		} else {
			loop.pause();
			steerer = null;
		}
		// Redraw when the state changes while the loop is stopped (ready, pause, a new level, results)
		void game.status;
		void game.levelIndex;
		draw();
	});

	/** Steers toward the pointer: its offset from the boat, in sea units */
	function aim(event: PointerEvent) {
		if (!canvas) return;
		const rect = canvas.getBoundingClientRect();
		const boat = boatOnScreen(game.state);
		const px = ((event.clientX - rect.left) / rect.width) * SCENE_W;
		const py = ((event.clientY - rect.top) / rect.height) * SCENE_H;
		game.setPointer({ x: (px - boat.x) / UNIT, y: (py - boat.y) / UNIT });
	}

	function onDown(event: PointerEvent) {
		if (game.status !== 'playing') return;
		if (event.pointerType === 'mouse' && event.button !== 0) return;
		if (steerer === null) steerer = event.pointerId;
		if (event.pointerId !== steerer) return;
		try {
			canvas?.setPointerCapture(event.pointerId);
		} catch {
			// The pointer is already gone: the release handlers below still clean up
		}
		aim(event);
		event.preventDefault();
	}

	function onMove(event: PointerEvent) {
		if (event.pointerId === steerer) aim(event);
	}

	function onUp(event: PointerEvent) {
		if (event.pointerId !== steerer) return;
		steerer = null;
		game.setPointer(null);
	}

	const isInteractive = (target: EventTarget | null) =>
		target instanceof HTMLElement &&
		target.closest('button, a, input, select, textarea, [contenteditable]') !== null;

	function onKeyDown(event: KeyboardEvent) {
		if (event.ctrlKey || event.metaKey || event.altKey) return;
		if (event.code === 'Escape') {
			if (game.status === 'playing') game.pause();
		} else if (event.code === 'KeyP' && !event.repeat && !isInteractive(event.target)) {
			game.togglePause();
		} else if (game.status !== 'playing' || isInteractive(event.target)) {
			return;
		} else if (isSteerKey(event.code)) {
			game.setKey(event.code, true);
			event.preventDefault();
		} else if ((event.code === 'KeyC' || event.code === 'Space') && !event.repeat) {
			game.crossCheck();
			event.preventDefault();
		}
	}

	function onKeyUp(event: KeyboardEvent) {
		if (isSteerKey(event.code)) game.setKey(event.code, false);
	}
</script>

<svelte:window onkeydown={onKeyDown} onkeyup={onKeyUp} />

<div data-playfield class="flex w-full flex-col gap-3 select-none">
	<div class="relative">
		<canvas
			bind:this={canvas}
			class="block aspect-[14/10] w-full touch-none rounded-[14px_8px_16px_10px] border-3 border-ink shadow-[4px_4px_0_var(--color-ink)]"
			style:touch-action="none"
			aria-label={m.gpsliar_playfield_label()}
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
				class="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-[14px_8px_16px_10px] bg-ink/35 p-3"
			>
				<div
					class="sticker pop-in flex w-full max-w-xs flex-col items-center gap-2 p-4 text-center"
					style:--tilt="-1.5deg"
				>
					<h2 dir="auto" class="font-display text-2xl leading-tight font-bold">{levelName}</h2>
					<p dir="auto" class="text-sm leading-snug font-semibold">{m.gpsliar_ready_hint()}</p>
					{#if game.best !== null}
						<p class="text-sm font-semibold">{m.gpsliar_level_best({ score: game.best })}</p>
					{/if}
					<!-- svelte-ignore a11y_autofocus -->
					<button
						type="button"
						class="btn-chunky bg-tie-red text-xl"
						autofocus
						onclick={() => game.start()}
					>
						<IconPlay class="size-5" aria-hidden="true" />
						{m.gpsliar_start()}
					</button>
				</div>
			</div>
		{:else if game.status === 'paused'}
			<PauseOverlay onResume={() => game.resume()}>
				<button type="button" class="btn-chunky min-w-44" onclick={() => game.retry()}>
					<IconRotate class="size-5" aria-hidden="true" />
					{m.gpsliar_restart()}
				</button>
				<button type="button" class="btn-chunky min-w-44" onclick={() => game.backToSelect()}>
					<IconList class="size-5" aria-hidden="true" />
					{m.gpsliar_back_to_levels()}
				</button>
			</PauseOverlay>
		{/if}
	</div>

	<div class="flex items-center justify-between gap-3">
		<p dir="auto" class="hidden flex-1 text-sm font-semibold sm:block">
			{m.gpsliar_controls_hint()}
		</p>
		<button
			type="button"
			class="btn-chunky ms-auto text-lg {game.revealing ? 'bg-explosion-yellow' : 'bg-flag-blue'}"
			disabled={game.status !== 'playing' || game.crossChecksLeft === 0}
			onclick={() => game.crossCheck()}
		>
			<IconScanEye class="size-6" aria-hidden="true" />
			{m.gpsliar_cross_check_button({ count: game.crossChecksLeft })}
		</button>
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
