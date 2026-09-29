<!--
	Block Puzzle mode (requirements Section 2): pick one of three pieces, place it on the board,
	and clear full rows and columns. The game ends when none of the offered pieces fits.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { m } from '$lib/paraglide/messages';
	import { BlocksGame } from '$lib/stores/blocksGame.svelte';
	import type { Piece } from '$lib/game/blocks/pieces';
	import type { MascotPose } from '$lib/theme/character';
	import { prefersReducedMotion } from '$lib/game/loop';
	import BlocksCell, { KIND_HEX } from '$lib/components/BlocksCell.svelte';
	import CharacterMascot from '$lib/components/CharacterMascot.svelte';
	import GameOverModal from '$lib/components/GameOverModal.svelte';
	import GameShell from '$lib/components/GameShell.svelte';
	import Grid from '$lib/components/Grid.svelte';
	import PieceTray from '$lib/components/PieceTray.svelte';
	import { firstPlay } from '$lib/services/tutorial';

	const game = new BlocksGame();
	const reducedMotion = prefersReducedMotion();

	let showTutorial = $state(false);
	onMount(() => {
		showTutorial = firstPlay('blocks');
	});

	let gridRef: Grid | undefined = $state();
	let aim = $state<{ row: number; col: number } | null>(null);
	/** A short hint after a tap that did nothing; the id replays the pop-in */
	let notice = $state<{ text: string; id: number } | null>(null);
	let noticeId = 0;

	const preview = $derived(aim && game.selectedPiece ? game.preview(aim.row, aim.col) : null);

	// Dragging a tray piece onto the board: a press below DRAG_THRESHOLD of movement is left to the
	// tray's own click handling (tap-to-select); crossing it promotes to a real drag that follows the
	// pointer and drives the same aim/preview/place pipeline as tap-to-place.
	const DRAG_THRESHOLD = 6;
	let dragCandidate = $state<{
		index: number;
		pointerId: number;
		startX: number;
		startY: number;
	} | null>(null);
	let drag = $state<{
		index: number;
		piece: Piece;
		pointerId: number;
		x: number;
		y: number;
	} | null>(null);

	function beginDragCandidate(index: number, event: PointerEvent) {
		if (game.over || !game.tray[index]) return;
		dragCandidate = {
			index,
			pointerId: event.pointerId,
			startX: event.clientX,
			startY: event.clientY
		};
	}

	function windowPointerMove(event: PointerEvent) {
		if (drag && event.pointerId === drag.pointerId) {
			event.preventDefault();
			drag = { ...drag, x: event.clientX, y: event.clientY };
			aim = gridRef?.cellAt(event.clientX, event.clientY) ?? null;
			return;
		}
		if (!dragCandidate || event.pointerId !== dragCandidate.pointerId) return;
		const moved = Math.hypot(
			event.clientX - dragCandidate.startX,
			event.clientY - dragCandidate.startY
		);
		if (moved < DRAG_THRESHOLD) return;
		const piece = game.tray[dragCandidate.index];
		if (!piece) {
			dragCandidate = null;
			return;
		}
		game.select(dragCandidate.index);
		drag = {
			index: dragCandidate.index,
			piece,
			pointerId: event.pointerId,
			x: event.clientX,
			y: event.clientY
		};
		dragCandidate = null;
		aim = gridRef?.cellAt(event.clientX, event.clientY) ?? null;
	}

	function windowPointerUp(event: PointerEvent) {
		if (drag && event.pointerId === drag.pointerId) {
			const cell = gridRef?.cellAt(event.clientX, event.clientY) ?? null;
			drag = null;
			if (cell) place(cell.row, cell.col);
			else {
				game.select(null);
				aim = null;
			}
			return;
		}
		if (dragCandidate?.pointerId === event.pointerId) dragCandidate = null;
	}

	function windowPointerCancel(event: PointerEvent) {
		if (drag?.pointerId === event.pointerId) {
			drag = null;
			aim = null;
		}
		if (dragCandidate?.pointerId === event.pointerId) dragCandidate = null;
	}

	const MOOD_POSE: Record<typeof game.mood, MascotPose> = {
		winning: 'smug',
		danger: 'sweating',
		neutral: 'idle'
	};

	function place(row: number, col: number) {
		const outcome = game.place(row, col);
		if (outcome === 'placed') {
			notice = null;
			return;
		}
		notice = {
			text: outcome === 'blocked' ? m.blocks_does_not_fit() : m.blocks_pick_first(),
			id: ++noticeId
		};
	}

	function select(index: number) {
		game.select(index);
		notice = null;
	}

	function retry() {
		aim = null;
		notice = null;
		game.newGame();
	}

	function keyDown(event: KeyboardEvent) {
		if (game.over || event.ctrlKey || event.metaKey || event.altKey) return;
		const slot = ['1', '2', '3'].indexOf(event.key);
		if (slot >= 0) {
			event.preventDefault();
			select(slot);
		} else if (event.key === 'Escape') {
			game.select(null);
		}
	}

	/** Draws the final board onto the share card */
	function drawBoard(context: CanvasRenderingContext2D, x: number, y: number, size: number) {
		const board = game.board;
		const gap = 6;
		const cell = (size - gap * (board.size + 1)) / board.size;
		context.fillStyle = '#7c8c5c';
		context.fillRect(x, y, size, size);
		context.lineWidth = 4;
		context.strokeStyle = '#111111';
		board.cells.forEach((kind, index) => {
			const cellX = x + gap + (index % board.size) * (cell + gap);
			const cellY = y + gap + Math.floor(index / board.size) * (cell + gap);
			context.fillStyle = kind ? KIND_HEX[kind] : '#8e9c6e';
			context.fillRect(cellX, cellY, cell, cell);
			if (kind) context.strokeRect(cellX, cellY, cell, cell);
		});
	}
