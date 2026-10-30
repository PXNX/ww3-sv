<!--
	Recon scope: a crisp high-DPI canvas that shows the drone camera, driven by the fixed-step loop.
	Dragging pans the scope, a tap selects the contact under the finger (or drops the selection on
	empty ground), and the minimap in the corner jumps the scope. Keyboard: arrow keys or WASD pan,
	1 to 3 pick the sensor, X strikes, C clears, P pauses. The briefing, pause and debrief cards
	sit on top of the scope. The playfield never mirrors in right-to-left languages.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { createFixedLoop, onAppHidden } from '#lib/game/loop.js';
	import { VIEW_H, VIEW_W } from '#lib/game/recon/config.js';
	import { SENSORS } from '#lib/game/recon/contacts.js';
	import { drawScene, minimapToMap } from '#lib/game/recon/render.js';
	import { RECON_TEXT, brief } from '#lib/game/recon/text.js';
	import type { ReconGame } from '#lib/stores/reconGame.svelte.js';
	import PauseOverlay from './PauseOverlay.svelte';
	import IconPlay from '~icons/lucide/play';
	import IconTriangleAlert from '~icons/lucide/triangle-alert';

	let { game }: { game: ReconGame } = $props();

	let canvas: HTMLCanvasElement | undefined = $state();
	let context: CanvasRenderingContext2D | null = null;
	/** CSS pixels per scope unit */
	let scale = 1;

	/** Pixels a finger may travel before a press counts as a drag instead of a tap */
	const DRAG_SLOP_PX = 8;
	let gesture: {
		id: number;
		lastX: number;
		lastY: number;
		startX: number;
		startY: number;
		moved: boolean;
		minimap: boolean;
	} | null = null;

	function draw() {
		if (!canvas || !context) return;
		const ratio = window.devicePixelRatio || 1;
		context.setTransform(scale * ratio, 0, 0, scale * ratio, 0, 0);
		const k = game.shakeMs > 0 && !game.reducedMotion ? game.shakeMs / 320 : 0;
		drawScene(
			context,
			{
				run: game.run,
				timeMs: game.timeMs,
				switchMs: game.switchMs,
				flashMs: game.flashMs,
				flashBad: game.flashBad
			},
			{ x: (Math.random() - 0.5) * 8 * k, y: (Math.random() - 0.5) * 8 * k }
		);
	}

	function resize() {
		if (!canvas) return;
		const ratio = window.devicePixelRatio || 1;
		const width = canvas.clientWidth;
		scale = width / VIEW_W;
		canvas.width = Math.round(width * ratio);
		canvas.height = Math.round(((width * VIEW_H) / VIEW_W) * ratio);
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

	/** A pointer position in scope units, measured from the top left of the picture */
	function scopePoint(event: PointerEvent) {
		const rect = canvas!.getBoundingClientRect();
		return {
			x: ((event.clientX - rect.left) / rect.width) * VIEW_W,
			y: ((event.clientY - rect.top) / rect.height) * VIEW_H
		};
	}

	function onDown(event: PointerEvent) {
		if (game.status !== 'playing' || gesture) return;
		canvas!.setPointerCapture(event.pointerId);
		const point = scopePoint(event);
		const jump = minimapToMap(point.x, point.y);
		gesture = {
			id: event.pointerId,
			lastX: event.clientX,
			lastY: event.clientY,
			startX: event.clientX,
			startY: event.clientY,
			moved: false,
			minimap: jump !== null
		};
		if (jump) game.panTo(jump.x, jump.y);
	}

	function onMove(event: PointerEvent) {
		if (!gesture || event.pointerId !== gesture.id) return;
		if (gesture.minimap) {
			const jump = minimapToMap(scopePoint(event).x, scopePoint(event).y);
			if (jump) game.panTo(jump.x, jump.y);
			return;
		}
		if (
			!gesture.moved &&
			Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) < DRAG_SLOP_PX
		) {
			return;
		}
		gesture.moved = true;
		// The map follows the finger, so the scope moves the opposite way
		game.pan(-(event.clientX - gesture.lastX) / scale, -(event.clientY - gesture.lastY) / scale);
		gesture.lastX = event.clientX;
		gesture.lastY = event.clientY;
	}

	function onUp(event: PointerEvent) {
		if (!gesture || event.pointerId !== gesture.id) return;
		const done = gesture;
		gesture = null;
		if (event.type === 'pointercancel' || done.moved || done.minimap) return;
		const point = scopePoint(event);
		game.tapAt(game.run.cam.x + (point.x - VIEW_W / 2), game.run.cam.y + (point.y - VIEW_H / 2));
	}

	const isInteractive = (target: EventTarget | null) =>
		target instanceof HTMLElement &&
		target.closest('button, a, input, select, textarea, [contenteditable]') !== null;

	const keys = { left: false, right: false, up: false, down: false };

	function syncKeyPan() {
		game.setKeyPan(Number(keys.right) - Number(keys.left), Number(keys.down) - Number(keys.up));
	}

	function onKey(event: KeyboardEvent, pressed: boolean) {
		if (event.ctrlKey || event.metaKey || event.altKey || isInteractive(event.target)) return;
		// Physical keys, so the controls work with any keyboard layout
		switch (event.code) {
			case 'ArrowLeft':
			case 'KeyA':
				keys.left = pressed;
				break;
			case 'ArrowRight':
			case 'KeyD':
				keys.right = pressed;
				break;
			case 'ArrowUp':
			case 'KeyW':
				keys.up = pressed;
				break;
			case 'ArrowDown':
			case 'KeyS':
				keys.down = pressed;
				break;
			case 'Digit1':
			case 'Digit2':
			case 'Digit3':
				if (pressed && !event.repeat) game.chooseSensor(SENSORS[Number(event.code.slice(5)) - 1]);
				break;
			case 'KeyX':
				if (pressed && !event.repeat) game.strike();
				break;
			case 'KeyC':
				if (pressed && !event.repeat) game.clearSelected();
				break;
			case 'KeyP':
			case 'Escape':
				if (pressed && !event.repeat) {
					if (event.code === 'Escape') game.pause();
					else game.togglePause();
				}
				break;
			default:
				return;
		}
		syncKeyPan();
		if (game.status === 'playing') event.preventDefault();
	}

	const result = $derived(game.result);
