<!--
	Red Square playfield: the square with the lit band in front of the tribune, the column that
	crosses it, the air targets that have to be shot down, the fixed-step loop and the overlays
	(start card, pause card, the verdict toast, the radio line about the next wave, the red flash for
	a lost mood point). The whole square is the cue, so there is no separate button to aim for. The
	playfield stays left to right and never scrolls. Reduced motion: no shake, the toast simply
	fades.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { cueWindow, windowShare } from '#lib/game/redsquare/timing.js';
	import { createFixedLoop, onAppHidden } from '#lib/game/loop.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { RedSquareGame } from '#lib/stores/redsquareGame.svelte.js';
	import PauseOverlay from './PauseOverlay.svelte';
	import { airName, columnText } from './redsquareText.js';
	import IconPlay from '~icons/lucide/play';

	let { game }: { game: RedSquareGame } = $props();

	let field: HTMLDivElement | undefined = $state();

	const loop = createFixedLoop({
		update: (dtMs) => game.update(dtMs),
		render: () => {}
	});

	onMount(() => {
		const stopHidden = onAppHidden(() => game.pause());
		return () => {
			loop.pause();
			stopHidden();
		};
	});

	$effect(() => {
		if (game.status === 'playing') loop.start();
		else loop.pause();
	});

	// The whole square jolts when a slot is missed
	$effect(() => {
		const count = game.shakeCount;
		if (count === 0 || !field || game.reducedMotion) return;
		field.animate(
			[
				{ transform: 'translate(0, 0)' },
				{ transform: 'translate(-6px, 3px) rotate(-0.4deg)' },
				{ transform: 'translate(6px, -3px) rotate(0.4deg)' },
				{ transform: 'translate(-3px, -2px)' },
				{ transform: 'translate(0, 0)' }
			],
			{ duration: 260, easing: 'ease-out' }
		);
	});

	const window = $derived(cueWindow(game.wave));
	const share = $derived(windowShare(game.wave));

	function onKey(event: KeyboardEvent) {
		if (game.status === 'over' || event.ctrlKey || event.metaKey || event.altKey) return;
		if (event.code === 'Escape') {
			if (game.status === 'playing') game.pause();
			return;
		}
		const target = event.target;
		if (target instanceof HTMLElement && target.closest('input, select, textarea')) return;
		if (event.code === 'KeyP') {
			if (!event.repeat && !(target instanceof HTMLButtonElement)) game.togglePause();
			return;
		}
		if ((event.code === 'Space' || event.code === 'Enter') && !event.repeat) {
			// A focused square or target handles the key itself through its click
			if (target instanceof HTMLButtonElement) return;
			event.preventDefault();
			game.cue();
		}
	}

	// The whole square is one target: a tap anywhere on it cues the column. The target over it is a
	// sibling button, so tapping the drone never also cues.
	function onSquarePointerDown(event: PointerEvent) {
		if (event.pointerType === 'mouse' && event.button !== 0) return;
		game.cue();
	}

	// A click with no pointer behind it (detail 0) comes from the keyboard
	function onSquareClick(event: MouseEvent) {
		if (event.detail === 0) game.cue();
	}

	function onAirPointerDown(event: PointerEvent) {
		if (event.pointerType === 'mouse' && event.button !== 0) return;
		game.shootDown();
	}
</script>

<svelte:window onkeydown={onKey} />

<div
	bind:this={field}
	data-playfield
	dir="ltr"
	class="relative flex w-full flex-1 touch-none flex-col gap-3 overflow-hidden rounded-[14px_8px_16px_10px] border-3 border-ink bg-sand p-2 shadow-[4px_4px_0_var(--color-ink)] select-none sm:p-3"
	style:touch-action="none"
