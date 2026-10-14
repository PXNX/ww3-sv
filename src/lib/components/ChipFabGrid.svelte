<!--
	Stage B board: the 4x4 grid of memory modules with swipe input. Modules are keyed by id and
	positioned with transforms, so they slide with a CSS transition; merged modules pop and the
	absorbed one shrinks into its partner. The board always stays left-to-right, also in Persian
	and Arabic, so swipe directions match what the player sees.
-->
<script lang="ts">
	import { GRID_SIZE, moduleLabel } from '#lib/game/chipfab/ram.js';
	import type { Direction } from '#lib/game/merge/mergeBoard.js';
	import { tierStyle, tokenColor } from '#lib/game/merge/tierStyle.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { ChipFabGame } from '#lib/stores/chipfabGame.svelte.js';
	import ChipFabModule from './ChipFabModule.svelte';

	let { game }: { game: ChipFabGame } = $props();

	/** Minimum finger travel in pixels before a touch counts as a swipe */
	const SWIPE_THRESHOLD = 24;

	interface Placed {
		id: number;
		tier: number;
		row: number;
		col: number;
		leaving: boolean;
	}

	// One keyed list sorted by id: a merged-away module keeps its element and slides onto its partner
	const placed = $derived.by(() => {
		const tiles: Placed[] = game.leaving.map((item) => ({
			id: item.tile.id,
			tier: item.tile.tier,
			row: item.row,
			col: item.col,
			leaving: true
		}));
		game.board.forEach((row, rowIndex) =>
			row.forEach((cell, col) => {
				if (cell) tiles.push({ id: cell.id, tier: cell.tier, row: rowIndex, col, leaving: false });
			})
		);
		return tiles.sort((a, b) => a.id - b.id);
	});

	let start: { x: number; y: number; id: number } | null = null;

	function onPointerDown(event: PointerEvent) {
		if (!event.isPrimary || game.status !== 'playing') return;
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
	dir="ltr"
	class="absolute inset-0 flex items-center justify-center bg-khaki p-[3%]"
	role="group"
	aria-label={m.chipfab_playfield_label_merge()}
	onpointerdown={onPointerDown}
>
	<div
		class="relative aspect-square w-full rounded-[14px_8px_16px_10px] border-3 border-ink bg-flag-blue/40 p-[1.5%]"
	>
		<div class="relative size-full">
			{#each { length: GRID_SIZE * GRID_SIZE }, index (index)}
				<div
					class="absolute p-[1.5%]"
					style:width="{100 / GRID_SIZE}%"
					style:height="{100 / GRID_SIZE}%"
					style:left="{(index % GRID_SIZE) * (100 / GRID_SIZE)}%"
					style:top="{Math.floor(index / GRID_SIZE) * (100 / GRID_SIZE)}%"
					aria-hidden="true"
				>
					<div class="size-full rounded-[8px_5px_8px_6px] border-2 border-ink/30 bg-paper/50"></div>
				</div>
			{/each}

			{#each placed as item (item.id)}
				<div
					class="tile absolute p-[1.5%]"
					class:leaving={item.leaving}
					style:width="{100 / GRID_SIZE}%"
					style:height="{100 / GRID_SIZE}%"
					style:transform="translate({item.col * 100}%, {item.row * 100}%)"
				>
					{#key item.tier}
						<div
							class="flex size-full flex-col items-center justify-center rounded-[10px_6px_9px_7px] border-3 border-ink shadow-[2px_2px_0_var(--color-ink)]"
							class:pop-in={!item.leaving}
							class:absorbed={item.leaving}
							style:background={tokenColor(tierStyle(item.tier).tile)}
							role="img"
							aria-label={m.chipfab_module_label({ size: moduleLabel(item.tier) })}
						>
							<ChipFabModule tier={item.tier} class="w-4/5" />
							<span
								class="-mt-0.5 font-display text-sm leading-none font-bold sm:text-base"
								aria-hidden="true"
							>
								{moduleLabel(item.tier)}
							</span>
						</div>
					{/key}
				</div>
			{/each}
		</div>
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

	@keyframes shrink {
		60% {
			opacity: 1;
		}
		to {
			scale: 0.6;
			opacity: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.tile {
			transition: none;
		}

		.absorbed {
			animation: none;
		}
	}
</style>
