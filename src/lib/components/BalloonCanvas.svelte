<!--
	Wandering Balloon playfield: a crisp high-DPI canvas driven by the fixed-step loop. The only
	control is the burner: hold a finger, the mouse button, Space, the Up arrow or W to climb, let go
	to sink. The playfield never mirrors in right-to-left languages and never scrolls
	(touch-action: none). The playfield fills the box that the page leaves it: it tells the game the
	box's size, and the game picks a taller field on a portrait box (see field.ts); the canvas is then
	fitted into the box.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { WORLD_WIDTH } from '#lib/game/balloon/config.js';
	import { drawScene } from '#lib/game/balloon/render.js';
	import { createFixedLoop, onAppHidden } from '#lib/game/loop.js';
	import type { BalloonGame } from '#lib/stores/balloonGame.svelte.js';
	import PauseOverlay from './PauseOverlay.svelte';
	import IconPlay from '~icons/lucide/play';

	let { game }: { game: BalloonGame } = $props();

	let canvas: HTMLCanvasElement | undefined = $state();
	let context: CanvasRenderingContext2D | null = null;
	/** CSS pixels per world unit */
	let scale = 1;
	/** The pointer that holds the burner, so a second finger cannot release it */
	let holder: number | null = null;

	/** The box the page leaves for the playfield, in CSS pixels */
	let box: HTMLDivElement | undefined = $state();
	let boxSize = $state({ width: 0, height: 0 });
	/** The canvas border (both sides) and its hard shadow, which the box has to fit as well */
	const BORDER = 6;
	const SHADOW = 4;
	/** The field fitted into the box, never narrower than 14rem (the page scrolls on a tiny screen) */
	const size = $derived.by(() => {
		const width = boxSize.width - SHADOW;
		const height = boxSize.height - SHADOW;
		if (width <= 0 || height <= 0) return null;
		const fit = ((height - BORDER) * WORLD_WIDTH) / game.fieldHeight + BORDER;
		const outer = Math.max(Math.min(width, 224), Math.min(width, fit));
		return { width: outer, height: ((outer - BORDER) * game.fieldHeight) / WORLD_WIDTH + BORDER };
	});

	function draw() {
		if (!canvas || !context) return;
		const ratio = window.devicePixelRatio || 1;
		// The field's top edge (negative on a taller sky) is the top of the canvas
		const top = game.state.field.top;
		context.setTransform(scale * ratio, 0, 0, scale * ratio, 0, -top * scale * ratio);
		drawScene(context, game.state, game.sceneExtras());
	}

	function resize() {
		if (!canvas) return;
		const ratio = window.devicePixelRatio || 1;
		const width = canvas.clientWidth;
		scale = width / WORLD_WIDTH;
		canvas.width = Math.round(width * ratio);
		canvas.height = Math.round(((width * game.state.field.height) / WORLD_WIDTH) * ratio);
		draw();
	}

	const loop = createFixedLoop({ update: (dtMs) => game.update(dtMs), render: draw });

	onMount(() => {
		if (!canvas) return;
		context = canvas.getContext('2d');
		const observer = new ResizeObserver(resize);
		observer.observe(canvas);
		const boxObserver = new ResizeObserver(() => {
			if (!box) return;
			boxSize = { width: box.clientWidth, height: box.clientHeight };
			game.fitBox(boxSize.width, boxSize.height);
		});
		if (box) boxObserver.observe(box);
		const stopHidden = onAppHidden(() => game.pause());
		return () => {
			loop.pause();
			observer.disconnect();
			boxObserver.disconnect();
			stopHidden();
		};
	});

	$effect(() => {
		if (game.status === 'playing') {
			loop.start();
		} else {
			loop.pause();
			holder = null;
		}
		// Redraw when the state changes while the loop is stopped (pause, a new game, game over)
		void game.status;
		draw();
	});

	// A new field shape resizes the canvas right away, before the next frame is drawn
	$effect(() => {
		void size;
		resize();
	});

	function onDown(event: PointerEvent) {
		if (game.status !== 'playing') return;
		if (event.pointerType === 'mouse' && event.button !== 0) return;
		if (holder === null) holder = event.pointerId;
		game.burner(true);
		try {
			canvas?.setPointerCapture(event.pointerId);
		} catch {
			// The pointer is already gone: the release handlers below still clean up
		}
		event.preventDefault();
	}

	function onUp(event: PointerEvent) {
		if (event.pointerId !== holder) return;
		holder = null;
		game.burner(false);
	}

	const isInteractive = (target: EventTarget | null) =>
		target instanceof HTMLElement &&
		target.closest('button, a, input, select, textarea, [contenteditable]') !== null;

	const BURNER_KEYS = ['Space', 'ArrowUp', 'KeyW'];

	function onKeyDown(event: KeyboardEvent) {
		if (game.status === 'over' || event.ctrlKey || event.metaKey || event.altKey) return;
		if (event.code === 'Escape') {
			if (game.status === 'playing') game.pause();
		} else if (event.code === 'KeyP' && !event.repeat && !isInteractive(event.target)) {
			game.togglePause();
		} else if (BURNER_KEYS.includes(event.code) && !isInteractive(event.target)) {
			if (game.status === 'playing') game.burner(true);
			event.preventDefault();
		}
	}

	function onKeyUp(event: KeyboardEvent) {
		if (BURNER_KEYS.includes(event.code) && holder === null) game.burner(false);
	}
</script>

<svelte:window onkeydown={onKeyDown} onkeyup={onKeyUp} />

<div
	bind:this={box}
	data-playfield
	class="flex min-h-0 w-full flex-1 flex-col items-center select-none"
>
	<div
		class="relative w-full shrink-0"
		style:width={size ? `${size.width}px` : undefined}
		style:height={size ? `${size.height}px` : undefined}
		style:aspect-ratio={size ? undefined : `${WORLD_WIDTH} / ${game.fieldHeight}`}
	>
		<canvas
			bind:this={canvas}
			class="block size-full touch-none rounded-[14px_8px_16px_10px] border-3 border-ink shadow-[4px_4px_0_var(--color-ink)]"
			style:touch-action="none"
			aria-label={m.balloon_playfield_label()}
			onpointerdown={onDown}
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
					<p dir="auto" class="text-sm leading-snug font-semibold">{m.balloon_ready_hint()}</p>
					{#if game.best !== null}
						<p class="text-sm font-semibold">{m.balloon_best({ score: game.best })}</p>
					{/if}
					<button type="button" class="btn-chunky bg-tie-red text-xl" onclick={() => game.start()}>
						<IconPlay class="size-5" aria-hidden="true" />
						{m.balloon_start()}
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
