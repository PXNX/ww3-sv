<!--
	The Tanker Parking harbor. Ships slide along their own axis only. Dragging uses the shared
	PointerDrag helper: on press the grab offset is stored, and while dragging the ship sits exactly
	at pointer + offset on its axis, limited to the free water around it (no easing, no lag). On
	release it snaps to the nearest cell, and that slide counts as one move. Every ship can also be
	focused and moved one cell at a time with the arrow keys.
-->
<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { clientToLocal, clamp, PointerDrag, type Rect } from '#lib/game/pointerDrag.js';
	import { TANKER_INDEX } from '#lib/game/parking/board.js';
	import type { ParkingGame } from '#lib/stores/parkingGame.svelte.js';
	import ParkingShip, { kindFor } from './ParkingShip.svelte';
	import IconArrowRight from '~icons/lucide/arrow-right';

	let { game, reducedMotion = false }: { game: ParkingGame; reducedMotion?: boolean } = $props();

	const puzzle = $derived(game.puzzle);
	const exitRow = $derived(puzzle.pieces[TANKER_INDEX].line);

	let boardElement: HTMLDivElement | undefined = $state();
	/** The ship being dragged and where it is along its axis, in (fractional) cells */
	let drag = $state<{ index: number; pos: number } | null>(null);

	/** Everything the pointer math needs, measured once when a ship is grabbed */
	let lane: {
		index: number;
		axis: 'h' | 'v';
		board: Rect;
		/** Top-left corner of the ship in viewport pixels at the press */
		origin: { x: number; y: number };
		/** The free span along the axis, as viewport pixels of the ship's top-left corner */
		minPx: number;
		maxPx: number;
		min: number;
		max: number;
	} | null = null;

	const dragger = new PointerDrag({
		// Axis lock: the ship keeps its row (or column) and never leaves the free water
		constrain: (position) => {
			if (!lane) return position;
			return lane.axis === 'h'
				? { x: clamp(position.x, lane.minPx, lane.maxPx), y: lane.origin.y }
				: { x: lane.origin.x, y: clamp(position.y, lane.minPx, lane.maxPx) };
		},
		onStart: (session) => follow(session.position),
		onMove: (session) => follow(session.position),
		onEnd: (session) => {
			const current = lane;
			follow(session.position);
			const finished = drag;
			drag = null;
			lane = null;
			if (!current || !finished) return;
			const target = clamp(Math.round(finished.pos), current.min, current.max);
			game.move(current.index, target);
		},
		onCancel: () => {
			drag = null;
			lane = null;
		}
	});

	function follow(position: { x: number; y: number }) {
		if (!lane) return;
		const cells = clientToLocal(lane.board, position, {
			width: puzzle.width,
			height: puzzle.height
		});
		drag = { index: lane.index, pos: lane.axis === 'h' ? cells.x : cells.y };
	}

	function grab(index: number, event: PointerEvent) {
		if (game.won || !boardElement) return;
		const element = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
		if (!element) return;
		// Ships are positioned inside the board's border, so measure the padding box. The ship's
		// corner comes from its logical cell, not from its rect, which may still be mid-glide.
		const outer = boardElement.getBoundingClientRect();
		const board: Rect = {
			left: outer.left + boardElement.clientLeft,
			top: outer.top + boardElement.clientTop,
			width: boardElement.clientWidth,
			height: boardElement.clientHeight
		};
		const cellWidth = board.width / puzzle.width;
		const cellHeight = board.height / puzzle.height;
		const { axis, line } = puzzle.pieces[index];
		const { min, max } = game.rangeOf(index);
		const at = game.positions[index];
		const horizontal = axis === 'h';
		lane = {
			index,
			axis,
			board,
			origin: {
				x: board.left + (horizontal ? at : line) * cellWidth,
				y: board.top + (horizontal ? line : at) * cellHeight
			},
			minPx: horizontal ? board.left + min * cellWidth : board.top + min * cellHeight,
			maxPx: horizontal ? board.left + max * cellWidth : board.top + max * cellHeight,
			min,
			max
		};
		if (!dragger.begin(event, { origin: lane.origin, capture: element })) lane = null;
	}

	function move(event: PointerEvent) {
		if (dragger.pointerMove(event) && dragger.dragging) event.preventDefault();
	}

	function keyDown(event: KeyboardEvent) {
		if (event.key === 'Escape' && dragger.active) dragger.abort();
	}

	function shipKey(index: number, event: KeyboardEvent) {
		if (event.ctrlKey || event.metaKey || event.altKey) return;
		const axis = puzzle.pieces[index].axis;
		const keys = axis === 'h' ? { ArrowLeft: -1, ArrowRight: 1 } : { ArrowUp: -1, ArrowDown: 1 };
		const step = keys[event.key as keyof typeof keys];
		if (step === undefined) return;
		event.preventDefault();
		game.move(index, game.positions[index] + step);
	}

	function shown(index: number): number {
		if (drag?.index === index) return drag.pos;
		// Once won, the tanker sails on out of the harbor
		if (game.won && index === TANKER_INDEX) return puzzle.width - puzzle.pieces[index].length + 1;
		return game.positions[index];
	}

	function shipName(index: number): string {
		const kind = kindFor(puzzle.pieces[index].length, index === TANKER_INDEX);
		const name =
			kind === 'tanker'
				? m.parking_ship_tanker()
				: kind === 'freighter'
					? m.parking_ship_freighter()
					: m.parking_ship_patrol();
		return m.parking_ship_label({
			ship: name,
			axis: puzzle.pieces[index].axis === 'h' ? m.parking_axis_h() : m.parking_axis_v()
		});
	}

	const percent = (cells: number, total: number) => `${(cells / total) * 100}%`;
