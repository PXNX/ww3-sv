<!--
	Pipeline Panic board (requirements Section 7): the pumping station above the grid, the pipe
	tiles, the export terminal below, warning markers for incoming strikes, and hit effects.
	Input: tap a tile to turn it, hold a broken tile to repair it, tap a warning marker to
	intercept. Keyboard: arrow keys move between tiles, Enter or Space turns, holding R (or Enter
	or Space) on a broken tile repairs, I intercepts the strike on the focused tile.
	The playing field never mirrors in right-to-left languages.
-->
<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import { cellCol, cellRow, stationCell } from '$lib/game/pipeline/pipeGrid';
	import type { Strike } from '$lib/game/pipeline/strikes';
	import { openings, type Direction, type TileKind } from '$lib/game/pipeline/tiles';
	import type { PipelineView } from '$lib/stores/pipelineGame.svelte';
	import { explosionFrames, spriteSrc } from '$lib/theme/sprites';
	import PipelineLandmark from './PipelineLandmark.svelte';
	import PipelineStrikeIcon from './PipelineStrikeIcon.svelte';
	import PipelineTile from './PipelineTile.svelte';

	let {
		view,
		gameId,
		reducedMotion,
		disabled,
		onRotate,
		onRepairStart,
		onRepairEnd,
		onIntercept
	}: {
		view: PipelineView;
		gameId: number;
		reducedMotion: boolean;
		disabled: boolean;
		onRotate: (cell: number) => void;
		onRepairStart: (cell: number) => void;
		onRepairEnd: () => void;
		onIntercept: (strikeId: number) => void;
	} = $props();

	let board: HTMLDivElement | undefined = $state();

	const grid = $derived(view.grid);
	const columns = $derived(`repeat(${grid.cols}, minmax(0, 1fr))`);
	const strikeByCell = $derived(new Map(view.strikes.map((strike) => [strike.cell, strike])));
	const canIntercept = $derived(view.charges > 0 && !disabled);
	const explosion = explosionFrames()[0];

	const KIND_NAMES: Record<TileKind, () => string> = {
		straight: m.pipeline_kind_straight,
		elbow: m.pipeline_kind_elbow,
		tee: m.pipeline_kind_tee,
		cross: m.pipeline_kind_cross
	};
	const DIRECTION_NAMES: Record<Direction, () => string> = {
		0: m.pipeline_dir_up,
		1: m.pipeline_dir_right,
		2: m.pipeline_dir_down,
		3: m.pipeline_dir_left
	};

	function tileLabel(cell: number): string {
		const tile = grid.tiles[cell];
		const status = strikeByCell.has(cell)
			? m.pipeline_status_targeted()
			: tile.broken
				? m.pipeline_status_broken()
				: view.flow.filled[cell]
					? m.pipeline_status_flowing()
					: m.pipeline_status_dry();
		return m.pipeline_tile_label({
			row: cellRow(grid, cell) + 1,
			column: cellCol(grid, cell) + 1,
			kind: KIND_NAMES[tile.kind](),
			openings: openings(tile.kind, tile.rotation)
				.map((direction) => DIRECTION_NAMES[direction]())
				.join(', '),
			status
		});
	}

	function focusCell(cell: number) {
		board?.querySelector<HTMLButtonElement>(`[data-cell="${cell}"]`)?.focus();
	}

	const MOVES: Record<string, [number, number]> = {
		ArrowUp: [-1, 0],
		ArrowDown: [1, 0],
		ArrowLeft: [0, -1],
		ArrowRight: [0, 1]
	};

	const REPAIR_KEYS = ['r', 'R', 'Enter', ' '];

	/** The tile a press started repairing: its click must not turn the freshly repaired pipe */
	let repairPress: number | null = null;

	function onKeyDown(event: KeyboardEvent, cell: number) {
		const move = MOVES[event.key];
		if (move) {
			event.preventDefault();
			const row = cellRow(grid, cell) + move[0];
			const col = cellCol(grid, cell) + move[1];
			if (row >= 0 && row < grid.rows && col >= 0 && col < grid.cols) {
				focusCell(row * grid.cols + col);
			}
			return;
		}
		if (disabled) return;
		if (event.key === 'i' || event.key === 'I') {
			const strike = strikeByCell.get(cell);
			if (strike) onIntercept(strike.id);
			return;
		}
		if (!REPAIR_KEYS.includes(event.key)) return;
		if (event.repeat) {
			// A held key never turns pipes over and over, even once the repair has finished
			event.preventDefault();
		} else if (grid.tiles[cell].broken) {
			// Holding the key repairs; stop Enter and Space from also clicking the button
			event.preventDefault();
			repairPress = cell;
			onRepairStart(cell);
		}
	}

	function onKeyUp(event: KeyboardEvent) {
		if (!REPAIR_KEYS.includes(event.key)) return;
		if (repairPress !== null) {
			// Space clicks on release; the press was a repair, not a turn
			event.preventDefault();
			repairPress = null;
		}
		onRepairEnd();
	}

	function onPointerDown(event: PointerEvent, cell: number) {
		repairPress = null;
		if (disabled || !grid.tiles[cell].broken) return;
		(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
		repairPress = cell;
		onRepairStart(cell);
	}

	function onClick(cell: number) {
		const wasRepair = repairPress === cell;
		repairPress = null;
		if (!disabled && !wasRepair && !grid.tiles[cell].broken) onRotate(cell);
	}

	function approach(strike: Strike): number {
		return 1 - Math.max(0, strike.remainingMs) / strike.warningMs;
	}

	const markerRing = 2 * Math.PI * 44;
</script>

<div data-playfield class="mx-auto flex w-full max-w-[32rem] flex-col select-none">
	<div class="grid gap-1 px-2" style:grid-template-columns={columns}>
		{#each { length: grid.cols }, col (col)}
			<div class="aspect-[5/4]">
				{#if col === grid.stationCol}
					<PipelineLandmark
						kind="station"
						active={view.flow.filled[stationCell(grid)]}
						label={m.pipeline_station()}
					/>
				{/if}
			</div>
		{/each}
	</div>

	<div
		bind:this={board}
		role="group"
		aria-label={m.pipeline_board_label()}
		class="grid gap-1 rounded-[14px_8px_16px_10px] border-3 border-ink bg-khaki p-2 shadow-[4px_4px_0_var(--color-ink)]"
		style:grid-template-columns={columns}
	>
		{#each grid.tiles as tile, cell (`${gameId}:${cell}`)}
			{@const strike = strikeByCell.get(cell)}
			<div class="relative aspect-square">
				<button
					type="button"
					data-cell={cell}
					class="tile size-full touch-manipulation rounded-[8px_5px_9px_6px] border-2 border-ink focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-tie-red focus-visible:outline-dashed {tile.broken
						? 'border-dashed bg-skin'
						: 'bg-sand'}"
					aria-label={tileLabel(cell)}
					aria-disabled={disabled}
					onclick={() => onClick(cell)}
					onpointerdown={(event) => onPointerDown(event, cell)}
					onpointerup={onRepairEnd}
					onpointercancel={onRepairEnd}
					onlostpointercapture={onRepairEnd}
					oncontextmenu={(event) => event.preventDefault()}
					onkeydown={(event) => onKeyDown(event, cell)}
					onkeyup={onKeyUp}
				>
					<PipelineTile
						kind={tile.kind}
						rotation={tile.rotation}
						filled={view.flow.filled[cell]}
						broken={tile.broken}
						repair={tile.repair}
						repairing={view.repairing === cell}
						{reducedMotion}
					/>
				</button>

				{#if strike}
					{@const progress = approach(strike)}
					<!-- The button fills the whole tile so the tap target stays comfortable even on a
						 small hard-difficulty board; only the ring, icon and badge inside are visually inset. -->
					<button
						type="button"
						class="marker absolute inset-0 touch-manipulation rounded-full focus-visible:outline-3 focus-visible:outline-tie-red focus-visible:outline-dashed"
						style:pointer-events={canIntercept ? 'auto' : 'none'}
						tabindex={canIntercept ? 0 : -1}
						aria-label={strike.kind === 'drone'
							? m.pipeline_intercept_drone()
							: m.pipeline_intercept_rocket()}
						onclick={() => onIntercept(strike.id)}
					>
						<span class="pointer-events-none absolute inset-[8%]" aria-hidden="true">
							<svg viewBox="0 0 100 100" class="absolute inset-0 size-full">
								<circle
									cx="50"
									cy="50"
									r="44"
									fill="rgb(229 72 77 / 0.25)"
									stroke="#e5484d"
									stroke-width="6"
									stroke-dasharray="10 7"
								/>
								<circle
									cx="50"
									cy="50"
									r="44"
									fill="none"
									stroke="#111111"
									stroke-width="4"
									stroke-dasharray="{markerRing * (1 - progress)} {markerRing}"
									transform="rotate(-90 50 50)"
								/>
								<path d="M50 30 V70 M30 50 H70" stroke="#111111" stroke-width="4" />
							</svg>
							<PipelineStrikeIcon
								kind={strike.kind}
								class="absolute inset-[18%] size-[64%] drop-shadow-none"
							/>
							<span
								class="absolute -top-1 -right-1 grid size-5 place-items-center rounded-full border-2 border-ink bg-explosion-yellow text-xs leading-none font-bold"
								>!</span
							>
							{#if canIntercept}
								<img
									src={spriteSrc('patriotLauncher')}
									alt=""
									class="absolute -bottom-1 -left-1 w-6 rounded-sm border-2 border-ink bg-paper"
									draggable="false"
								/>
							{/if}
						</span>
					</button>
					{#if !reducedMotion}
						<!-- The incoming machine drops towards the target as the warning runs out -->
						<div
							class="pointer-events-none absolute inset-x-[25%] top-0 aspect-square"
							style:translate="0 {-90 + progress * 60}%"
							style:opacity={0.35 + progress * 0.5}
							aria-hidden="true"
						>
							<PipelineStrikeIcon kind={strike.kind} class="size-full" />
						</div>
					{/if}
				{/if}
				{#each view.effects.filter((effect) => effect.cell === cell) as effect (effect.id)}
					<div
						class="pointer-events-none absolute inset-0 z-10 grid place-items-center"
						aria-hidden="true"
					>
						{#if effect.kind === 'impact'}
							<img src={explosion} alt="" class="pop-in absolute inset-0 size-full" />
							<span
								class="pop-in relative -rotate-6 rounded-md border-2 border-ink bg-paper px-1 text-xs font-bold"
								>{m.pipeline_effect_hit()}</span
							>
						{:else}
							<span
								class="pop-in relative rotate-3 rounded-md border-2 border-ink bg-flag-blue px-1 text-xs font-bold"
								>{m.pipeline_effect_intercepted()}</span
							>
						{/if}
					</div>
				{/each}
			</div>
		{/each}
	</div>

	<div class="grid gap-1 px-2" style:grid-template-columns={columns}>
		{#each { length: grid.cols }, col (col)}
			<div class="aspect-[5/4]">
				{#if col === grid.terminalCol}
					<PipelineLandmark
						kind="terminal"
						active={view.flow.reachesTerminal}
						label={m.pipeline_terminal()}
					/>
				{/if}
			</div>
		{/each}
	</div>
</div>