</script>

<svelte:window onkeydown={(event) => onKey(event, true)} onkeyup={(event) => onKey(event, false)} />

<div data-playfield dir="ltr" class="relative w-full select-none">
	<canvas
		bind:this={canvas}
		class="block aspect-[6/7] w-full touch-none rounded-[14px_8px_16px_10px] border-3 border-ink bg-ink shadow-[4px_4px_0_var(--color-ink)]"
		aria-label={RECON_TEXT.playfield}
		onpointerdown={onDown}
		onpointermove={onMove}
		onpointerup={onUp}
		onpointercancel={onUp}
		oncontextmenu={(event) => event.preventDefault()}
	></canvas>

	<!-- Warnings, also read out by screen readers -->
	<div
		class="pointer-events-none absolute inset-x-0 top-12 flex justify-center px-3"
		aria-live="polite"
	>
		{#if game.banner && game.status === 'playing'}
			{#key game.banner}
				<p
					class="pop-in flex items-center gap-1.5 rounded-[10px_6px_12px_8px] border-3 border-ink bg-tie-red px-3 py-1 text-center font-display text-sm font-bold text-paper shadow-[3px_3px_0_var(--color-ink)]"
				>
					<IconTriangleAlert class="size-4 shrink-0" aria-hidden="true" />
					{game.banner === 'threat' ? RECON_TEXT.banners.threat : RECON_TEXT.banners.noOrdnance}
				</p>
			{/key}
		{/if}
	</div>

	{#if game.status === 'ready'}
		<div
			class="absolute inset-0 flex flex-col items-center justify-center rounded-[14px_8px_16px_10px] bg-ink/55 p-4"
		>
			<div
				class="sticker pop-in flex max-w-xs flex-col items-center gap-3 p-4 text-center"
				style:--tilt="-1.5deg"
			>
				<h2 class="text-2xl font-bold">{RECON_TEXT.debrief.next(1)}</h2>
				<p class="text-sm leading-snug font-semibold">{brief(1)}</p>
				<button type="button" class="btn-chunky bg-tie-red text-lg" onclick={() => game.start()}>
					<IconPlay class="size-5" aria-hidden="true" />
					{RECON_TEXT.start}
				</button>
			</div>
		</div>
	{:else if game.status === 'paused'}
		<PauseOverlay cover onResume={() => game.resume()} />
	{:else if game.status === 'debrief' && result}
		<div
			class="absolute inset-0 flex flex-col items-center justify-center overflow-y-auto rounded-[14px_8px_16px_10px] bg-ink/65 p-3"
		>
			<div class="sticker pop-in flex w-full max-w-xs flex-col gap-2 p-4" style:--tilt="1deg">
				<h2 class="text-center text-xl font-bold">{RECON_TEXT.debrief.title(result.sortie)}</h2>
				<p class="text-center text-xs font-bold uppercase opacity-70">
					{RECON_TEXT.endings[result.ended]}
				</p>
				<dl class="flex flex-col gap-0.5 font-display text-sm">
					{#each [[RECON_TEXT.debrief.struck, result.hostilesStruck, false], [RECON_TEXT.debrief.cleared, result.harmlessCleared, false], [RECON_TEXT.debrief.civilians, result.civiliansStruck, true], [RECON_TEXT.debrief.decoys, result.decoysStruck, true], [RECON_TEXT.debrief.escaped, result.escaped, true]] as const as [label, count, bad] (label)}
						<div class="flex justify-between gap-2">
							<dt>{label}</dt>
							<dd class="font-bold tabular-nums {bad && count > 0 ? 'text-tie-red' : ''}">
								{count}
							</dd>
						</div>
					{/each}
					{#if result.timeBonus > 0}
						<div class="flex justify-between gap-2">
							<dt>{RECON_TEXT.debrief.timeBonus}</dt>
							<dd class="font-bold tabular-nums">+{result.timeBonus}</dd>
						</div>
					{/if}
					{#if result.cleanBonus > 0}
						<div class="flex justify-between gap-2">
							<dt>{RECON_TEXT.debrief.cleanBonus}</dt>
							<dd class="font-bold tabular-nums">+{result.cleanBonus}</dd>
						</div>
					{/if}
					<div
						class="mt-1 flex justify-between gap-2 border-t-2 border-ink pt-1 text-base font-bold"
					>
						<dt>{RECON_TEXT.debrief.total}</dt>
						<dd class="tabular-nums {result.total < 0 ? 'text-tie-red' : ''}">
							{result.total > 0 ? '+' : ''}{result.total}
						</dd>
					</div>
				</dl>
				<p class="text-xs leading-snug">{brief(result.sortie + 1)}</p>
				<button
					type="button"
					class="btn-chunky justify-center bg-tie-red"
					onclick={() => game.launchNext()}
				>
					<IconPlay class="size-5" aria-hidden="true" />
					{RECON_TEXT.debrief.next(result.sortie + 1)}
				</button>
			</div>
		</div>
	{/if}
</div>
