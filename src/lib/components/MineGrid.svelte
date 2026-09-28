<!--
	Minefield board: flag-blue water until revealed, sand once safe. Sonar numbers sit on shapes that
	differ per number as well as by color, so they stay readable with color-vision deficiency.
	Tap uses the selected tool; long-press, right-click or the F key place a buoy flag; arrow keys
	move between cells. After a win the surviving tankers sail along the channel.
-->
<script lang="ts" module>
	/** Shape and colors behind each sonar number, from the design tokens */
	const SONAR: Record<number, { points?: string; fill: string; text: string; textY?: number }> = {
		1: { fill: '#4fa8d8', text: '#111111' },
		2: { points: '14,14 86,14 86,86 14,86', fill: '#7c8c5c', text: '#111111' },
		3: { points: '50,6 95,90 5,90', fill: '#e5484d', text: '#111111', textY: 64 },
		4: { points: '50,3 97,50 50,97 3,50', fill: '#ddb93c', text: '#111111' },
		5: { points: '50,4 96,38 78,93 22,93 4,38', fill: '#6a7c9b', text: '#ffffff', textY: 57 },
		6: { points: '27,8 73,8 96,50 73,92 27,92 4,50', fill: '#f6c9a0', text: '#111111' },
		7: {
			points: '50,2 62,35 97,36 69,57 79,92 50,72 21,92 31,57 3,36 38,35',
			fill: '#aeb4be',
			text: '#111111',
			textY: 56
		},
		8: { points: '30,3 70,3 97,30 97,70 70,97 30,97 3,70 3,30', fill: '#111111', text: '#ffffff' }
	};

	/** Starburst behind a detonated mine: yellow core with red ray tips */
	const BURST = Array.from({ length: 16 }, (_, point) => {
		const radius = point % 2 === 0 ? 49 : 27;
		const angle = (point / 16) * Math.PI * 2;
		return `${50 + radius * Math.cos(angle)},${50 + radius * Math.sin(angle)}`;
	}).join(' ');

	const LONG_PRESS_MS = 450;
	const MOVE_TOLERANCE_PX = 10;
	const CONVOY_STEP_MS = 170;
	const CONVOY_GAP_MS = 520;

	/** How long the convoy animation takes, so the page can show the victory screen afterwards */
	export function convoyDurationMs(pathLength: number, tankers: number): number {
		return (pathLength + 2) * CONVOY_STEP_MS + Math.max(0, tankers - 1) * CONVOY_GAP_MS;
	}
</script>

