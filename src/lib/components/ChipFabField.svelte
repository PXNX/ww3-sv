<!--
	Chip Fab Rush playfield: shows Stage A (the canvas stacker) or Stage B (the module grid) in one
	box of the same size, runs the fixed-step loop for both, and holds the overlays: the start card,
	the pause card, the toast and the red flash when a heart is lost. The playfield stays
	left-to-right and never scrolls (touch-action: none).
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { createFixedLoop, onAppHidden } from '#lib/game/loop.js';
	import type { Direction } from '#lib/game/merge/mergeBoard.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { ChipFabGame } from '#lib/stores/chipfabGame.svelte.js';
	import ChipFabGrid from './ChipFabGrid.svelte';
	import ChipFabStacker from './ChipFabStacker.svelte';
	import PauseOverlay from './PauseOverlay.svelte';
	import IconPlay from '~icons/lucide/play';

	let { game }: { game: ChipFabGame } = $props();

	let stacker: ReturnType<typeof ChipFabStacker> | undefined = $state();

	const loop = createFixedLoop({
		update: (dtMs) => game.update(dtMs),
		render: () => stacker?.draw()
	});

	onMount(() => {
		const stopHidden = onAppHidden(() => game.pause());
		return () => {
			loop.pause();
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
		void game.stage;
		stacker?.draw();
	});

	const isInteractive = (target: EventTarget | null) =>
		target instanceof HTMLElement &&
		target.closest('button, a, input, select, textarea, [contenteditable]') !== null;

	const KEY_DIRECTIONS: Record<string, Direction> = {
		ArrowLeft: 'left',
		ArrowRight: 'right',
		ArrowUp: 'up',
		ArrowDown: 'down',
		KeyA: 'left',
		KeyD: 'right',
		KeyW: 'up',
		KeyS: 'down'
	};

	function onKey(event: KeyboardEvent) {
		if (game.status === 'over' || event.ctrlKey || event.metaKey || event.altKey) return;
		if (event.code === 'Escape') {
			if (game.status === 'playing') game.pause();
			return;
		}
		if (isInteractive(event.target)) return;
		if (event.code === 'KeyP' && !event.repeat) {
			game.togglePause();
			return;
		}
		if (game.status !== 'playing') return;
		if (game.stage === 'stack' && (event.code === 'Space' || event.code === 'Enter')) {
			event.preventDefault();
			if (!event.repeat) game.drop();
		} else if (game.stage === 'merge' && event.code in KEY_DIRECTIONS) {
			event.preventDefault();
			game.move(KEY_DIRECTIONS[event.code]);
		}
	}
</script>

<svelte:window onkeydown={onKey} />

<div
	data-playfield
	dir="ltr"
	class="relative aspect-[5/7] w-full touch-none overflow-hidden rounded-[14px_8px_16px_10px] border-3 border-ink bg-sand shadow-[4px_4px_0_var(--color-ink)] select-none"
	style:touch-action="none"
>
	{#if game.stage === 'stack'}
		<ChipFabStacker bind:this={stacker} {game} />
	{:else}
		<ChipFabGrid {game} />
	{/if}

	{#if game.toast && game.status === 'playing'}
		{#key game.toast.id}
			<p
				dir="auto"
				class="pointer-events-none toast absolute inset-x-2 top-3 z-10 text-center font-display text-2xl leading-tight font-bold text-paper [-webkit-text-stroke:5px_var(--color-ink)] [paint-order:stroke] sm:text-3xl"
				aria-live="polite"
			>
				{game.toast.text}
			</p>
		{/key}
	{/if}

	<!-- A red flash around the field whenever a heart is lost -->
	{#key game.hurtCount}
		{#if game.hurtCount > 0 && game.status === 'playing'}
			<div class="hurt pointer-events-none absolute inset-0 border-8 border-tie-red"></div>
		{/if}
	{/key}

	{#if game.status === 'ready'}
		<div
			class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-ink/35 p-4"
		>
			<div
				class="sticker pop-in flex w-full max-w-xs flex-col items-center gap-3 p-4 text-center"
				style:--tilt="-1.5deg"
			>
				<p dir="auto" class="text-sm leading-snug font-semibold">{m.chipfab_ready_hint()}</p>
				{#if game.best !== null}
					<p class="text-sm font-semibold">{m.chipfab_best({ score: game.best })}</p>
				{/if}
				<button type="button" class="btn-chunky bg-tie-red text-xl" onclick={() => game.start()}>
					<IconPlay class="size-5" aria-hidden="true" />
					{m.chipfab_start()}
				</button>
			</div>
		</div>
	{:else if game.status === 'paused'}
		<PauseOverlay onResume={() => game.resume()} />
	{/if}
</div>

<style>
	.toast {
		animation: toast 1500ms ease-out forwards;
	}

	.hurt {
		animation: hurt 420ms ease-out forwards;
	}

	@keyframes toast {
		0% {
			opacity: 0;
			transform: scale(0.7);
		}
		12% {
			opacity: 1;
			transform: scale(1.08);
		}
		20% {
			transform: scale(1);
		}
		75% {
			opacity: 1;
		}
		100% {
			opacity: 0;
			transform: translateY(-0.75rem);
		}
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
		.toast {
			animation: none;
		}

		.hurt {
			animation-duration: 1ms;
		}
	}
</style>