>
	<!-- What is crossing the square, and what the radio still claims is up there -->
	<div
		class="flex items-center justify-between gap-2 rounded-md border-3 border-ink bg-paper px-3 py-1.5 shadow-[2px_2px_0_var(--color-ink)]"
	>
		<p
			dir="auto"
			class="min-w-0 truncate font-display text-base leading-tight font-bold sm:text-xl"
			aria-label={m.redsquare_aria_column({ column: columnText(game.column) })}
		>
			{columnText(game.column)}
		</p>
		<p
			dir="auto"
			class="shrink-0 font-display text-xs font-bold tabular-nums sm:text-sm"
			class:text-tie-red={game.interceptors <= 4}
		>
			{m.redsquare_hud_interceptors({ count: game.interceptors })}
		</p>
	</div>

	<!-- The square: the band in front of the tribune is the lit target, and any tap on the square cues -->
	<div class="relative min-h-28 flex-1 sm:min-h-36">
		<button
			type="button"
			class="absolute inset-0 block w-full overflow-hidden rounded-md border-3 border-ink bg-[#b8ac8f] focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-ink"
			aria-label="{m.redsquare_cue()}. {m.redsquare_aria_square()}"
			aria-keyshortcuts="Space"
			disabled={game.status !== 'playing'}
			onpointerdown={onSquarePointerDown}
			onclick={onSquareClick}
		>
			<!-- The tribune and its guest, drawn flat behind the band -->
			<span class="absolute inset-y-0 right-0 left-0 block" aria-hidden="true">
				<span class="absolute inset-y-0 block w-2 bg-ink/15" style:left="0%"></span>
				<span
					class="absolute inset-y-2 block rounded-sm border-2 border-dashed border-ink bg-explosion-yellow/55"
					style:left="{window.start * 100}%"
					style:width="{share * 100}%"
				></span>
				<span
					class="absolute top-2 flex h-5 items-end justify-center gap-0.5 rounded-t-sm border-2 border-ink bg-paper px-1"
					style:left="{window.start * 100}%"
					style:width="{share * 100}%"
				>
					<span class="mb-0.5 block h-2 w-1.5 rounded-sm bg-ink"></span>
					<span class="mb-0.5 block h-3 w-1.5 rounded-sm bg-tie-red"></span>
					<span class="mb-0.5 block h-2.5 w-1.5 rounded-sm bg-ink"></span>
				</span>
			</span>

			<!-- The column, riding the marker -->
			<span
				class="absolute top-1/2 block -translate-x-1/2 -translate-y-1/2"
				style:left="{game.marker * 100}%"
				aria-hidden="true"
			>
				<span class="relative block h-10 w-14 sm:h-12 sm:w-16">
					<span
						class="absolute inset-x-0 bottom-0 block h-3 rounded-sm border-2 border-ink bg-[#4b5a34]"
					></span>
					<span
						class="absolute inset-x-2 bottom-2 block h-5 rounded-sm border-2 border-ink bg-[#6f8d4b]"
					></span>
					<span
						class="absolute right-1 bottom-6 block h-4 w-1 rounded-sm border-2 border-ink bg-ink"
					></span>
					<span class="absolute top-0 left-1/2 block h-6 w-1 -translate-x-1/2 bg-ink"></span>
					<span
						class="absolute top-0 left-1/2 block h-4 w-6 -translate-x-1/2 rounded-sm border-2 border-ink bg-tie-red"
					></span>
					<span class="absolute inset-x-1 bottom-0 block h-1.5 bg-ink/40"></span>
				</span>
			</span>

			<!-- The marker line, so the exact position is readable -->
			<span
				class="absolute inset-y-0 block w-0.5 bg-tie-red/70"
				style:left="{game.marker * 100}%"
				aria-hidden="true"
			></span>
		</button>

		<!-- A drone or a Flamingo crossing the square: its own target, so a tap never also cues -->
		{#if game.air}
			<button
				type="button"
				class="air-target absolute top-[28%] z-10 block size-11 -translate-x-1/2 -translate-y-1/2 cursor-crosshair sm:size-14"
				style:left="{game.air.progress * 100}%"
				aria-label={m.redsquare_air_label({ kind: airName(game.air.kind) })}
				onpointerdown={onAirPointerDown}
				onclick={(event) => {
					if (event.detail === 0) game.shootDown();
				}}
			>
				{#if game.air.kind === 'drone'}
					<!-- A long-range drone: straight wings, pusher propeller at the tail -->
					<svg viewBox="0 0 48 32" class="pop-in size-full" aria-hidden="true" focusable="false">
						<g stroke="#111" stroke-width="2.5" stroke-linejoin="round" fill="#5b6f8a">
							<path d="M22 13 L28 3 L32 3 L27 13 Z" />
							<path d="M22 19 L28 29 L32 29 L27 19 Z" />
							<path d="M16 12 L24 12 L40 15 L40 17 L24 20 L16 20 L12 16 Z" />
							<path d="M16 13 L8 8 L8 11 L16 15 Z" />
						</g>
						<g stroke="#111" stroke-width="2" stroke-linecap="round">
							<path d="M4 12 L2 20" />
							<circle cx="16" cy="16" r="2" fill="#111" />
						</g>
					</svg>
				{:else}
					<!-- A Flamingo: a cruise missile with swept wings and a burning tail -->
					<svg viewBox="0 0 48 32" class="pop-in size-full" aria-hidden="true" focusable="false">
						<g stroke="#111" stroke-width="2.5" stroke-linejoin="round" fill="#c9c3b4">
							<path d="M14 14 L30 14 L44 16 L30 18 L14 18 Z" />
							<path d="M18 14 L26 6 L30 6 L24 14 Z" />
							<path d="M18 18 L26 26 L30 26 L24 18 Z" />
							<path d="M12 14 L6 9 L6 14 Z" />
						</g>
						<path d="M4 16 L0 12 L0 20 Z" fill="#e1a53c" stroke="#111" stroke-width="1.5" />
					</svg>
				{/if}
			</button>
		{/if}
	</div>

	{#if game.toast && game.status === 'playing'}
		{#key game.toast.id}
			<p
				dir="auto"
				class="notice pointer-events-none absolute inset-x-2 top-[34%] z-10 text-center font-display text-2xl leading-tight font-bold text-paper [-webkit-text-stroke:5px_var(--color-ink)] [paint-order:stroke] sm:text-3xl"
				aria-live="polite"
			>
				{game.toast.text}
			</p>
		{/key}
	{/if}

	{#if game.waveNote && game.status === 'playing'}
		{#key game.waveNote.id}
			<p
				dir="auto"
				class="notice pointer-events-none absolute inset-x-2 top-[52%] z-10 text-center font-display text-base leading-tight font-bold text-paper [-webkit-text-stroke:4px_var(--color-ink)] [paint-order:stroke] sm:text-lg"
			>
				{game.waveNote.text}
			</p>
		{/key}
	{/if}

	<!-- A red flash around the field whenever a mood point is lost -->
	{#key game.hurtCount}
		{#if game.hurtCount > 0 && game.status === 'playing'}
			<div class="hurt pointer-events-none absolute inset-0 z-10 border-8 border-tie-red"></div>
		{/if}
	{/key}

	{#if game.status === 'ready'}
		<div
			class="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-ink/35 p-4"
		>
			<div
				class="sticker pop-in flex w-full max-w-xs flex-col items-center gap-3 p-4 text-center"
				style:--tilt="-1.5deg"
			>
				<p dir="auto" class="text-sm leading-snug font-semibold">{m.redsquare_ready_hint()}</p>
				{#if game.best !== null}
					<p class="text-sm font-semibold">{m.redsquare_best({ score: game.best })}</p>
				{/if}
				<button type="button" class="btn-chunky bg-tie-red text-xl" onclick={() => game.start()}>
					<IconPlay class="size-5" aria-hidden="true" />
					{m.redsquare_start()}
				</button>
			</div>
		</div>
	{:else if game.status === 'paused'}
		<PauseOverlay onResume={() => game.resume()} />
	{/if}
</div>

<style>
	.notice {
		animation: notice 1200ms ease-out forwards;
	}

	.hurt {
		animation: hurt 420ms ease-out forwards;
	}

	/* The target rocks as it crosses, so it reads as flying rather than sliding */
	.air-target {
		animation: air-sway 2200ms ease-in-out infinite;
	}

	@keyframes notice {
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

	@keyframes air-sway {
		0%,
		100% {
			rotate: -2.5deg;
		}
		50% {
			rotate: 2.5deg;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.notice {
			animation: none;
		}

		.hurt {
			animation-duration: 1ms;
		}

		.air-target {
			animation: none;
		}
	}
</style>
