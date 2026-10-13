<!--
	The Sondage Surge map: a grid of abstract département tiles in the shape of the Hexagon. Each
	free tile is a button; a small "+n" chip shows how many rival tiles a rally there would flip, and
	hovering or focusing a tile outlines the tiles that would flip. Scandals freeze a rally (ice) and
	strikes block a tile (hazard stripes). The grid stays left to right in every language.
-->
<script lang="ts">
	import { tileLabel, SIDE_BACKGROUND } from '#lib/components/sondageText.js';
	import type { CellView } from '#lib/stores/sondageGame.svelte.js';
	import IconBan from '~icons/lucide/ban';
	import IconSnowflake from '~icons/lucide/snowflake';

	let {
		cells,
		cols,
		hints,
		stamps,
		active,
		onrally,
		preview
	}: {
		cells: readonly CellView[];
		cols: number;
		/** Flips each tile would give you, shown as a chip while it is your move */
		hints: readonly number[];
		/** Per tile: the move that last changed it; a new value replays the burst animation */
		stamps: readonly number[];
		/** True while it is your move and the game is running */
		active: boolean;
		onrally: (index: number) => void;
		/** The tiles that would flip for a rally at an index, outlined while it is hovered or focused */
		preview: (index: number) => number[];
	} = $props();

	let focused = $state<number | null>(null);
	const flipping = $derived(
		new Set(focused !== null && active && cells[focused]?.owner === null ? preview(focused) : [])
	);
</script>

<div
	class="grid gap-1 sm:gap-1.5"
	style:grid-template-columns="repeat({cols}, minmax(0, 1fr))"
	data-playfield
	style:touch-action="none"
>
	{#each cells as cell, index (index)}
		{#if cell.name === null}
			<div aria-hidden="true"></div>
		{:else}
			{@const free = cell.owner === null && !cell.blocked}
			{@const hint = active && free ? hints[index] : 0}
			<button
				type="button"
				class="tile relative flex aspect-square min-w-0 items-center justify-center overflow-hidden rounded-lg border-2 border-ink p-0.5 text-center font-display text-[0.55rem] leading-none font-bold shadow-[2px_2px_0_var(--color-ink)] transition-colors sm:text-xs {SIDE_BACKGROUND[
					cell.owner ?? 'free'
				]} {active && free ? 'cursor-pointer hover:brightness-95' : 'cursor-default'}"
				class:ring-4={focused === index && active && free}
				class:ring-explosion-yellow={focused === index && active && free}
				class:outline-4={flipping.has(index)}
				class:outline-explosion-yellow={flipping.has(index)}
				class:z-10={flipping.has(index)}
				aria-label={tileLabel(cell, hint)}
				aria-disabled={!(active && free)}
				onclick={() => onrally(index)}
				onfocus={() => (focused = index)}
				onblur={() => (focused = null)}
				onpointerenter={() => (focused = index)}
				onpointerleave={() => (focused = null)}
			>
				{#key stamps[index]}
					{#if stamps[index] > 0}
						<span class="burst pointer-events-none absolute inset-0 rounded-md bg-paper/80"></span>
					{/if}
				{/key}
				<span class="relative break-words hyphens-auto" dir="ltr">{cell.name}</span>
				{#if hint > 0}
					<span
						class="absolute end-0.5 top-0.5 flex min-w-4 items-center justify-center rounded-full border border-ink bg-explosion-yellow px-0.5 py-px text-[0.5rem] leading-none text-ink sm:text-[0.6rem]"
						aria-hidden="true"
					>
						+{hint}
					</span>
				{/if}
				{#if cell.blocked}
					<span
						class="strike absolute inset-0 flex items-center justify-center rounded-md text-ink"
						aria-hidden="true"
					>
						<IconBan class="size-5 sm:size-7" />
					</span>
				{:else if cell.frozen}
					<span
						class="absolute inset-0 flex items-center justify-center rounded-md bg-[#bfe6ff]/80 text-ink"
						aria-hidden="true"
					>
						<IconSnowflake class="size-5 sm:size-7" />
					</span>
				{/if}
			</button>
		{/if}
	{/each}
</div>

<style>
	.burst {
		animation: burst 520ms ease-out forwards;
	}

	.strike {
		background: repeating-linear-gradient(
			135deg,
			rgb(245 200 58 / 0.9) 0 6px,
			rgb(17 17 17 / 0.85) 6px 12px
		);
	}

	@keyframes burst {
		0% {
			opacity: 0.95;
			transform: scale(0.4);
		}
		100% {
			opacity: 0;
			transform: scale(1.15);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.burst {
			animation-duration: 1ms;
		}
	}
</style>