<script lang="ts">
	import type { Attachment } from 'svelte/attachments';
	import { prefersReducedMotion } from '$lib/game/loop';
	import { cellPosition, type GridSize } from '$lib/game/minefield/grid';
	import type { Board, Cell } from '$lib/game/minefield/minefieldBoard';
	import { m } from '$lib/paraglide/messages';
	import type { MinefieldPhase, MinefieldTool } from '$lib/stores/minefieldGame.svelte';
	import { spriteSrc } from '$lib/theme/sprites';
	import MinefieldBuoy from './MinefieldBuoy.svelte';
	import IconCheck from '~icons/lucide/check';
	import IconX from '~icons/lucide/x';

	let {
		board,
		phase,
		tool,
		channel,
		explosionId,
		convoyTankers,
		onactivate,
		onflag
	}: {
		board: Board;
		phase: MinefieldPhase;
		tool: MinefieldTool;
		channel: readonly number[] | null;
		/** Changes on every explosion, which shakes the board */
		explosionId: number | null;
		convoyTankers: number;
		onactivate: (index: number) => void;
		onflag: (index: number) => void;
	} = $props();

	const buttons: HTMLButtonElement[] = $state([]);
	let frame: HTMLDivElement | undefined = $state();
	let focusIndex = $state(0);
	const channelCells = $derived(new Set(channel ?? []));
	const showMines = $derived(phase === 'lost');
	const interactive = $derived(phase === 'ready' || phase === 'playing');
	const reducedMotion = prefersReducedMotion();

	// Shake the board on every explosion (never with reduced motion)
	$effect(() => {
		if (explosionId === null || !frame || reducedMotion) return;
		frame.animate(
			[
				{ translate: '0 0' },
				{ translate: '-6px 2px' },
				{ translate: '5px -3px' },
				{ translate: '-3px 1px' },
				{ translate: '0 0' }
			],
			{ duration: 360, easing: 'ease-out' }
		);
	});

	function label(cell: Cell, index: number): string {
		const { column, row } = cellPosition(board, index);
		const where = { row: row + 1, column: column + 1 };
		if (cell.state === 'detonated') return m.minefield_cell_detonated(where);
		if (cell.state === 'flagged') {
			return showMines && !cell.mine
				? m.minefield_cell_wrong_flag(where)
				: m.minefield_cell_flagged(where);
		}
		if (cell.state === 'hidden') {
			return showMines && cell.mine ? m.minefield_cell_mine(where) : m.minefield_cell_hidden(where);
		}
		return cell.adjacent === 0
			? m.minefield_cell_empty(where)
			: m.minefield_cell_number({ ...where, count: cell.adjacent });
	}

	// Long-press places a buoy; the click that follows the press is then ignored
	let pressTimer: ReturnType<typeof setTimeout> | undefined;
	let pressOrigin = { x: 0, y: 0 };
	let longPressed = false;

	function cancelPress() {
		clearTimeout(pressTimer);
		pressTimer = undefined;
	}

	function onpointerdown(event: PointerEvent, index: number) {
		longPressed = false;
		cancelPress();
		if (!interactive || (event.pointerType === 'mouse' && event.button !== 0)) return;
		pressOrigin = { x: event.clientX, y: event.clientY };
		pressTimer = setTimeout(() => {
			longPressed = true;
			pressTimer = undefined;
			onflag(index);
			navigator.vibrate?.(15);
		}, LONG_PRESS_MS);
	}

	function onpointermove(event: PointerEvent) {
		if (pressTimer === undefined) return;
		const distance = Math.hypot(event.clientX - pressOrigin.x, event.clientY - pressOrigin.y);
		if (distance > MOVE_TOLERANCE_PX) cancelPress();
	}

	function onclick(index: number) {
		cancelPress();
		if (longPressed) {
			longPressed = false;
			return;
		}
		onactivate(index);
	}

	function oncontextmenu(event: MouseEvent, index: number) {
		event.preventDefault();
		cancelPress();
		// Some mobile browsers report a long-press as a context menu too
		if (longPressed || !interactive) return;
		onflag(index);
	}

	function moveFocus(size: GridSize, index: number, key: string): number | null {
		const { column, row } = cellPosition(size, index);
		switch (key) {
			case 'ArrowRight':
				return column < size.columns - 1 ? index + 1 : null;
			case 'ArrowLeft':
				return column > 0 ? index - 1 : null;
			case 'ArrowDown':
				return row < size.rows - 1 ? index + size.columns : null;
			case 'ArrowUp':
				return row > 0 ? index - size.columns : null;
			case 'Home':
				return index - column;
			case 'End':
				return index - column + size.columns - 1;
			default:
				return null;
		}
	}

	function onkeydown(event: KeyboardEvent, index: number) {
		if (event.key === 'f' || event.key === 'F') {
			event.preventDefault();
			if (interactive) onflag(index);
			return;
		}
		const next = moveFocus(board, index, event.key);
		if (next === null) return;
		event.preventDefault();
		focusIndex = next;
		buttons[next]?.focus();
	}

	/** Moves one tanker from the western edge along the channel and out to the open sea */
	function sail(order: number): Attachment<HTMLElement> {
		return (element) => {
			if (!channel || channel.length === 0) return;
			const toPoint = (column: number, row: number) => ({
				left: `${((column + 0.5) / board.columns) * 100}%`,
				top: `${((row + 0.5) / board.rows) * 100}%`
			});
			const first = cellPosition(board, channel[0]);
			const last = cellPosition(board, channel[channel.length - 1]);
			const frames = [
				toPoint(-1.5, first.row),
				...channel.map((index) => {
					const { column, row } = cellPosition(board, index);
					return toPoint(column, row);
				}),
				toPoint(board.columns + 1.5, last.row)
			];
			const animation = element.animate(frames, {
				duration: (channel.length + 2) * CONVOY_STEP_MS,
				delay: order * CONVOY_GAP_MS,
				fill: 'both',
				easing: 'linear'
			});
			return () => animation.cancel();
		};
	}
</script>

<div
	bind:this={frame}
	class="relative overflow-hidden rounded-[10px_6px_12px_8px] border-3 border-ink bg-ink shadow-[4px_4px_0_var(--color-ink)]"
