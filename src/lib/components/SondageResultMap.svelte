<!--
	The map on the "Elections: Result" screen. It first shows the board as it stood when the election
	was called; then, as the count comes in, every tile swings to the winner in a wave from west to
	east (at once for reduced motion). Left to right in every language.
-->
<script lang="ts">
	import { SIDE_COLOR } from '#lib/game/sondage/board.js';
	import type { Side } from '#lib/game/sondage/board.js';
	import type { CellView } from '#lib/stores/sondageGame.svelte.js';

	let {
		cells,
		cols,
		order,
		winner,
		active,
		reducedMotion = false,
		label
	}: {
		/** The board when the election was called */
		cells: readonly CellView[];
		cols: number;
		/** Tile indexes in swing order, see swingOrder() */
		order: readonly number[];
		winner: Side;
		/** True while the result is on screen: the swing starts when it turns true */
		active: boolean;
		reducedMotion?: boolean;
		label: string;
	} = $props();

	let swung = $state(false);

	$effect(() => {
		if (!active) {
			swung = false;
			return;
		}
		const timer = setTimeout(() => (swung = true), reducedMotion ? 0 : 700);
		return () => clearTimeout(timer);
	});

	/** Position of each tile in the wave */
	const rank = $derived(new Map(order.map((tile, position) => [tile, position])));
</script>

<div
	class="mx-auto grid w-full max-w-60 gap-0.5"
	style:grid-template-columns="repeat({cols}, minmax(0, 1fr))"
	role="img"
	aria-label={label}
	data-playfield
>
	{#each cells as cell, index (index)}
		{#if cell.name === null}
			<div aria-hidden="true"></div>
		{:else}
			<div
				class="aspect-square rounded-[3px] border border-ink"
				style:background={SIDE_COLOR[swung ? winner : (cell.owner ?? 'free')]}
				style:transition="background-color 350ms ease"
				style:transition-delay="{reducedMotion ? 0 : (rank.get(index) ?? 0) * 22}ms"
			></div>
		{/if}
	{/each}
</div>