</script>

<svelte:window
	onkeydown={keyDown}
	onpointermove={windowPointerMove}
	onpointerup={windowPointerUp}
	onpointercancel={windowPointerCancel}
/>

<GameShell title={m.mode_blocks_name()} score={game.score} best={game.best}>
	<div class="flex items-end gap-3">
		<CharacterMascot pose={MOOD_POSE[game.mood]} class="w-16 shrink-0 -rotate-3 sm:w-20" />
		<div
			class="relative min-h-16 flex-1 rounded-[14px_8px_12px_6px] border-3 border-ink bg-paper px-3 py-2 shadow-[3px_3px_0_var(--color-ink)]"
			role="status"
		>
			{#if game.feedback}
				{#key game.feedback.id}
					<p class="pop-in flex flex-wrap items-baseline gap-x-2 font-display text-lg font-bold">
						<span>
							{game.feedback.lines > 1
								? m.blocks_lines_cleared({ lines: game.feedback.lines })
								: m.blocks_line_cleared()}
						</span>
						<span class="text-tie-red" dir="ltr">
							{m.blocks_points({ points: game.feedback.points })}
						</span>
						{#if game.feedback.streak > 1}
							<span class="rotate-2 rounded-md border-2 border-ink bg-explosion-yellow px-1.5">
								{m.blocks_combo({ streak: game.feedback.streak })}
							</span>
						{/if}
					</p>
				{/key}
			{:else if notice}
				{#key notice.id}
					<p class="pop-in font-bold text-tie-red">{notice.text}</p>
				{/key}
			{:else if showTutorial}
				<p class="text-sm leading-snug">{m.blocks_instructions()}</p>
			{/if}
		</div>
	</div>

	<Grid
		bind:this={gridRef}
		board={game.board}
		{preview}
		feedback={game.feedback}
		{reducedMotion}
		onaim={(cell) => (aim = cell)}
		onplace={place}
	/>

	<PieceTray
		tray={game.tray}
		fits={game.fits}
		selected={game.selected}
		disabled={game.over}
		onselect={select}
		ondragstart={beginDragCandidate}
	/>

	{#if showTutorial}
		<p class="hidden text-center text-xs sm:block">{m.blocks_keyboard_hint()}</p>
	{/if}
</GameShell>

{#if drag}
	<div
		class="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 opacity-90"
		style:left="{drag.x}px"
		style:top="{drag.y}px"
	>
		<span
			data-playfield
			class="grid gap-[2px]"
			style:grid-template-columns="repeat({drag.piece.width}, 2.5rem)"
			style:grid-template-rows="repeat({drag.piece.height}, 2.5rem)"
		>
			{#each drag.piece.cells as [row, col] (`${row},${col}`)}
				<span style:grid-row={row + 1} style:grid-column={col + 1}>
					<BlocksCell kind={drag.piece.kind} class="size-10" />
				</span>
			{/each}
		</span>
	</div>
{/if}

<GameOverModal
	open={game.over}
	score={game.score}
	modeName={m.mode_blocks_name()}
	isNewBest={game.isNewBest}
	{drawBoard}
	onRetry={retry}
>
	<dl class="grid grid-cols-3 gap-2 text-center">
		<div class="rounded-lg border-2 border-ink bg-sand p-1">
			<dt class="text-xs font-bold">{m.blocks_stat_lines()}</dt>
			<dd class="font-display text-xl font-bold tabular-nums">{game.linesCleared}</dd>
		</div>
		<div class="rounded-lg border-2 border-ink bg-sand p-1">
			<dt class="text-xs font-bold">{m.blocks_stat_pieces()}</dt>
			<dd class="font-display text-xl font-bold tabular-nums">{game.piecesPlaced}</dd>
		</div>
		<div class="rounded-lg border-2 border-ink bg-sand p-1">
			<dt class="text-xs font-bold">{m.blocks_stat_streak()}</dt>
			<dd class="font-display text-xl font-bold tabular-nums">{game.longestStreak}</dd>
		</div>
	</dl>
</GameOverModal>
