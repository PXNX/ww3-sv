<!--
	Block Puzzle board. Hovering (mouse), pressing and sliding (touch), or moving the keyboard focus
	shows where the selected piece would land and whether that is legal; releasing, clicking, or
	pressing Enter places it. The board always stays left-to-right (data-playfield).
-->
<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import type { Board } from '$lib/game/blocks/board';
	import type { ClearFeedback, Preview } from '$lib/stores/blocksGame.svelte';
	import BlocksCell from './BlocksCell.svelte';

	/** Shared starburst sprite, also used by Shootdown; a placeholder until owner-supplied art exists */
	const EXPLOSION_SPRITE = '/assets/shootdown/_placeholder-explosion.svg';

	let {
		board,
		preview,
		feedback,
		reducedMotion = false,
		onaim,
		onplace
	}: {
		board: Board;
		preview: Preview | null;
		feedback: ClearFeedback | null;
		reducedMotion?: boolean;
		/** The cell the player is pointing at, or null when they stopped pointing */
		onaim: (cell: { row: number; col: number } | null) => void;
		onplace: (row: number, col: number) => void;
	} = $props();

	let grid: HTMLDivElement | undefined = $state();
	let cursor = $state({ row: 0, col: 0 });
	let activePointer: number | null = null;

	const range = $derived(Array.from({ length: board.size }, (_, index) => index));

	const previewCells = $derived(
		new Set(preview?.cells.map(([row, col]) => row * board.size + col) ?? [])
	);
	const clearCells = $derived(new Set(preview?.clears ?? []));
	const burstCells = $derived(new Set(reducedMotion ? [] : (feedback?.cells ?? [])));

	/** Which cell sits under a viewport point, or null when it is outside the board */
	export function cellAt(clientX: number, clientY: number) {
		if (!grid) return null;
		const rect = grid.getBoundingClientRect();
		const col = Math.floor(((clientX - rect.left) / rect.width) * board.size);
		const row = Math.floor(((clientY - rect.top) / rect.height) * board.size);
		if (row < 0 || col < 0 || row >= board.size || col >= board.size) return null;
		return { row, col };
	}

	function cellFromPoint(event: PointerEvent) {
		return cellAt(event.clientX, event.clientY);
	}

	function pointerDown(event: PointerEvent) {
		if (event.button !== 0) return;
		activePointer = event.pointerId;
		// Keep receiving moves while a finger slides across the board
		if (event.pointerType !== 'mouse') grid?.setPointerCapture(event.pointerId);
		onaim(cellFromPoint(event));
	}

	function pointerMove(event: PointerEvent) {
		if (event.pointerType !== 'mouse' && activePointer !== event.pointerId) return;
		onaim(cellFromPoint(event));
	}

	function pointerUp(event: PointerEvent) {
		if (activePointer !== event.pointerId) return;
		activePointer = null;
		const cell = cellFromPoint(event);
		if (cell) onplace(cell.row, cell.col);
		if (event.pointerType !== 'mouse') onaim(null);
	}

	function pointerEnd(event: PointerEvent) {
		if (event.type === 'pointercancel') activePointer = null;
		if (event.pointerType === 'mouse' || event.type === 'pointercancel') onaim(null);
	}

	function focusCell(row: number, col: number) {
		cursor = { row, col };
		grid?.querySelector<HTMLButtonElement>(`[data-cell="${row * board.size + col}"]`)?.focus();
	}

	const MOVES: Record<string, [number, number]> = {
		ArrowUp: [-1, 0],
		ArrowDown: [1, 0],
		ArrowLeft: [0, -1],
		ArrowRight: [0, 1]
	};

	function keyDown(event: KeyboardEvent) {
		const move = MOVES[event.key];
		if (!move) return;
		event.preventDefault();
		const clamp = (value: number) => Math.min(Math.max(value, 0), board.size - 1);
		focusCell(clamp(cursor.row + move[0]), clamp(cursor.col + move[1]));
	}
</script>

<div
	data-playfield
	class="mx-auto w-full max-w-[26rem] rounded-[16px_10px_18px_12px] border-3 border-ink bg-khaki p-2 shadow-[4px_4px_0_var(--color-ink)]"
>
	<!-- The cells are the accessible controls; the container only maps pointer positions to cells
	     (so a finger can slide to aim) and moves the keyboard focus between cells with arrow keys -->
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		bind:this={grid}
		role="group"
		aria-label={m.blocks_board_label()}
		class="grid touch-none gap-[3px] select-none"
		style:grid-template-columns="repeat({board.size}, minmax(0, 1fr))"
		onpointerdown={pointerDown}
		onpointermove={pointerMove}
		onpointerup={pointerUp}
		onpointerleave={pointerEnd}
		onpointercancel={pointerEnd}
		onkeydown={keyDown}
	>
		{#each range as row (row)}
			{#each range as col (col)}
				{@const index = row * board.size + col}
				{@const kind = board.cells[index]}
				{@const inPreview = preview !== null && previewCells.has(index)}
				<button
					type="button"
					data-cell={index}
					class="blocks-cell relative rounded-[5px_3px_6px_4px]"
					tabindex={cursor.row === row && cursor.col === col ? 0 : -1}
					aria-label={kind
						? m.blocks_cell_filled({ row: row + 1, column: col + 1 })
						: m.blocks_cell_empty({ row: row + 1, column: col + 1 })}
					onfocus={() => {
						cursor = { row, col };
						onaim({ row, col });
					}}
					onblur={() => onaim(null)}
					onclick={(event) => {
						// Pointer taps are handled on release above; this is Enter or Space
						if (event.detail === 0) onplace(row, col);
					}}
				>
					{#if inPreview}
						<!-- A legal spot shows a dashed ghost of the piece; an illegal one a hatched cross -->
						<BlocksCell kind={preview.kind} look={preview.legal ? 'ghost' : 'blocked'} />
					{:else}
						<BlocksCell {kind} />
					{/if}
					{#if clearCells.has(index)}
						<span
							class="pointer-events-none absolute inset-0 rounded-[5px_3px_6px_4px] outline-3 -outline-offset-3 outline-explosion-yellow"
						></span>
					{/if}
					{#if burstCells.has(index)}
						{#key feedback?.id}
							<span class="blocks-burst pointer-events-none absolute inset-0">
								<img src={EXPLOSION_SPRITE} alt="" draggable="false" class="size-full" />
							</span>
						{/key}
					{/if}
				</button>
			{/each}
		{/each}
	</div>
</div>

<style>
	.blocks-cell:focus-visible {
		outline: 3px dashed var(--color-tie-red);
		outline-offset: 1px;
		z-index: 1;
	}

	/* A short starburst where a line was cleared */
	@keyframes blocks-burst {
		0% {
			scale: 0.3;
			opacity: 1;
		}
		60% {
			scale: 1.25;
			opacity: 0.9;
		}
		100% {
			scale: 1.4;
			opacity: 0;
		}
	}

	.blocks-burst {
		animation: blocks-burst 420ms var(--ease-spring) both;
	}

	@media (prefers-reduced-motion: reduce) {
		.blocks-burst {
			display: none;
		}
	}
</style>
