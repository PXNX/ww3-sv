<!--
	Drone Wall playfield: a crisp high-DPI canvas driven by the fixed-step loop. Tapping a helmet
	collects it; the fixed defense slots are real buttons laid over the canvas, so they work with
	touch, mouse and keyboard alike. The playfield never mirrors in right-to-left languages.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { createFixedLoop, onAppHidden } from '#lib/game/loop.js';
	import { SLOTS, WORLD_HEIGHT, WORLD_WIDTH } from '#lib/game/dronewall/config.js';
	import { drawScene } from '#lib/game/dronewall/render.js';
	import { clientToLocal } from '#lib/game/pointerDrag.js';
	import type { DroneWallGame } from '#lib/stores/dronewallGame.svelte.js';
	import PauseOverlay from './PauseOverlay.svelte';
	import IconPlay from '~icons/lucide/play';

	let { game }: { game: DroneWallGame } = $props();

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
		// Redraw when something changes while the loop is stopped (selection, building, a new game)
		void game.revision;
		draw();
	});

	function onCanvasDown(event: PointerEvent) {
		if (game.status !== 'playing' || !canvas) return;
		const rect = canvas.getBoundingClientRect();
		const point = clientToLocal(
			rect,
			{ x: event.clientX, y: event.clientY },
			{
				width: WORLD_WIDTH,
				height: WORLD_HEIGHT
			}
		);
		// A tap that misses every helmet just closes the build panel
		if (!game.tap(point.x, point.y)) game.select(null);
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

	/** Slot buttons are this many world units wide, centred on the slot */
	const SLOT_BUTTON = 46;

	/** What stands on each slot; the simulation state is not reactive, so this follows `revision` */
	const built = $derived.by(() => {
		void game.revision;
		return game.state.defenses.map(
			(defense) => defense && { kind: defense.kind, level: defense.level }
		);
	});
</script>

<svelte:window onkeydown={onKey} />

<div data-playfield class="flex w-full flex-col gap-3 select-none">
	<div class="relative">
		<canvas
			bind:this={canvas}
			class="block aspect-[9/14] w-full touch-none rounded-[14px_8px_16px_10px] border-3 border-ink shadow-[4px_4px_0_var(--color-ink)]"
			aria-label={m.dronewall_playfield_label()}
			onpointerdown={onCanvasDown}
			oncontextmenu={(event) => event.preventDefault()}
		></canvas>

		{#each SLOTS as slot, index (index)}
			{@const defense = built[index]}
			<button
				type="button"
				class="absolute -translate-x-1/2 -translate-y-1/2 touch-none rounded-full focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-tie-red focus-visible:outline-dashed"
				style:left="{(slot.x / WORLD_WIDTH) * 100}%"
				style:top="{(slot.y / WORLD_HEIGHT) * 100}%"
				style:width="{(SLOT_BUTTON / WORLD_WIDTH) * 100}%"
				style:aspect-ratio="1"
				aria-pressed={game.selectedSlot === index}
				aria-label={defense
					? m.dronewall_slot_built({
							number: index + 1,
							defense: m[`dronewall_${defense.kind}_name`](),
							level: defense.level
						})
					: m.dronewall_slot_empty({ number: index + 1 })}
				disabled={game.status !== 'playing'}
				onclick={() => game.select(index)}
			></button>
		{/each}

		<!-- Wave and breach announcements, also read out by screen readers -->
		<div
			class="pointer-events-none absolute inset-x-0 top-[34%] flex justify-center px-4"
			aria-live="polite"
		>
			{#if game.banner && game.status === 'playing'}
				{#key game.banner}
					<p
						class="pop-in rounded-[10px_6px_12px_8px] border-3 border-ink px-3 py-1 text-center font-display text-xl font-bold shadow-[3px_3px_0_var(--color-ink)] {game
							.banner.kind === 'breach'
							? 'bg-tie-red'
							: 'bg-paper'}"
						style:rotate="-2deg"
					>
						{#if game.banner.kind === 'incoming'}
							{m.dronewall_wave_incoming({ wave: game.banner.wave })}
						{:else if game.banner.kind === 'cleared'}
							{m.dronewall_wave_cleared({ bonus: game.banner.bonus })}
						{:else}
							{m.dronewall_breach()}
						{/if}
					</p>
				{/key}
			{/if}
		</div>

		{#if game.status === 'ready'}
			<div
				class="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-[14px_8px_16px_10px] bg-ink/35 p-5"
			>
				<div
					class="sticker pop-in flex max-w-xs flex-col items-center gap-3 p-4 text-center"
					style:--tilt="-1.5deg"
				>
					<p dir="auto" class="text-sm leading-snug font-semibold">{m.dronewall_ready_hint()}</p>
					<button type="button" class="btn-chunky bg-tie-red text-xl" onclick={() => game.start()}>
						<IconPlay class="size-5" aria-hidden="true" />
						{m.dronewall_start()}
					</button>
				</div>
			</div>
		{:else if game.status === 'paused'}
			<PauseOverlay onResume={() => game.resume()} />
		{/if}
	</div>
</div>
