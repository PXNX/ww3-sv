<!--
	GPS Liar playfield: a crisp high-DPI canvas driven by the fixed-step loop that fills the whole
	screen (a screen of another shape just shows more sea around the boat), with the cross-check
	button floating at the bottom right. Drag a finger (or hold the mouse) anywhere on the sea to steer toward it: the
	farther from the boat, the harder the push. Arrow keys or WASD steer, C or Space cross-checks.
	The playfield never mirrors in right-to-left languages and never scrolls (touch-action: none).
-->
<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import {
		FULL_FRAME,
		UNIT,
		boatOnScreen,
		drawScene,
		sceneScale,
		type Frame
	} from '#lib/game/gpsliar/render.js';
	import { isSteerKey } from '#lib/game/gpsliar/input.js';
	import { createFixedLoop, onAppHidden } from '#lib/game/loop.js';
	import type { GpsLiarGame } from '#lib/stores/gpsliarGame.svelte.js';
	import PauseOverlay from './PauseOverlay.svelte';
	import IconList from '~icons/lucide/list';
	import IconPlay from '~icons/lucide/play';
	import IconRotate from '~icons/lucide/rotate-ccw';
	import IconRadio from '~icons/lucide/radio';
	import IconScanEye from '~icons/lucide/scan-eye';

	let {
		game,
		levelName,
		hudHeight = 0
	}: {
		game: GpsLiarGame;
		levelName: string;
		/** Height of the page's HUD floating at --hud-top, in CSS pixels, so the lights stay clear of it */
		hudHeight?: number;
	} = $props();

	let canvas: HTMLCanvasElement | undefined = $state();
	/** An invisible box padded by --hud-top and the safe-area insets, read back in pixels */
	let insets: HTMLDivElement | undefined = $state();
	let controls: HTMLDivElement | undefined = $state();
	let context: CanvasRenderingContext2D | null = null;
	/** CSS pixels per scene pixel */
	let scale = 1;
	let frame: Frame = FULL_FRAME;
	/** The pointer that steers, so a second finger cannot take over */
	let steerer: number | null = null;

	function draw() {
		if (!canvas || !context) return;
		const ratio = window.devicePixelRatio || 1;
		context.setTransform(scale * ratio, 0, 0, scale * ratio, 0, 0);
		drawScene(context, game.state, game.sceneExtras(), frame);
	}

	function resize() {
		if (!canvas) return;
		const ratio = window.devicePixelRatio || 1;
		const width = canvas.clientWidth;
		const height = canvas.clientHeight;
		scale = sceneScale(width, height);
		const pad = insets ? getComputedStyle(insets) : null;
		const inset = (value: string | undefined) => (Number.parseFloat(value ?? '') || 0) / scale;
		frame = {
			width: width / scale,
			height: height / scale,
			top: inset(pad?.paddingTop) + hudHeight / scale,
			right: inset(pad?.paddingRight),
			bottom: inset(pad?.paddingBottom),
			left: inset(pad?.paddingLeft),
			buttonTop: controls ? controls.offsetTop / scale : height / scale
		};
		canvas.width = Math.round(width * ratio);
		canvas.height = Math.round(height * ratio);
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

	// The HUD wraps onto more lines on a narrow screen: keep the lights below it
	$effect(() => {
		void hudHeight;
		untrack(resize);
	});

	/** Steers toward the pointer: its offset from the boat, in sea units */
	function aim(event: PointerEvent) {
		if (!canvas) return;
		const rect = canvas.getBoundingClientRect();
		const boat = boatOnScreen(game.state, frame);
		const px = ((event.clientX - rect.left) / rect.width) * frame.width;
		const py = ((event.clientY - rect.top) / rect.height) * frame.height;
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
		} else if (event.code === 'KeyX' && !event.repeat) {
			game.spoof();
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

{#snippet gauge(label: string, percent: number, color: string)}
	<div class="flex items-center gap-1">
		<span class="w-14 shrink-0 rounded-sm bg-paper/80 px-0.5 text-center uppercase">{label}</span>
		<div
			class="h-3 flex-1 overflow-hidden rounded-sm border-2 border-ink bg-paper"
			aria-hidden="true"
		>
			<div class="h-full {color}" style:width="{percent}%"></div>
		</div>
	</div>
{/snippet}

<div data-playfield class="relative min-h-0 flex-1 overflow-hidden select-none">
	<canvas
		bind:this={canvas}
		class="absolute inset-0 block size-full touch-none"
		style:touch-action="none"
		aria-label={m.gpsliar_playfield_label()}
		onpointerdown={onDown}
		onpointermove={onMove}
		onpointerup={onUp}
		onpointercancel={onUp}
		onlostpointercapture={onUp}
		oncontextmenu={(event) => event.preventDefault()}
	></canvas>

	<!-- Measures the HUD offset and the safe-area insets for the chart, the compass and the lights -->
	<div
		bind:this={insets}
		class="pointer-events-none invisible absolute inset-0 pt-(--hud-top) pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]"
		aria-hidden="true"
	></div>

	<!-- A red flash around the field whenever a heart is lost -->
	{#key game.hurtCount}
		{#if game.hurtCount > 0 && game.status === 'playing'}
			<div class="hurt pointer-events-none absolute inset-0 border-8 border-tie-red"></div>
		{/if}
	{/key}

	<!-- Gauges under the HUD: fuel, spoofer energy and the patrol lock-on; the page dir never flips the playfield -->
	<div
		dir="ltr"
		class="pointer-events-none absolute top-[calc(var(--hud-top)+0.25rem+var(--gps-hud,0px))] left-[calc(0.5rem+env(safe-area-inset-left))] z-10 flex w-36 flex-col gap-1 text-xs font-bold"
		style:--gps-hud="{hudHeight}px"
	>
		{#if game.hasFuel}
			{@render gauge(
				m.gpsliar_gauge_fuel(),
				game.fuelPercent,
				game.fuelPercent < 20 ? 'bg-tie-red' : 'bg-khaki'
			)}
		{/if}
		{@render gauge(
			m.gpsliar_gauge_spoof(),
			game.spoofPercent,
			game.spoofing ? 'bg-explosion-yellow' : 'bg-flag-blue'
		)}
		{#if game.hasPatrols}
			{@render gauge(m.gpsliar_gauge_alert(), game.alertPercent, 'bg-tie-red')}
		{/if}
	</div>

	<!-- What is about to happen: a sanction check, a storm, an empty tank -->
	{#if game.status === 'playing' && (game.sanctionWarn > 0 || game.stormNow || game.alertPercent > 60)}
		<p
			dir="auto"
			role="status"
			class="banner pointer-events-none absolute top-[calc(var(--hud-top)+0.25rem+var(--gps-hud,0px))] left-1/2 z-10 -translate-x-1/2 rounded-md border-3 border-ink px-3 py-1 text-center font-display text-sm font-bold shadow-[2px_2px_0_var(--color-ink)] {game.sanctionWarn >
			0
				? 'bg-explosion-yellow'
				: 'bg-paper'}"
			style:--gps-hud="{hudHeight}px"
		>
			{#if game.sanctionWarn > 0}
				{m.gpsliar_banner_sanction({ seconds: game.sanctionWarn })}
			{:else if game.alertPercent > 60}
				{m.gpsliar_banner_radar()}
			{:else}
				{m.gpsliar_banner_storm()}
			{/if}
		</p>
	{/if}

	<!-- Always at the bottom right, even in right-to-left languages: the chart takes the other corner -->
	<div
		bind:this={controls}
		dir="ltr"
		class="absolute right-[calc(0.5rem+env(safe-area-inset-right))] bottom-[calc(0.5rem+env(safe-area-inset-bottom))] z-10 flex flex-col items-end gap-2"
	>
		<button
			type="button"
			class="btn-chunky text-lg {game.spoofing ? 'bg-explosion-yellow' : 'bg-paper'}"
			aria-pressed={game.spoofing}
			disabled={game.status !== 'playing'}
			onclick={() => game.spoof()}
		>
			<IconRadio class="size-6" aria-hidden="true" />
			{m.gpsliar_spoof_button()}
		</button>
		<button
			type="button"
			class="btn-chunky text-lg {game.revealing ? 'bg-explosion-yellow' : 'bg-flag-blue'}"
			disabled={game.status !== 'playing' || game.crossChecksLeft === 0}
			onclick={() => game.crossCheck()}
		>
			<IconScanEye class="size-6" aria-hidden="true" />
			{m.gpsliar_cross_check_button({ count: game.crossChecksLeft })}
		</button>
	</div>

	{#if game.status === 'ready'}
		<div
			class="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-ink/35 p-3"
		>
			<div
				class="sticker pop-in flex w-full max-w-xs flex-col items-center gap-3 p-4 text-center"
				style:--tilt="-1.5deg"
			>
				<h2 dir="auto" class="font-display text-2xl leading-tight font-bold">{levelName}</h2>
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

<style>
	.banner {
		animation: banner 0.8s ease-in-out infinite alternate;
	}

	@keyframes banner {
		to {
			transform: translateX(-50%) scale(1.06);
		}
	}

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

		.banner {
			animation: none;
		}
	}
</style>