>
	<div class="overflow-x-auto">
		<div class="relative">
			<div
				role="group"
				aria-label={m.minefield_board_label({ columns: board.columns, rows: board.rows })}
				class="grid gap-[3px] p-[3px] {tool === 'submarine' && interactive
					? 'cursor-crosshair'
					: ''}"
				style:grid-template-columns="repeat({board.columns}, minmax(1.75rem, 1fr))"
			>
				{#each board.cells as cell, index (index)}
					{@const hidden = cell.state === 'hidden' || cell.state === 'flagged'}
					{@const sonar = SONAR[cell.adjacent]}
					<button
						type="button"
						bind:this={buttons[index]}
						class="cell relative flex aspect-square items-center justify-center rounded-[4px] {hidden
							? 'bg-flag-blue'
							: cell.state === 'detonated'
								? 'bg-tie-red'
								: channelCells.has(index)
									? 'bg-paper'
									: 'bg-sand'}"
						class:hidden-water={hidden && interactive}
						tabindex={index === focusIndex ? 0 : -1}
						aria-label={label(cell, index)}
						onfocus={() => (focusIndex = index)}
						onclick={() => onclick(index)}
						oncontextmenu={(event) => oncontextmenu(event, index)}
						onpointerdown={(event) => onpointerdown(event, index)}
						{onpointermove}
						onpointerup={cancelPress}
						onpointercancel={cancelPress}
						onpointerleave={cancelPress}
						onkeydown={(event) => onkeydown(event, index)}
					>
						{#if cell.state === 'flagged'}
							<MinefieldBuoy class="pop-in size-[78%]" />
							{#if showMines && !cell.mine}
								<IconX class="absolute size-[80%] text-ink" stroke-width="3.5" aria-hidden="true" />
							{/if}
						{:else if cell.state === 'hidden'}
							{#if showMines && cell.mine}
								<img src={spriteSrc('mine')} alt="" class="size-[72%]" draggable="false" />
							{:else}
								<svg viewBox="0 0 40 20" class="w-[46%] opacity-60" aria-hidden="true">
									<path
										d="M3 12 Q10 4 17 12 T31 12 T38 9"
										fill="none"
										stroke="#ffffff"
										stroke-width="4"
										stroke-linecap="round"
									/>
								</svg>
							{/if}
						{:else if cell.state === 'detonated'}
							<svg viewBox="0 0 100 100" class="pop-in absolute size-full" aria-hidden="true">
								<polygon points={BURST} fill="#f5c83a" stroke="#111111" stroke-width="5" />
							</svg>
							<img
								src={spriteSrc('mine')}
								alt=""
								class="relative size-[58%] -rotate-12"
								draggable="false"
							/>
						{:else if sonar}
							<svg viewBox="0 0 100 100" class="size-[84%]" aria-hidden="true">
								{#if sonar.points}
									<polygon
										points={sonar.points}
										fill={sonar.fill}
										stroke="#111111"
										stroke-width="7"
										stroke-linejoin="round"
									/>
								{:else}
									<circle
										cx="50"
										cy="50"
										r="44"
										fill={sonar.fill}
										stroke="#111111"
										stroke-width="7"
									/>
								{/if}
								<text
									x="50"
									y={sonar.textY ?? 52}
									text-anchor="middle"
									dominant-baseline="central"
									fill={sonar.text}
									font-size="54"
									font-weight="700"
									class="font-display">{cell.adjacent}</text
								>
							</svg>
						{/if}
						{#if cell.defused}
							<span
								class="absolute end-0 top-0 flex size-[40%] items-center justify-center rounded-bl-[4px] bg-khaki"
								aria-hidden="true"
							>
								<IconCheck class="size-full text-ink" stroke-width="4" />
							</span>
						{/if}
					</button>
				{/each}
			</div>

			{#if phase === 'won' && channel && !reducedMotion}
				<div
					class="pointer-events-none absolute inset-[3px]"
					role="img"
					aria-label={m.minefield_convoy_label()}
				>
					{#each Array.from({ length: convoyTankers }, (_, order) => order) as order (order)}
						<img
							{@attach sail(order)}
							src={spriteSrc('tanker')}
							alt=""
							class="absolute -translate-x-1/2 -translate-y-1/2"
							style:width="{(1.8 / board.columns) * 100}%"
							draggable="false"
						/>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.cell {
		touch-action: manipulation;
		user-select: none;
		-webkit-user-select: none;
		-webkit-touch-callout: none;
		transition: scale 160ms var(--ease-spring);
	}

	.hidden-water {
		cursor: pointer;
	}

	.hidden-water:active {
		scale: 0.88;
	}

	.cell:focus-visible {
		z-index: 1;
		outline: 3px dashed var(--color-explosion-yellow);
		outline-offset: -3px;
		box-shadow: 0 0 0 3px var(--color-ink);
	}

	.cell :global(text) {
		pointer-events: none;
	}

	@media (prefers-reduced-motion: reduce) {
		.cell {
			transition: none;
		}

		.hidden-water:active {
			scale: none;
		}
	}
</style>
