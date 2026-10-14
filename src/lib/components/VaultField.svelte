<!--
	Gold & Cheese Vault playfield: the grid of cards, the fixed-step loop that times the phone and
	the flip-back of a mismatched pair, and the overlays (start card, pause card, toast, the red
	flash when a heart is lost). The playfield stays left-to-right and never scrolls.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { createFixedLoop, onAppHidden } from '#lib/game/loop.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { VaultGame } from '#lib/stores/vaultGame.svelte.js';
	import PauseOverlay from './PauseOverlay.svelte';
	import VaultCard from './VaultCard.svelte';
	import { symbolName } from './vaultText.js';
	import IconPhone from '~icons/lucide/phone-call';
	import IconPlay from '~icons/lucide/play';

	let { game }: { game: VaultGame } = $props();

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

	const locked = $derived(game.status !== 'playing' || game.phase !== 'play');

	function onKey(event: KeyboardEvent) {
		if (game.status === 'over' || event.ctrlKey || event.metaKey || event.altKey) return;
		if (event.code === 'Escape') {
			if (game.status === 'playing') game.pause();
			return;
		}
		const target = event.target;
		if (target instanceof HTMLElement && target.closest('button, a, input, select, textarea')) {
			return;
		}
		if (event.code === 'KeyP' && !event.repeat) game.togglePause();
	}
</script>

<svelte:window onkeydown={onKey} />

<div
	data-playfield
	dir="ltr"
	class="relative w-full touch-none overflow-hidden rounded-[14px_8px_16px_10px] border-3 border-ink bg-sand p-2 shadow-[4px_4px_0_var(--color-ink)] select-none"
	style:touch-action="none"
	style:aspect-ratio="{game.cols * 10} / {game.rows * 11}"
>
	<div
		role="group"
		aria-label={m.vault_board_label({ cols: game.cols, rows: game.rows })}
		class="grid size-full content-stretch gap-1.5 sm:gap-2"
		style:grid-template-columns="repeat({game.cols}, minmax(0, 1fr))"
		style:grid-template-rows="repeat({game.rows}, minmax(0, 1fr))"
	>
		{#each game.cards as card, index (card.id)}
			<VaultCard
				{card}
				position={index + 1}
				name={symbolName(card.symbol)}
				wrong={game.wrong.includes(index)}
				shuffled={game.shuffled.includes(index)}
				{locked}
				onflip={() => game.flip(index)}
			/>
		{/each}
	</div>

	{#if game.ringing && game.status === 'playing'}
		<div
			class="pointer-events-none absolute end-2 top-2 z-10 rounded-full border-3 border-ink bg-tie-red p-2 text-paper shadow-[2px_2px_0_var(--color-ink)] ring"
			aria-hidden="true"
		>
			<IconPhone class="size-7" />
		</div>
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
				<p dir="auto" class="text-sm leading-snug font-semibold">{m.vault_ready_hint()}</p>
				{#if game.best !== null}
					<p class="text-sm font-semibold">{m.vault_best({ score: game.best })}</p>
				{/if}
				<button type="button" class="btn-chunky bg-tie-red text-xl" onclick={() => game.start()}>
					<IconPlay class="size-5" aria-hidden="true" />
					{m.vault_start()}
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

	.ring {
		animation: ring 380ms ease-in-out infinite;
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

	@keyframes ring {
		0%,
		100% {
			rotate: -12deg;
		}
		50% {
			rotate: 12deg;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.toast,
		.ring {
			animation: none;
		}

		.hurt {
			animation-duration: 1ms;
		}
	}
</style>
