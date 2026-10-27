<!--
	Red Square playfield: the square with the lit band in front of the tribune, the column that
	crosses it, one big cue button, the fixed-step loop and the overlays (start card, pause card,
	the verdict toast, the radio line about the next wave, the red flash for a lost mood point).
	The playfield stays left to right and never scrolls. Reduced motion: no shake, the toast simply
	fades.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { cueWindow, windowShare } from '#lib/game/redsquare/timing.js';
	import { createFixedLoop, onAppHidden } from '#lib/game/loop.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { RedSquareGame } from '#lib/stores/redsquareGame.svelte.js';
	import PauseOverlay from './PauseOverlay.svelte';
	import { columnText } from './redsquareText.js';
	import IconPlay from '~icons/lucide/play';
	import IconTrumpet from '~icons/lucide/megaphone';

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
	const verdictUp = $derived(game.phase !== 'march');
	const cueClass = $derived(
		verdictUp
			? game.last?.kind === 'hit'
				? 'bg-[#8fd19e]'
				: 'bg-explosion-yellow'
			: 'bg-tie-red text-paper'
	);

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
			if (target instanceof HTMLButtonElement) return;
			event.preventDefault();
			game.cue();
		}
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

	<!-- The square: the band in front of the tribune is the lit target -->
	<div
		class="relative min-h-28 flex-1 overflow-hidden rounded-md border-3 border-ink bg-[#b8ac8f] sm:min-h-36"
		role="group"
		aria-label={m.redsquare_aria_square()}
	>
		<!-- The tribune and its guest, drawn flat behind the band -->
		<div class="absolute inset-y-0 right-0 left-0" aria-hidden="true">
			<div class="absolute inset-y-0 w-2 bg-ink/15" style:left="0%"></div>
			<div
				class="absolute inset-y-2 rounded-sm border-2 border-dashed border-ink bg-explosion-yellow/55"
				style:left="{window.start * 100}%"
				style:width="{share * 100}%"
			></div>
			<div
				class="absolute top-2 flex h-5 items-end justify-center gap-0.5 rounded-t-sm border-2 border-ink bg-paper px-1"
				style:left="{window.start * 100}%"
				style:width="{share * 100}%"
			>
				<span class="mb-0.5 block h-2 w-1.5 rounded-sm bg-ink"></span>
				<span class="mb-0.5 block h-3 w-1.5 rounded-sm bg-tie-red"></span>
				<span class="mb-0.5 block h-2.5 w-1.5 rounded-sm bg-ink"></span>
			</div>
		</div>

		<!-- The column, riding the marker -->
		<div
			class="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
			style:left="{game.marker * 100}%"
			aria-hidden="true"
		>
			<div class="relative h-10 w-14 sm:h-12 sm:w-16">
				<div
					class="absolute inset-x-0 bottom-0 h-3 rounded-sm border-2 border-ink bg-[#4b5a34]"
				></div>
				<div
					class="absolute inset-x-2 bottom-2 h-5 rounded-sm border-2 border-ink bg-[#6f8d4b]"
				></div>
				<div class="absolute right-1 bottom-6 h-4 w-1 rounded-sm border-2 border-ink bg-ink"></div>
				<div class="absolute top-0 left-1/2 h-6 w-1 -translate-x-1/2 bg-ink"></div>
				<div
					class="absolute top-0 left-1/2 h-4 w-6 -translate-x-1/2 rounded-sm border-2 border-ink bg-tie-red"
				></div>
				<div class="absolute inset-x-1 bottom-0 h-1.5 bg-ink/40"></div>
			</div>
		</div>

		<!-- The marker line, so the exact position is readable -->
		<div
			class="absolute inset-y-0 w-0.5 bg-tie-red/70"
			style:left="{game.marker * 100}%"
			aria-hidden="true"
		></div>
	</div>

	<!-- Cue -->
	<button
		type="button"
		class="btn-chunky flex-col gap-0.5 py-3 text-lg leading-tight disabled:opacity-60 sm:text-xl {cueClass}"
		aria-keyshortcuts="Space"
		disabled={game.status !== 'playing'}
		onpointerdown={(event) => {
			if (event.pointerType === 'mouse' && event.button !== 0) return;
			game.cue();
		}}
		onclick={(event) => {
			// A tap already cued on pointer-down; this catches keyboard and assistive activation
			if (event.detail === 0) game.cue();
		}}
	>
		<IconTrumpet class="size-6 sm:size-7" aria-hidden="true" />
		<span dir="auto">{m.redsquare_cue()}</span>
	</button>

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

	@media (prefers-reduced-motion: reduce) {
		.notice {
			animation: none;
		}

		.hurt {
			animation-duration: 1ms;
		}
	}
</style>
