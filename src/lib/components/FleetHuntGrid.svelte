<!--
	Black Sea Fleet Hunt board: flag-blue water until struck, grey with a splash for a miss and red
	with a flame for a hit. A sunk ship is drawn over its cells as the silhouette of its class, so a
	sunk Moskva looks nothing like a sunk Kilo. A sea drone that found water shows how many untouched
	ship cells are still around it. Tap strikes a cell; arrow keys move between cells.
-->
<script lang="ts">
	import {
		COLUMNS,
		ROWS,
		columnOf,
		droneContacts,
		isSunk,
		rowOf,
		shipAt,
		struckCells,
		type Ship,
		type Shot
	} from '#lib/game/fleethunt/fleet.js';
	import { m } from '#lib/paraglide/messages.js';
	import FleetHuntShip from './FleetHuntShip.svelte';
	import { SHIP_NAMES } from './fleethuntText';
	import IconFlame from '~icons/lucide/flame';

	let {
		ships,
		shots,
		interactive,
		onstrike
	}: {
		ships: readonly Ship[];
		shots: readonly Shot[];
		interactive: boolean;
		onstrike: (cell: number) => void;
	} = $props();

	type CellView =
		| { kind: 'water' }
		| { kind: 'miss'; contacts: number | null }
		| { kind: 'hit' }
		| { kind: 'sunk'; ship: Ship };

	const buttons: HTMLButtonElement[] = $state([]);
	let focusIndex = $state(0);

	const sunkShips = $derived.by(() => {
		const struck = struckCells(shots);
		return ships.filter((ship) => isSunk(ship, struck));
	});

	const cells = $derived.by((): CellView[] => {
		const struck = new Map(shots.map((shot) => [shot.cell, shot.weapon]));
		return Array.from({ length: COLUMNS * ROWS }, (_, cell): CellView => {
			const weapon = struck.get(cell);
			if (!weapon) return { kind: 'water' };
			const index = shipAt(ships, cell);
			if (index < 0) {
				return {
					kind: 'miss',
					contacts: weapon === 'usv' ? droneContacts(ships, shots, cell) : null
				};
			}
			const ship = ships[index];
			return sunkShips.includes(ship) ? { kind: 'sunk', ship } : { kind: 'hit' };
		});
	});

	function isVertical(ship: Ship): boolean {
		return ship.cells.length > 1 && columnOf(ship.cells[0]) === columnOf(ship.cells[1]);
	}

	function label(view: CellView, cell: number): string {
		const where = { row: rowOf(cell) + 1, column: columnOf(cell) + 1 };
		switch (view.kind) {
			case 'water':
				return m.fleethunt_cell_water(where);
			case 'miss':
				return view.contacts === null
					? m.fleethunt_cell_miss(where)
					: m.fleethunt_cell_contacts({ ...where, count: view.contacts });
			case 'hit':
				return m.fleethunt_cell_hit(where);
			case 'sunk':
				return m.fleethunt_cell_sunk({ ...where, ship: SHIP_NAMES[view.ship.class]() });
		}
	}

	function moveFocus(cell: number, key: string): number | null {
		const column = columnOf(cell);
		const row = rowOf(cell);
		switch (key) {
			case 'ArrowRight':
				return column < COLUMNS - 1 ? cell + 1 : null;
			case 'ArrowLeft':
				return column > 0 ? cell - 1 : null;
			case 'ArrowDown':
				return row < ROWS - 1 ? cell + COLUMNS : null;
			case 'ArrowUp':
				return row > 0 ? cell - COLUMNS : null;
			case 'Home':
				return cell - column;
			case 'End':
				return cell - column + COLUMNS - 1;
			default:
				return null;
		}
	}

	function onkeydown(event: KeyboardEvent, cell: number) {
		const next = moveFocus(cell, event.key);
		if (next === null) return;
		event.preventDefault();
		focusIndex = next;
		buttons[next]?.focus();
	}
</script>

<div
	class="overflow-hidden rounded-[10px_6px_12px_8px] border-3 border-ink bg-ink shadow-[4px_4px_0_var(--color-ink)]"
>
	<div
		role="group"
		aria-label={m.fleethunt_board_label({ columns: COLUMNS, rows: ROWS })}
		class="grid gap-[3px] p-[3px] {interactive ? 'cursor-crosshair' : ''}"
		style:grid-template-columns="repeat({COLUMNS}, minmax(1.5rem, 1fr))"
	>
		<!-- Every cell has a fixed place, so the sunk ships can lie across the same grid lines -->
		{#each sunkShips as ship (ship.cells[0])}
			{@const vertical = isVertical(ship)}
			<div
				class="pop-in pointer-events-none relative min-h-0 min-w-0 rounded-[4px] bg-[#2f6f94]"
				style:grid-column="{columnOf(ship.cells[0]) + 1} / span {vertical ? 1 : ship.cells.length}"
				style:grid-row="{rowOf(ship.cells[0]) + 1} / span {vertical ? ship.cells.length : 1}"
			>
				<FleetHuntShip
					shipClass={ship.class}
					{vertical}
					sunk
					class="absolute inset-[4px] size-[calc(100%-8px)]"
				/>
			</div>
		{/each}
		{#each cells as view, cell (cell)}
			<button
				type="button"
				bind:this={buttons[cell]}
				class="relative flex aspect-square items-center justify-center rounded-[4px] {view.kind ===
				'water'
					? 'bg-flag-blue'
					: view.kind === 'miss'
						? 'bg-sky'
						: view.kind === 'hit'
							? 'bg-tie-red'
							: 'bg-transparent'}"
				class:open-water={view.kind === 'water' && interactive}
				style:grid-column={columnOf(cell) + 1}
				style:grid-row={rowOf(cell) + 1}
				tabindex={cell === focusIndex ? 0 : -1}
				aria-label={label(view, cell)}
				aria-disabled={view.kind !== 'water' || !interactive}
				onfocus={() => (focusIndex = cell)}
				onclick={() => view.kind === 'water' && interactive && onstrike(cell)}
				onkeydown={(event) => onkeydown(event, cell)}
			>
				{#if view.kind === 'water'}
					<svg viewBox="0 0 40 20" class="w-[46%] opacity-50" aria-hidden="true">
						<path
							d="M3 12 Q10 4 17 12 T31 12 T38 9"
							fill="none"
							stroke="#ffffff"
							stroke-width="4"
							stroke-linecap="round"
						/>
					</svg>
				{:else if view.kind === 'miss'}
					{#if view.contacts === null}
						<span
							class="pop-in size-[28%] rounded-full border-2 border-ink bg-paper"
							aria-hidden="true"
						></span>
					{:else}
						<span
							class="pop-in flex size-[72%] items-center justify-center rounded-full border-2 border-ink bg-paper font-display text-sm leading-none font-bold sm:text-base"
							aria-hidden="true">{view.contacts}</span
						>
					{/if}
				{:else if view.kind === 'hit'}
					<IconFlame
						class="pop-in size-[70%] text-explosion-yellow"
						stroke-width="2.5"
						aria-hidden="true"
					/>
				{/if}
			</button>
		{/each}
	</div>
</div>

<style>
	.open-water:hover,
	.open-water:focus-visible {
		filter: brightness(1.2);
	}
</style>
