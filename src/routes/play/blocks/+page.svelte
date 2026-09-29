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
	// tray's own click handling (tap-to-select); crossing it promotes to a real drag. The piece is drawn
	// at board-cell size and the spot it lands on is worked out from where the piece itself is (not
	// from the fingertip), so the ghost on the board always matches what the player sees.
	// The drag runs until the pointer is released: moving over full cells, other pieces or off the
	// board only changes the preview, it never cancels the drag.
	const DRAG_THRESHOLD = 6;
	/** Ignore the click a browser may still fire on the tray right after a drag ended */
	const CLICK_AFTER_DRAG_MS = 400;
	let dragCandidate = $state<{
		index: number;
		pointerId: number;
		pointerType: string;
		startX: number;
		startY: number;
	} | null>(null);
	let drag = $state<{
		index: number;
		piece: Piece;
		pointerId: number;
		x: number;
		y: number;
		/** Board cell size and gap in pixels, measured when the drag began */
		cell: number;
		gap: number;
		/** How far the piece is held above the pointer, so a fingertip never covers it */
		lift: number;
	} | null>(null);
	let dragEndedAt = 0;
	let pendingPoint: { x: number; y: number } | null = null;
	let frameRequest = 0;

	/** The board cell the dragged piece's top-left corner is closest to, or null when it is off the board */
	function aimFor(current: NonNullable<typeof drag>) {
		const board = gridRef?.metrics();
		if (!board) return null;
		const { piece, cell, gap } = current;
		const pitch = cell + gap;
		const width = piece.width * pitch - gap;
		const height = piece.height * pitch - gap;
		const left = current.x - width / 2;
		const top = current.y - current.lift - height / 2;
		// At least half a cell of the piece has to hang over the board
		const margin = pitch / 2;
		const overlaps =
			left + width > board.left + margin &&
			left < board.left + board.width - margin &&
			top + height > board.top + margin &&
			top < board.top + board.height - margin;
		if (!overlaps) return null;
		return {
			col: Math.round((left - board.left) / pitch),
			row: Math.round((top - board.top) / pitch)
		};
	}

	function moveDrag(x: number, y: number) {
		if (!drag) return;
		drag = { ...drag, x, y };
		aim = aimFor(drag);
	}

	/** Applies at most one pointer position per frame, however often the browser reports moves */
	function queueDragMove(x: number, y: number) {
		pendingPoint = { x, y };
		if (frameRequest) return;
		frameRequest = requestAnimationFrame(() => {
			frameRequest = 0;
			const point = pendingPoint;
			pendingPoint = null;
			if (point) moveDrag(point.x, point.y);
		});
	}

	function stopDrag() {
		cancelAnimationFrame(frameRequest);
		frameRequest = 0;
		pendingPoint = null;
		drag = null;
		dragEndedAt = performance.now();
	}

	function beginDragCandidate(index: number, event: PointerEvent) {
		if (game.over || !game.tray[index]) return;
		dragCandidate = {
			index,
			pointerId: event.pointerId,
			pointerType: event.pointerType,
			startX: event.clientX,
			startY: event.clientY
		};
	}

	function windowPointerMove(event: PointerEvent) {
		if (drag && event.pointerId === drag.pointerId) {
			event.preventDefault();
			queueDragMove(event.clientX, event.clientY);
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
		// Select without toggling: dragging a piece that was already tapped must keep it selected
		if (game.selected !== dragCandidate.index) game.select(dragCandidate.index);
		notice = null;
		const board = gridRef?.metrics();
		const cell = board?.cell ?? 40;
		const gap = board?.gap ?? 3;
		drag = {
			index: dragCandidate.index,
			piece,
			pointerId: event.pointerId,
			x: event.clientX,
			y: event.clientY,
			cell,
			gap,
			lift: dragCandidate.pointerType === 'mouse' ? 0 : (piece.height / 2 + 0.75) * (cell + gap)
		};
		dragCandidate = null;
		aim = aimFor(drag);
	}

	function windowPointerUp(event: PointerEvent) {
		if (drag && event.pointerId === drag.pointerId) {
			const target = aimFor({ ...drag, x: event.clientX, y: event.clientY });
			stopDrag();
			aim = null;
			if (target) place(target.row, target.col);
			else game.select(null);
			return;
		}
		if (dragCandidate?.pointerId === event.pointerId) dragCandidate = null;
	}

	function windowPointerCancel(event: PointerEvent) {
		if (drag?.pointerId === event.pointerId) {
			stopDrag();
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

	function traySelect(index: number) {
		if (performance.now() - dragEndedAt < CLICK_AFTER_DRAG_MS) return;
		select(index);
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
		onselect={traySelect}
		ondragstart={beginDragCandidate}
	/>

	{#if showTutorial}
		<p class="hidden text-center text-xs sm:block">{m.blocks_keyboard_hint()}</p>
	{/if}
</GameShell>

{#if drag}
	{@const pitch = drag.cell + drag.gap}
	{@const width = drag.piece.width * pitch - drag.gap}
	{@const height = drag.piece.height * pitch - drag.gap}
	<div
		class="pointer-events-none fixed top-0 left-0 z-50 will-change-transform"
		style:transform="translate3d({drag.x - width / 2}px, {drag.y - drag.lift - height / 2}px, 0)"
	>
		<span
			data-playfield
			class="blocks-drag-piece grid opacity-90 drop-shadow-[3px_5px_0_rgb(0_0_0_/_0.35)]"
			style:gap="{drag.gap}px"
			style:grid-template-columns="repeat({drag.piece.width}, {drag.cell}px)"
			style:grid-template-rows="repeat({drag.piece.height}, {drag.cell}px)"
		>
			{#each drag.piece.cells as [row, col] (`${row},${col}`)}
				<span style:grid-row={row + 1} style:grid-column={col + 1}>
					<BlocksCell kind={drag.piece.kind} class="w-full" />
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

<style>
	/* The piece grows from the tray to board size when it is picked up */
	@keyframes blocks-drag-pickup {
		from {
			scale: 0.55;
		}
		to {
			scale: 1;
		}
	}

	.blocks-drag-piece {
		animation: blocks-drag-pickup 140ms var(--ease-spring) both;
	}

	@media (prefers-reduced-motion: reduce) {
		.blocks-drag-piece {
			animation: none;
		}
	}
</style>
