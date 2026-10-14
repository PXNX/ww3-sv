<!--
	Wandering Balloon playfield: a crisp high-DPI canvas driven by the fixed-step loop. The only
	control is the burner: hold a finger, the mouse button, Space, the Up arrow or W to climb, let go
	to sink. The playfield never mirrors in right-to-left languages and never scrolls
	(touch-action: none).
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { WORLD_HEIGHT, WORLD_WIDTH } from '#lib/game/balloon/config.js';
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
			holder = null;
		}
		// Redraw when the state changes while the loop is stopped (pause, a new game, game over)
		void game.status;
		draw();
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

<div data-playfield class="flex w-full flex-col gap-3 select-none">
	<div class="relative">
		<canvas
			bind:this={canvas}
			class="block aspect-[8/5] w-full touch-none rounded-[14px_8px_16px_10px] border-3 border-ink shadow-[4px_4px_0_var(--color-ink)]"
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
