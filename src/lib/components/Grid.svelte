<!--
	Block Puzzle board. Hovering (mouse), pressing and sliding (touch), or moving the keyboard focus
	shows where the selected piece would land and whether that is legal; releasing, clicking, or
	pressing Enter places it. The board always stays left-to-right (data-playfield).
-->
<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import type { Board } from '#lib/game/blocks/board.js';
	import type { ClearFeedback, Preview } from '#lib/stores/blocksGame.svelte.js';
	import { cellAt as cellAtPoint } from '#lib/game/pointerDrag.js';
	import BlocksCell, { KIND_HEX } from './BlocksCell.svelte';

	/** Directions the shards of a cleared cell fly off in */
	const SHARDS = [
		[-1, -1],
		[1, -1],
		[-1, 1],
		[1, 1]
	] as const;

	/** How long the ripple takes to move on by one cell */
	const RIPPLE_MS = 40;
	/** The dash of light is slightly faster than the ripple, so it arrives before the cells break */
	const DASH_MS_PER_CELL = 32;
	/** Length of a dash and its tail, in percent of the board */
	const DASH_REACH = 34;

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
	let frame: HTMLDivElement | undefined = $state();
	let cursor = $state({ row: 0, col: 0 });
	let activePointer: number | null = null;

	const range = $derived(Array.from({ length: board.size }, (_, index) => index));

	const previewCells = $derived(
		new Set(preview?.cells.map(([row, col]) => row * board.size + col) ?? [])
	);
	const clearCells = $derived(new Set(preview?.clears ?? []));
	const clearing = $derived(
		reducedMotion || !feedback
			? []
			: feedback.cells.map((index, order) => {
					const row = Math.floor(index / board.size);
					const col = index % board.size;
					// Ripple outwards from the piece that completed the line
					const distance = Math.hypot(row - feedback.origin[0], col - feedback.origin[1]);
					return {
						index,
						row,
						col,
						kind: feedback.kinds[order],
						delay: Math.round(distance * RIPPLE_MS)
					};
				})
	);
	const clearingByCell = $derived(new Map(clearing.map((entry) => [entry.index, entry])));
	/** Where the score popup floats up: the middle of everything that was cleared */
	const popup = $derived.by(() => {
		if (!feedback || reducedMotion || clearing.length === 0) return null;
		const mean = (values: number[]) =>
			values.reduce((sum, value) => sum + value, 0) / values.length;
		return {
			row: mean(clearing.map((entry) => entry.row)),
			col: mean(clearing.map((entry) => entry.col))
		};
	});

	/**
	 * The two dashes of one line, leaving the cell where the piece landed (`at`, as an index along the
	 * line) in opposite directions. Both run until they have left the board, at the same speed.
	 */
	function dashRuns(at: number) {
		const from = ((at + 0.5) / board.size) * 100;
		const run = (forward: boolean) => {
			const to = forward ? 100 + DASH_REACH : -DASH_REACH;
			const ms = Math.round((Math.abs(to - from) / 100) * board.size * DASH_MS_PER_CELL);
			return { forward, from, to, ms };
		};
		return [run(true), run(false)];
	}

	// A short jolt of the whole board, harder for bigger clears
	$effect(() => {
		if (!feedback || reducedMotion || !frame) return;
		const strength = Math.min(feedback.lines, 4) * 2;
		frame.animate(
			[
				{ transform: 'translate(0, 0)' },
				{ transform: `translate(${-strength}px, ${strength / 2}px) rotate(${-strength / 8}deg)` },
				{ transform: `translate(${strength}px, ${-strength / 2}px) rotate(${strength / 8}deg)` },
				{ transform: `translate(${-strength / 2}px, 0)` },
				{ transform: 'translate(0, 0)' }
			],
			{ duration: 320, easing: 'ease-out' }
		);
	});

	/** Which cell sits under a viewport point, or null when it is outside the board */
	export function cellAt(clientX: number, clientY: number) {
		if (!grid) return null;
		return cellAtPoint(grid.getBoundingClientRect(), { x: clientX, y: clientY }, board.size);
	}

	/** The board's cells in viewport pixels, so a dragged piece can be sized and aligned to them */
	export function metrics() {
		if (!grid) return null;
		const rect = grid.getBoundingClientRect();
		const gap = parseFloat(getComputedStyle(grid).columnGap) || 0;
		const cell = (rect.width - gap * (board.size - 1)) / board.size;
		return { left: rect.left, top: rect.top, width: rect.width, height: rect.height, cell, gap };
	}

	function cellFromPoint(event: PointerEvent) {
		return cellAt(event.clientX, event.clientY);
	}

	function pointerDown(event: PointerEvent) {
		// A second finger must not take over the aim of the first
		if (event.button !== 0 || !event.isPrimary) return;
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
	bind:this={frame}
	data-playfield
	class="mx-auto w-full rounded-[16px_10px_18px_12px] border-3 border-ink bg-khaki p-2 shadow-[4px_4px_0_var(--color-ink)]"
	style:max-width="max(16rem, min(34rem, calc((100dvh - 15rem) * 0.75)))"
>
	<!-- The cells are the accessible controls; the container only maps pointer positions to cells
	     (so a finger can slide to aim) and moves the keyboard focus between cells with arrow keys -->
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		bind:this={grid}
		role="group"
		aria-label={m.blocks_board_label()}
		class="relative grid touch-none gap-[3px] select-none"
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
					{#if clearingByCell.get(index)}
						{@const entry = clearingByCell.get(index)!}
						{#key feedback?.id}
							<span
								class="blocks-clear pointer-events-none absolute inset-0 z-10"
								style:--delay="{entry.delay}ms"
								style:--tint={KIND_HEX[entry.kind]}
							>
								<span class="blocks-clear-flash absolute inset-0"></span>
								<!-- A faint puff of dust that drifts up and thins out -->
								<span class="blocks-dust absolute" style:--drift={((entry.index * 7) % 5) - 2}
								></span>
								{#each SHARDS as [dx, dy] (`${dx},${dy}`)}
									<span class="blocks-shard absolute" style:--dx={dx} style:--dy={dy}></span>
								{/each}
							</span>
						{/key}
					{/if}
				</button>
			{/each}
		{/each}
		{#if !reducedMotion && feedback && clearing.length > 0}
			<!-- A soft shockwave rolls out from the piece that completed the line -->
			{#key feedback.id}
				<span
					class="pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-[5px]"
					aria-hidden="true"
				>
					<span
						class="blocks-blast absolute"
						style:left="{((feedback.origin[1] + 0.5) / board.size) * 100}%"
						style:top="{((feedback.origin[0] + 0.5) / board.size) * 100}%"
						style:--reach={Math.min(feedback.lines, 3) * 0.5 + 1.5}
					></span>
					<!-- And a dash of light shoots both ways along every completed row and column, one
					     step ahead of the cells it is about to break -->
					{#each feedback.rows as row (`r${row}`)}
						<span
							class="blocks-lane absolute right-0 left-0"
							style:top="{(row / board.size) * 100}%"
							style:height="{100 / board.size}%"
							style:--delay="{Math.abs(row - feedback.origin[0]) * RIPPLE_MS}ms"
							style:--reach="{DASH_REACH}%"
						>
							<span class="blocks-lane-glow absolute inset-0"></span>
							{#each dashRuns(feedback.origin[1]) as run (run.forward)}
								<span
									class="blocks-dash blocks-dash-row absolute"
									class:forward={run.forward}
									style:--from="{run.from}%"
									style:--to="{run.to}%"
									style:--dur="{run.ms}ms"
								></span>
							{/each}
						</span>
					{/each}
					{#each feedback.cols as col (`c${col}`)}
						<span
							class="blocks-lane absolute top-0 bottom-0"
							style:left="{(col / board.size) * 100}%"
							style:width="{100 / board.size}%"
							style:--delay="{Math.abs(col - feedback.origin[1]) * RIPPLE_MS}ms"
							style:--reach="{DASH_REACH}%"
						>
							<span class="blocks-lane-glow absolute inset-0"></span>
							{#each dashRuns(feedback.origin[0]) as run (run.forward)}
								<span
									class="blocks-dash blocks-dash-col absolute"
									class:forward={run.forward}
									style:--from="{run.from}%"
									style:--to="{run.to}%"
									style:--dur="{run.ms}ms"
								></span>
							{/each}
						</span>
					{/each}
				</span>
			{/key}
		{/if}
		{#if popup && feedback}
			{#key feedback.id}
				<span
					class="blocks-popup pointer-events-none absolute z-20 font-display text-3xl font-bold text-explosion-yellow"
					style:left="{((popup.col + 0.5) / board.size) * 100}%"
					style:top="{((popup.row + 0.5) / board.size) * 100}%"
					dir="ltr"
				>
					{m.blocks_points({ points: feedback.points })}
				</span>
			{/key}
		{/if}
	</div>
</div>

<style>
	.blocks-cell:focus-visible {
		outline: 3px dashed var(--color-tie-red);
		outline-offset: 1px;
		z-index: 1;
	}

	/* The cleared cell flashes white, pops in its own color and shrinks away: a ripple from the placed piece */
	@keyframes blocks-clear-flash {
		/* Until its turn in the ripple the cell keeps looking like the block it was */
		0% {
			scale: 1;
			opacity: 1;
			background: var(--tint);
		}
		25% {
			scale: 1.18;
			opacity: 1;
			background: white;
		}
		50% {
			scale: 1.1;
			background: var(--tint);
		}
		100% {
			scale: 0;
			opacity: 0;
			rotate: 45deg;
			background: var(--tint);
		}
	}

	@keyframes blocks-shard {
		0% {
			translate: 0 0;
			scale: 1;
			opacity: 0;
		}
		1% {
			translate: 0 0;
			scale: 1;
			opacity: 1;
		}
		100% {
			translate: calc(var(--dx) * 1.6rem) calc(var(--dy) * 1.6rem);
			scale: 0.2;
			opacity: 0;
			rotate: calc(var(--dx) * var(--dy) * 120deg);
		}
	}

	@keyframes blocks-popup {
		0% {
			translate: -50% -20%;
			scale: 0.4;
			opacity: 0;
		}
		25% {
			translate: -50% -60%;
			scale: 1.25;
			opacity: 1;
		}
		100% {
			translate: -50% -190%;
			scale: 1;
			opacity: 0;
		}
	}

	/* A thin ring plus a faint glow that expand from the origin and fade out; the board is square, so
	   the size is a share of the board width */
	@keyframes blocks-blast {
		0% {
			scale: 0.05;
			opacity: 0.55;
		}
		100% {
			scale: var(--reach);
			opacity: 0;
		}
	}

	.blocks-blast {
		width: 50%;
		aspect-ratio: 1;
		margin: -25% 0 0 -25%;
		border: 3px solid rgb(255 255 255 / 0.9);
		border-radius: 50%;
		background: radial-gradient(
			circle,
			transparent 45%,
			rgb(255 214 69 / 0.35) 70%,
			transparent 72%
		);
		animation: blocks-blast 520ms ease-out both;
	}

	/* A dash of light: a white-hot head with a glowing tail that shoots along a cleared line. The
	   head sits at the animated edge (--from to --to, in percent of the board) and the tail trails
	   behind it; it is only visible while it travels. */
	@keyframes blocks-dash-x {
		0% {
			left: var(--from);
			opacity: 0;
		}
		8% {
			opacity: 1;
		}
		85% {
			opacity: 1;
		}
		100% {
			left: var(--to);
			opacity: 0;
		}
	}

	@keyframes blocks-dash-y {
		0% {
			top: var(--from);
			opacity: 0;
		}
		8% {
			opacity: 1;
		}
		85% {
			opacity: 1;
		}
		100% {
			top: var(--to);
			opacity: 0;
		}
	}

	/* The line itself lights up for a moment as the dash passes through */
	@keyframes blocks-lane-glow {
		0% {
			opacity: 0;
		}
		20% {
			opacity: 1;
		}
		100% {
			opacity: 0;
		}
	}

	.blocks-lane {
		pointer-events: none;
	}

	.blocks-lane-glow {
		background: radial-gradient(
			closest-side at 50% 50%,
			rgb(255 244 200 / 0.55),
			rgb(255 214 69 / 0.18) 70%,
			transparent
		);
		animation: blocks-lane-glow 520ms ease-out var(--delay) both;
	}

	.blocks-dash {
		opacity: 0;
		/* The glow follows the painted pixels, so the faded tail does not get a boxy halo */
		filter: drop-shadow(0 0 5px rgb(255 214 69)) drop-shadow(0 0 2px white);
	}

	.blocks-dash-row {
		top: 36%;
		height: 28%;
		width: var(--reach);
		border-radius: 999px;
		/* The head (right) is white, then the tail fades through yellow into nothing */
		background:
			radial-gradient(circle at right center, white 0 35%, transparent 36%),
			linear-gradient(to right, transparent, rgb(255 214 69 / 0.75) 65%, white);
		translate: -100% 0;
		animation: blocks-dash-x var(--dur) linear var(--delay) both;
	}

	.blocks-dash-row:not(.forward) {
		background:
			radial-gradient(circle at left center, white 0 35%, transparent 36%),
			linear-gradient(to left, transparent, rgb(255 214 69 / 0.75) 65%, white);
		translate: 0 0;
	}

	.blocks-dash-col {
		left: 36%;
		width: 28%;
		height: var(--reach);
		border-radius: 999px;
		background:
			radial-gradient(circle at center bottom, white 0 35%, transparent 36%),
			linear-gradient(to bottom, transparent, rgb(255 214 69 / 0.75) 65%, white);
		translate: 0 -100%;
		animation: blocks-dash-y var(--dur) linear var(--delay) both;
	}

	.blocks-dash-col:not(.forward) {
		background:
			radial-gradient(circle at center top, white 0 35%, transparent 36%),
			linear-gradient(to top, transparent, rgb(255 214 69 / 0.75) 65%, white);
		translate: 0 0;
	}

	@keyframes blocks-dust {
		0% {
			translate: 0 0;
			scale: 0.4;
			opacity: 0;
		}
		20% {
			opacity: 0.5;
		}
		100% {
			translate: calc(var(--drift) * 0.35rem) -1.4rem;
			scale: 1.7;
			opacity: 0;
		}
	}

	/* Soft, borderless and low in contrast, so it reads as dust rather than as another shape */
	.blocks-dust {
		left: -20%;
		top: -20%;
		width: 140%;
		height: 140%;
		border-radius: 50%;
		background: radial-gradient(circle, rgb(222 212 190 / 0.55) 0%, transparent 65%);
		animation: blocks-dust 900ms ease-out calc(var(--delay) + 150ms) both;
	}

	.blocks-clear-flash {
		border: 2px solid var(--color-ink);
		border-radius: 5px 3px 6px 4px;
		animation: blocks-clear-flash 480ms var(--ease-spring) var(--delay) both;
	}

	.blocks-shard {
		left: calc(50% - 0.2rem);
		top: calc(50% - 0.2rem);
		width: 0.4rem;
		height: 0.4rem;
		border: 1.5px solid var(--color-ink);
		background: var(--tint);
		animation: blocks-shard 520ms ease-out var(--delay) both;
	}

	.blocks-popup {
		-webkit-text-stroke: 2px var(--color-ink);
		paint-order: stroke fill;
		animation: blocks-popup 1000ms ease-out 120ms both;
	}

	@media (prefers-reduced-motion: reduce) {
		.blocks-clear,
		.blocks-blast,
		.blocks-lane,
		.blocks-popup {
			display: none;
		}
	}
</style>
