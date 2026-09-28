<!--
	Merge Tankers board with swipe input. Tiles are keyed by id and positioned with transforms, so
	they slide with a CSS transition; merged ships pop, cleared mines burst. The board always stays
	left-to-right, also in Persian, so swipe directions match what the player sees.
-->
<script lang="ts">
	import type { Direction, Tile } from '$lib/game/merge/mergeBoard';
	import { tierStyle, tokenColor } from '$lib/game/merge/tierStyle';
	import { m } from '$lib/paraglide/messages';
	import { shipName, type LeavingEffect, type MergeGame } from '$lib/stores/mergeGame.svelte';
	import { spriteSrc } from '$lib/theme/sprites';
	import MergeShip from './MergeShip.svelte';

	let { game }: { game: MergeGame } = $props();

	/** Minimum finger travel in pixels before a touch counts as a swipe */
	const SWIPE_THRESHOLD = 24;

	interface Placed {
		tile: Tile;
		row: number;
		col: number;
		effect?: LeavingEffect;
	}

	const size = $derived(game.state.size);

	// One keyed list sorted by id: a merged-away ship keeps its element and slides onto its partner
	const placed = $derived.by(() => {
		const tiles: Placed[] = [...game.leaving];
		game.state.board.forEach((row, rowIndex) =>
			row.forEach((tile, col) => {
				if (tile) tiles.push({ tile, row: rowIndex, col });
			})
		);
		return tiles.sort((a, b) => a.tile.id - b.tile.id);
	});

	let start: { x: number; y: number; id: number } | null = null;

	function onPointerDown(event: PointerEvent) {
		if (!event.isPrimary) return;
		start = { x: event.clientX, y: event.clientY, id: event.pointerId };
	}

	function onPointerUp(event: PointerEvent) {
		if (!start || event.pointerId !== start.id) return;
		const dx = event.clientX - start.x;
		const dy = event.clientY - start.y;
		start = null;
		if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_THRESHOLD) return;
		const direction: Direction =
			Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
		game.move(direction);
	}
</script>

<svelte:window onpointerup={onPointerUp} onpointercancel={() => (start = null)} />

<div
	data-playfield
	class="board relative aspect-square w-full touch-none rounded-[16px_10px_18px_8px] border-3 border-ink bg-khaki p-[2%] shadow-[4px_4px_0_var(--color-ink)] select-none"
	role="group"
	aria-label={m.merge_board_label({ size })}
	onpointerdown={onPointerDown}
>
	<div class="relative size-full">
		{#each { length: size * size }, index (index)}
			<div
				class="absolute p-[4%]"
				style:width="{100 / size}%"
				style:height="{100 / size}%"
				style:left="{(index % size) * (100 / size)}%"
				style:top="{Math.floor(index / size) * (100 / size)}%"
				aria-hidden="true"
			>
				<div
					class="size-full rounded-[10px_6px_9px_7px] border-2 border-ink/40 bg-flag-blue/60"
				></div>
			</div>
		{/each}

		{#each placed as item (item.tile.id)}
			<div
				class="tile absolute p-[4%]"
				class:leaving={item.effect !== undefined}
				style:width="{100 / size}%"
				style:height="{100 / size}%"
				style:transform="translate({item.col * 100}%, {item.row * 100}%)"
			>
				{#if item.tile.kind === 'ship'}
					{@const tier = item.tile.tier}
					{#key tier}
						<div
							class="relative flex size-full items-center justify-center rounded-[12px_7px_10px_8px] border-3 border-ink shadow-[2px_2px_0_var(--color-ink)]"
							class:pop-in={item.effect === undefined}
							class:absorbed={item.effect === 'absorbed'}
							style:background={tokenColor(tierStyle(tier).tile)}
							role="img"
							aria-label={m.merge_ship_label({ ship: shipName(tier), level: tier })}
						>
							<MergeShip {tier} class="size-full" />
							<span
								class="absolute start-0.5 top-0 font-display text-xs leading-none font-bold sm:start-1 sm:top-0.5 sm:text-sm"
								aria-hidden="true"
							>
								{tier}
							</span>
						</div>
					{/key}
				{:else if game.targeting && item.effect === undefined}
					<button
						type="button"
						class="target flex size-full items-center justify-center rounded-full border-3 border-dashed border-tie-red bg-paper"
						aria-label={m.merge_mine_remove({ row: item.row + 1, column: item.col + 1 })}
						onclick={() => game.removeMine({ row: item.row, col: item.col })}
					>
						<img src={spriteSrc('mine')} alt="" class="size-4/5" draggable="false" />
					</button>
				{:else}
					<div
						class="relative flex size-full items-center justify-center"
						class:cleared={item.effect === 'cleared'}
						role="img"
						aria-label={m.merge_mine_label()}
					>
						<img
							src={spriteSrc('mine')}
							alt=""
							class="size-4/5"
							class:fade={item.effect === 'submarine'}
							draggable="false"
						/>
						{#if item.effect === 'submarine'}
							<img
								src={spriteSrc('submarine')}
								alt=""
								class="submarine absolute inset-x-0 bottom-0 w-full"
								draggable="false"
							/>
						{/if}
					</div>
				{/if}
			</div>
		{/each}
	</div>
</div>

<style>
	.tile {
		top: 0;
		left: 0;
		z-index: 1;
		transition: transform 130ms ease-out;
	}

	.tile.leaving {
		z-index: 0;
	}

	.absorbed {
		animation: shrink 260ms ease-in both;
	}

	.cleared {
		animation: burst 260ms var(--ease-spring) both;
	}

	.fade {
		animation: shrink 260ms ease-in both;
	}

	.submarine {
		animation: surface 260ms var(--ease-spring) both;
	}

	.target {
		animation: wobble 900ms ease-in-out infinite;
	}

	.target:focus-visible {
		outline: 3px dashed var(--color-ink);
		outline-offset: 2px;
	}

	@keyframes shrink {
		60% {
			opacity: 1;
		}
		to {
			scale: 0.6;
			opacity: 0;
		}
	}

	@keyframes burst {
		40% {
			scale: 1.35;
		}
		to {
			scale: 0.2;
			opacity: 0;
		}
	}

	@keyframes surface {
		from {
			translate: 0 40%;
			opacity: 0;
		}
	}

	@keyframes wobble {
		50% {
			rotate: 8deg;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.tile {
			transition: none;
		}

		.absorbed,
		.cleared,
		.fade,
		.submarine,
		.target {
			animation: none;
		}
	}
</style>