</script>

<svelte:window
	onpointermove={move}
	onpointerup={(event) => dragger.pointerUp(event)}
	onpointercancel={(event) => dragger.pointerCancel(event)}
	onkeydown={keyDown}
/>

<!-- The right-hand margin holds the exit sign and gives the tanker room to sail out -->
<div data-playfield class="relative w-full overflow-x-clip pr-7">
	<div
		bind:this={boardElement}
		data-playfield
		role="group"
		aria-label={m.parking_playfield_label()}
		class="relative w-full touch-none rounded-[10px_6px_12px_8px] border-3 border-ink bg-sky shadow-[4px_4px_0_var(--color-ink)] select-none"
		style:aspect-ratio="{puzzle.width} / {puzzle.height}"
		style:touch-action="none"
	>
		<!-- Water grid -->
		<svg
			class="absolute inset-0 size-full"
			viewBox="0 0 {puzzle.width} {puzzle.height}"
			preserveAspectRatio="none"
			aria-hidden="true"
		>
			{#each { length: puzzle.height }, row (row)}
				{#each { length: puzzle.width }, col (col)}
					<rect
						x={col + 0.04}
						y={row + 0.04}
						width="0.92"
						height="0.92"
						rx="0.12"
						fill="var(--color-paper)"
						fill-opacity={(row + col) % 2 === 0 ? 0.22 : 0.1}
					/>
				{/each}
			{/each}
		</svg>

		{#each puzzle.rocks as [row, col] (`${row},${col}`)}
			<svg
				class="absolute"
				role="img"
				aria-label={m.parking_rock_label()}
				viewBox="0 0 100 100"
				style:left={percent(col, puzzle.width)}
				style:top={percent(row, puzzle.height)}
				style:width={percent(1, puzzle.width)}
				style:height={percent(1, puzzle.height)}
			>
				<path
					d="M 14 78 L 8 54 L 26 26 L 52 14 L 78 24 L 92 52 L 86 78 Z"
					fill="var(--color-banner-slate)"
					stroke="var(--color-ink)"
					stroke-width="5"
					stroke-linejoin="round"
				/>
				<path
					d="M 28 34 L 50 24 L 66 32 M 30 60 L 48 50 L 70 58"
					fill="none"
					stroke="var(--color-paper)"
					stroke-opacity="0.55"
					stroke-width="5"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
			</svg>
		{/each}

		{#each puzzle.pieces as piece, index (index)}
			{@const at = shown(index)}
			{@const dragging = drag?.index === index}
			<div
				role="button"
				tabindex={game.won ? -1 : 0}
				aria-label={shipName(index)}
				class="parking-ship absolute cursor-grab rounded-md p-[2%] focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-ink {dragging
					? 'z-10 cursor-grabbing'
					: ''} {reducedMotion || dragging ? '' : 'parking-ship-glide'} {game.won &&
				index === TANKER_INDEX
					? 'parking-ship-leaving'
					: ''}"
				style:left={piece.axis === 'h'
					? percent(at, puzzle.width)
					: percent(piece.line, puzzle.width)}
				style:top={piece.axis === 'h'
					? percent(piece.line, puzzle.height)
					: percent(at, puzzle.height)}
				style:width={percent(piece.axis === 'h' ? piece.length : 1, puzzle.width)}
				style:height={percent(piece.axis === 'h' ? 1 : piece.length, puzzle.height)}
				onpointerdown={(event) => grab(index, event)}
				onkeydown={(event) => shipKey(index, event)}
			>
				<ParkingShip
					kind={kindFor(piece.length, index === TANKER_INDEX)}
					axis={piece.axis}
					length={piece.length}
					tone={index}
					class="size-full drop-shadow-[2px_3px_0_rgb(0_0_0_/_0.3)]"
				/>
			</div>
		{/each}
	</div>

	<!-- Exit sign: a gap in the harbor wall at the tanker's row -->
	<div
		class="absolute right-0 z-20 flex items-center justify-center rounded-r-md border-3 border-l-0 border-ink bg-explosion-yellow"
		style:top={percent(exitRow, puzzle.height)}
		style:height={percent(1, puzzle.height)}
		style:width="calc(1.75rem + 3px)"
		role="img"
		aria-label={m.parking_exit_label()}
	>
		<IconArrowRight class="size-5" aria-hidden="true" />
	</div>
</div>

<style>
	.parking-ship {
		touch-action: none;
	}

	.parking-ship-glide {
		transition:
			left 120ms ease-out,
			top 120ms ease-out;
	}

	.parking-ship-leaving {
		transition:
			left 650ms ease-in,
			opacity 650ms ease-in;
		opacity: 0;
		pointer-events: none;
	}

	@media (prefers-reduced-motion: reduce) {
		.parking-ship-glide,
		.parking-ship-leaving {
			transition: none;
		}
	}
</style>
