<!--
	Convoy Runner playfield: draws the strait on a canvas (crisp on high-density screens) and turns
	swipes, taps on either half, arrow keys, and A and D into lane changes. Left and right are always
	physical, also in right-to-left languages.
-->
<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { m } from '$lib/paraglide/messages';
	import { FIELD_HEIGHT, FIELD_WIDTH } from '$lib/game/convoy/constants';
	import { drawScene, loadConvoySprites } from '$lib/game/convoy/drawScene';
	import { createFixedLoop, onAppHidden } from '$lib/game/loop';
	import type { ConvoyGame } from '$lib/stores/convoyGame.svelte';

	let {
		game,
		children
	}: {
		game: ConvoyGame;
		/** Overlays shown on top of the field, such as the start or pause card */
		children?: Snippet;
	} = $props();

	const STEP_MS = 1000 / 60;
	/** Share of the viewport height the field may take, leaving room for the header */
	const MAX_HEIGHT_SHARE = 0.68;
	const SWIPE_PX = 24;

	let wrapper: HTMLDivElement | undefined = $state();
	let canvas: HTMLCanvasElement | undefined = $state();
	let cssWidth = $state(0);
	let cssHeight = $state(0);
	let alpha = 0;

	function draw() {
		const context = canvas?.getContext('2d');
		if (!canvas || !context || cssWidth === 0) return;
		const ratio = window.devicePixelRatio || 1;
		context.setTransform(ratio, 0, 0, ratio, 0, 0);
		context.clearRect(0, 0, cssWidth, cssHeight);
		const scrollAhead =
			game.status === 'running' ? (game.runner.speed * alpha * STEP_MS) / 1000 : 0;
		drawScene(context, game.runner, {
			width: cssWidth,
			height: cssHeight,
			scrollAhead,
			effects: game.effects,
			shakeMs: game.shakeMs,
			reducedMotion: game.reducedMotion,
			timeMs: performance.now()
		});
	}

	function resize() {
		if (!wrapper || !canvas) return;
		const width = Math.min(
			wrapper.clientWidth,
			(window.innerHeight * MAX_HEIGHT_SHARE * FIELD_WIDTH) / FIELD_HEIGHT
		);
		cssWidth = Math.max(1, Math.floor(width));
		cssHeight = Math.floor((cssWidth * FIELD_HEIGHT) / FIELD_WIDTH);
		const ratio = window.devicePixelRatio || 1;
		canvas.width = Math.round(cssWidth * ratio);
		canvas.height = Math.round(cssHeight * ratio);
		draw();
	}

	const loop = createFixedLoop({
		stepMs: STEP_MS,
		update: (stepMs) => game.update(stepMs),
		render: (fraction) => {
			alpha = fraction;
			draw();
		}
	});

	onMount(() => {
		resize();
		loadConvoySprites().then(draw);
		const observer = new ResizeObserver(resize);
		if (wrapper) observer.observe(wrapper);
		window.addEventListener('resize', resize);
		const stopHidden = onAppHidden(() => game.pause());
		return () => {
			loop.pause();
			observer.disconnect();
			window.removeEventListener('resize', resize);
			stopHidden();
		};
	});

	// The loop only runs during play; any other state change still redraws once
	$effect(() => {
		if (game.status === 'running') {
			loop.start();
		} else {
			loop.pause();
			alpha = 0;
			draw();
		}
	});

	function onKeydown(event: KeyboardEvent) {
		if (event.ctrlKey || event.metaKey || event.altKey) return;
		if (event.code === 'KeyP' && !event.repeat) {
			game.togglePause();
			return;
		}
		if (game.status !== 'running' || event.repeat) {
			if (game.status === 'running' && event.key.startsWith('Arrow')) event.preventDefault();
			return;
		}
		if (event.key === 'ArrowLeft' || event.code === 'KeyA') {
			event.preventDefault();
			game.steer(-1);
		} else if (event.key === 'ArrowRight' || event.code === 'KeyD') {
			event.preventDefault();
			game.steer(1);
		}
	}

	let gesture: { id: number; x: number; y: number; handled: boolean } | null = null;

	function onPointerDown(event: PointerEvent) {
		if (game.status !== 'running' || !event.isPrimary) return;
		gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, handled: false };
		canvas?.setPointerCapture(event.pointerId);
	}

	function onPointerMove(event: PointerEvent) {
		if (!gesture || gesture.id !== event.pointerId || gesture.handled) return;
		const dx = event.clientX - gesture.x;
		const dy = event.clientY - gesture.y;
		if (Math.abs(dx) >= SWIPE_PX && Math.abs(dx) > Math.abs(dy)) {
			gesture.handled = true;
			game.steer(dx < 0 ? -1 : 1);
		}
	}

	function onPointerUp(event: PointerEvent) {
		if (!gesture || gesture.id !== event.pointerId) return;
		const { x, y, handled } = gesture;
		gesture = null;
		if (handled || !canvas) return;
		const moved = Math.hypot(event.clientX - x, event.clientY - y);
		if (moved >= SWIPE_PX) return;
		// A tap: the left or right half of the field
		const rect = canvas.getBoundingClientRect();
		game.steer(x - rect.left < rect.width / 2 ? -1 : 1);
	}
</script>

<svelte:window onkeydown={onKeydown} />

<div data-playfield class="flex flex-col items-center gap-3">
	<div bind:this={wrapper} class="flex w-full justify-center">
		<div
			class="relative overflow-hidden rounded-[14px_8px_16px_10px] border-3 border-ink shadow-[4px_4px_0_var(--color-ink)]"
			style:width="{cssWidth}px"
			style:height="{cssHeight}px"
		>
			<canvas
				bind:this={canvas}
				class="block size-full touch-none select-none"
				aria-label={m.convoy_playfield_label()}
				onpointerdown={onPointerDown}
				onpointermove={onPointerMove}
				onpointerup={onPointerUp}
				onpointercancel={() => (gesture = null)}
				oncontextmenu={(event) => event.preventDefault()}
			></canvas>
			{#if children}
				<div class="pointer-events-none absolute inset-0 flex items-center justify-center p-3">
					{@render children()}
				</div>
			{/if}
		</div>
	</div>
</div>
