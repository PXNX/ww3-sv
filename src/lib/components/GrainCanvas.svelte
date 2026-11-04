<!--
	Grain Corridor playfield: draws the night sea on a canvas that fills the whole area (crisp on
	high-density screens). The ship follows a finger or the mouse sideways; the arrow keys and A and D
	nudge it, and Space (or the sweep button on the page) calls a minesweeper. Left and right are
	always physical, also in right-to-left languages.
-->
<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { drawScene, worldView, worldXAt } from '#lib/game/grain/drawScene.js';
	import { createFixedLoop, onAppHidden } from '#lib/game/loop.js';
	import type { GrainGame } from '#lib/stores/grainGame.svelte.js';

	let {
		game,
		children
	}: {
		game: GrainGame;
		/** Overlays shown on top of the field, such as the start or pause card */
		children?: Snippet;
	} = $props();

	const STEP_MS = 1000 / 60;

	let wrapper: HTMLDivElement | undefined = $state();
	let canvas: HTMLCanvasElement | undefined = $state();
	let cssWidth = $state(0);
	let cssHeight = $state(0);
	let alpha = 0;

	const portLabel = $derived(m.grain_port_gate({ port: game.ports + 1 }));

	function draw() {
		const context = canvas?.getContext('2d');
		if (!canvas || !context || cssWidth === 0) return;
		const ratio = window.devicePixelRatio || 1;
		context.setTransform(ratio, 0, 0, ratio, 0, 0);
		context.clearRect(0, 0, cssWidth, cssHeight);
		drawScene(context, game.sim, {
			width: cssWidth,
			height: cssHeight,
			timeMs: performance.now(),
			ahead: game.status === 'running' ? (alpha * STEP_MS) / 1000 : 0,
			reducedMotion: game.reducedMotion,
			fx: game.fx,
			portLabel
		});
	}

	function resize() {
		if (!wrapper || !canvas) return;
		cssWidth = Math.max(1, wrapper.clientWidth);
		cssHeight = Math.max(1, wrapper.clientHeight);
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

	// The loop only runs during play (the ready screen keeps the sea gently moving); any other
	// state change still redraws once
	$effect(() => {
		if (game.status === 'running') {
			loop.start();
		} else {
			loop.pause();
			alpha = 0;
			draw();
			if (game.status === 'ready' && !game.reducedMotion) {
				// The ship picker sits on a sea that keeps rolling
				let id = 0;
				const tick = () => {
					draw();
					id = requestAnimationFrame(tick);
				};
				id = requestAnimationFrame(tick);
				return () => cancelAnimationFrame(id);
			}
		}
	});

	// Redraw when the port label changes in a language switch or a new port
	$effect(() => {
		void portLabel;
		if (game.status !== 'running') draw();
	});

	function onKeydown(event: KeyboardEvent) {
		if (event.ctrlKey || event.metaKey || event.altKey) return;
		if (event.code === 'KeyP' && !event.repeat) {
			game.togglePause();
			return;
		}
		if (game.status !== 'running') return;
		if (event.key === 'ArrowLeft' || event.code === 'KeyA') {
			event.preventDefault();
			game.nudge(-1);
		} else if (event.key === 'ArrowRight' || event.code === 'KeyD') {
			event.preventDefault();
			game.nudge(1);
		} else if (event.code === 'Space' || event.key === 'ArrowUp' || event.code === 'KeyW') {
			event.preventDefault();
			if (!event.repeat) game.sweep();
		}
	}

	let pressed = false;

	function steerFrom(event: PointerEvent) {
		if (!canvas || game.status !== 'running') return;
		const rect = canvas.getBoundingClientRect();
		const view = worldView(rect.width, rect.height);
		game.steerTo(worldXAt(view, event.clientX - rect.left));
	}

	function onPointerDown(event: PointerEvent) {
		if (game.status !== 'running' || !canvas) return;
		pressed = true;
		canvas.setPointerCapture(event.pointerId);
		steerFrom(event);
	}

	function onPointerMove(event: PointerEvent) {
		// A finger steers while held; a mouse steers while it hovers over the sea
		if (pressed || event.pointerType === 'mouse') steerFrom(event);
	}

	function onPointerEnd() {
		pressed = false;
	}
</script>

<svelte:window onkeydown={onKeydown} />

<div data-playfield bind:this={wrapper} class="relative min-h-0 flex-1 overflow-hidden">
	<canvas
		bind:this={canvas}
		class="absolute inset-0 block size-full touch-none select-none"
		aria-label={m.grain_playfield_label()}
		onpointerdown={onPointerDown}
		onpointermove={onPointerMove}
		onpointerup={onPointerEnd}
		onpointercancel={onPointerEnd}
		oncontextmenu={(event) => event.preventDefault()}
	></canvas>
	{#if children}
		<!-- Kept below the floating controls and inside the safe areas, as the canvas fills the screen -->
		<div
			class="pointer-events-none absolute inset-0 flex items-center justify-center pt-(--hud-top) pr-[calc(0.75rem+env(safe-area-inset-right))] pb-[calc(0.75rem+env(safe-area-inset-bottom))] pl-[calc(0.75rem+env(safe-area-inset-left))]"
		>
			{@render children()}
		</div>
	{/if}
</div>
