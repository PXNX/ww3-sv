<!--
	The three pieces on offer. Tap one to select it (tap again to deselect); pieces that fit
	nowhere are dimmed and labelled, so the signal is never color alone.
-->
<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import type { Piece } from '#lib/game/blocks/pieces.js';
	import BlocksCell from './BlocksCell.svelte';
	import IconBan from '~icons/lucide/ban';
	import IconCheck from '~icons/lucide/check';

	let {
		tray,
		fits,
		selected,
		disabled = false,
		onselect,
		ondragstart
	}: {
		tray: readonly (Piece | null)[];
		fits: readonly boolean[];
		selected: number | null;
		disabled?: boolean;
		onselect: (index: number) => void;
		/** A press on a piece that might turn into a drag onto the board (currentTarget is its button) */
		ondragstart?: (index: number, event: PointerEvent) => void;
	} = $props();

	const TILTS = [-2.5, 1.5, -1];
</script>

<ul
	class="mx-auto grid w-full grid-cols-3 gap-2 [--tray-cell:1.125rem] sm:gap-3 sm:[--tray-cell:1.75rem]"
	style:max-width="max(16rem, min(34rem, calc((100dvh - 15rem) * 0.75)))"
	aria-label={m.blocks_tray_label()}
>
	{#each tray as piece, index (index)}
		<li class="flex">
			{#if piece}
				{@const isSelected = selected === index}
				{@const fitsBoard = fits[index]}
				<button
					type="button"
					class="sticker sticker-interactive relative flex aspect-square w-full touch-none items-center justify-center p-1.5 select-none [-webkit-touch-callout:none] sm:p-2 {isSelected
						? '-translate-y-1.5 bg-explosion-yellow outline-3 outline-offset-3 outline-tie-red outline-dashed'
						: ''} {fitsBoard ? '' : 'opacity-60'}"
					style:--tilt="{isSelected ? 0 : TILTS[index % TILTS.length]}deg"
					aria-pressed={isSelected}
					aria-label={m.blocks_piece_label({ number: index + 1, cells: piece.cells.length }) +
						(fitsBoard ? '' : `, ${m.blocks_piece_no_room()}`)}
					{disabled}
					onclick={() => onselect(index)}
					oncontextmenu={(event) => event.preventDefault()}
					onpointerdown={(event) => {
						if (event.button !== 0 || disabled) return;
						ondragstart?.(index, event);
					}}
				>
					<span
						data-playfield
						data-tray-piece
						class="grid gap-[2px]"
						style:grid-template-columns="repeat({piece.width}, var(--tray-cell))"
						style:grid-template-rows="repeat({piece.height}, var(--tray-cell))"
					>
						{#each piece.cells as [row, col] (`${row},${col}`)}
							<span style:grid-row={row + 1} style:grid-column={col + 1}>
								<BlocksCell kind={piece.kind} class="size-(--tray-cell)" />
							</span>
						{/each}
					</span>
					{#if isSelected}
						<span
							class="absolute -end-2 -top-2 rounded-full border-2 border-ink bg-paper p-0.5"
							aria-hidden="true"
						>
							<IconCheck class="size-4" stroke-width="3" />
						</span>
					{:else if !fitsBoard}
						<span
							class="absolute -bottom-2 inline-flex items-center gap-1 rounded-md border-2 border-ink bg-paper px-1.5 text-xs font-bold"
							aria-hidden="true"
						>
							<IconBan class="size-3.5" />
							{m.blocks_piece_no_room()}
						</span>
					{/if}
				</button>
			{:else}
				<span
					class="aspect-square w-full rounded-[16px_10px_14px_8px] border-3 border-dashed border-ink/40"
					aria-hidden="true"
				></span>
			{/if}
		</li>
	{/each}
</ul>
