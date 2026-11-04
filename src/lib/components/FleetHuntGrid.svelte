<!--
	Black Sea Fleet Hunt board: foggy flag-blue water until it was struck or looked at, grey with a
	splash for a miss, red with flames for a hit, a flare for a decoy buoy. A sunk ship is drawn over
	its cells as the silhouette of its class, after it went down with a tilt and bubbles. A sea drone
	that found water shows how many untouched ship cells are around it; a sonar ping leaves its
	count in the corner of the cell it listened at. Hovering or focusing a cell previews what the
	chosen weapon would cover. Tap strikes a cell; arrow keys move between cells.

	Every action of the store (`volley`) plays out here: the shells fly first and the cells only
	change when their shell lands, with splashes, explosions, sinking ships, sonar rings and screen
	shake from the effects layer, and the sounds and the vibration at the right moment. Players who
	prefer reduced motion get the result at once, without the particles and the shake.
-->
<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import {
		isStrike,
		revealedCells,
		weaponCells,
		type Evasion
	} from '#lib/game/fleethunt/arsenal.js';
	import {
		COLUMNS,
		ROWS,
		SONAR_RADIUS,
		columnOf,
		droneContacts,
		isSunk,
		rowOf,
		shipAt,
		squareAround,
		struckCells,
		type Ship,
		type Shot,
		type Weapon
	} from '#lib/game/fleethunt/fleet.js';
	import { FLIGHT_MS, FxWorld, VOLLEY_GAP_MS, impactAt } from '#lib/game/fleethunt/fx.js';
	import type { Ping } from '#lib/game/fleethunt/save.js';
	import { haptic } from '#lib/haptic/haptic.svelte.js';
	import { m } from '#lib/paraglide/messages.js';
	import { soundManager } from '#lib/sound/soundManager.svelte.js';
	import type { Volley } from '#lib/stores/fleethuntGame.svelte.js';
	import FleetHuntFx from './FleetHuntFx.svelte';
	import FleetHuntShip from './FleetHuntShip.svelte';
	import { SHIP_NAMES } from './fleethuntText';
	import IconFlame from '~icons/lucide/flame';
	import IconSparkles from '~icons/lucide/sparkles';

	let {
		ships,
		decoys,
		shots,
		pings,
		volley,
		weapon,
		interactive,
		onstrike
	}: {
		ships: readonly Ship[];
		decoys: readonly number[];
		shots: readonly Shot[];
		pings: readonly Ping[];
		volley: Volley | null;
		weapon: Weapon;
		interactive: boolean;
		onstrike: (cell: number) => void;
	} = $props();

	type CellView =
		| { kind: 'water' }
		| { kind: 'miss'; contacts: number | null }
		| { kind: 'decoy' }
		| { kind: 'hit' }
		| { kind: 'sunk'; ship: Ship };

	const buttons: HTMLButtonElement[] = $state([]);
	let focusIndex = $state(0);
	let aim = $state<number | null>(null);
	let board: HTMLElement | undefined = $state();

	const world = new FxWorld(Math.random);
	let reduced = false;
	/** Cells whose shell is still in the air, and sunk ships still going down (by first cell) */
	let flying = $state.raw<readonly number[]>([]);
	let sinking = $state.raw<readonly number[]>([]);
	let timers: ReturnType<typeof setTimeout>[] = [];

	function later(ms: number, run: () => void) {
		timers.push(setTimeout(run, ms));
	}

	function without(list: readonly number[], value: number): readonly number[] {
		return list.filter((item) => item !== value);
	}

	onMount(() => {
		reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
		return () => {
			for (const timer of timers) clearTimeout(timer);
			timers = [];
		};
	});

	let playedId = 0;
	$effect(() => {
		const current = volley;
		if (!current || current.id === playedId) return;
		playedId = current.id;
		untrack(() => play(current));
	});

	function haptics(intensity: number) {
		haptic().play(intensity);
	}

	function play(current: Volley) {
		const sounds = soundManager();
		if (current.weapon === 'sonar') {
			sounds.play('sonar-ping');
			haptics(0.25);
			if (!reduced) world.ping(current.target, SONAR_RADIUS + 0.5);
			return;
		}
		if (current.weapon === 'neptune' || current.weapon === 'salvo')
			sounds.play('shell-whistle', 0.5);
		if (current.weapon === 'usv') sounds.play('drone-buzz', 0.5);
		haptics(0.1);

		const gap = VOLLEY_GAP_MS[current.weapon];
		const delay = (index: number) => (reduced ? 0 : impactAt(current.weapon, index));
		if (!reduced) {
			flying = current.outcomes.map((outcome) => outcome.cell);
			sinking = current.sunk.map((sunk) => sunk.cells[0]);
		}
		const kind =
			current.weapon === 'depth' ? 'charge' : current.weapon === 'usv' ? 'drone' : 'shell';
		let lastImpact = 0;
		for (const [index, outcome] of current.outcomes.entries()) {
			const at = delay(index);
			lastImpact = Math.max(lastImpact, at);
			if (!reduced) {
				world.launch(
					kind,
					outcome.cell,
					(index * gap) / 1000,
					FLIGHT_MS[current.weapon] / 1000,
					() => {}
				);
			}
			later(at, () => {
				if (!reduced) flying = without(flying, outcome.cell);
				if (outcome.kind === 'miss') {
					sounds.play(current.weapon === 'depth' ? 'depth-charge' : 'splash', 0.6);
					haptics(0.15);
					if (!reduced) world.splash(outcome.cell);
				} else if (outcome.kind === 'decoy') {
					sounds.play('explosion-tiny');
					haptics(0.2);
					if (!reduced) world.explosion(outcome.cell, 0.1);
				} else if (outcome.kind === 'hit') {
					sounds.play('explosion-small', Math.min(1, 0.5 + current.streak * 0.1));
					haptics(Math.min(0.8, 0.45 + current.streak * 0.08));
					if (!reduced) world.explosion(outcome.cell, Math.min(1, 0.4 + current.streak * 0.1));
				} else {
					sounds.play('explosion-big');
					sounds.play('ship-sink');
					haptics(0.9);
					const sunk = current.sunk.find((entry) => entry.cells.includes(outcome.cell));
					if (!reduced && sunk) world.sink(sunk.cells);
				}
			});
		}
		// The silhouette of a sunk ship appears once it went under
		if (!reduced) {
			for (const sunk of current.sunk) {
				later(lastImpact + 1500, () => (sinking = without(sinking, sunk.cells[0])));
			}
		}
		if (current.evasion) announceEvasion(current.evasion, lastImpact + 700);
		if (current.won) {
			later(lastImpact + (reduced ? 0 : 1600), () => {
				sounds.play('chime-big');
				haptics(1);
			});
		}
	}

	function announceEvasion(evasion: Evasion, at: number) {
		later(at, () => {
			soundManager().play('splash', 0.3);
			haptics(0.12);
			if (!reduced) {
				const vacated = evasion.from.filter((cell) => !evasion.to.includes(cell));
				for (const cell of vacated) world.ripple(cell, 1.1);
			}
		});
	}

	const sunkShips = $derived.by(() => {
		const struck = struckCells(shots);
		return ships.filter((ship) => isSunk(ship, struck));
	});

	const revealed = $derived(revealedCells(ships, shots, pings));

	const cells = $derived.by((): CellView[] => {
		const struck = new Map(shots.map((shot) => [shot.cell, shot.weapon]));
		return Array.from({ length: COLUMNS * ROWS }, (_, cell): CellView => {
			const by = struck.get(cell);
			if (!by || flying.includes(cell)) return { kind: 'water' };
			const index = shipAt(ships, cell);
			if (index < 0) {
				if (decoys.includes(cell)) return { kind: 'decoy' };
				return {
					kind: 'miss',
					contacts: by === 'usv' ? droneContacts(ships, shots, cell, decoys) : null
				};
			}
			const ship = ships[index];
			return sunkShips.includes(ship) && !sinking.includes(ship.cells[0])
				? { kind: 'sunk', ship }
				: { kind: 'hit' };
		});
	});

	const burning = $derived(cells.flatMap((view, cell) => (view.kind === 'hit' ? [cell] : [])));

	const preview = $derived.by((): ReadonlySet<number> => {
		if (aim === null || !interactive) return new Set();
		return new Set(isStrike(weapon) ? weaponCells(weapon, aim) : squareAround(aim, SONAR_RADIUS));
	});

	const pingCounts = $derived(new Map(pings.map((ping) => [ping.cell, ping.count])));

	function isVertical(ship: Ship): boolean {
		return ship.cells.length > 1 && columnOf(ship.cells[0]) === columnOf(ship.cells[1]);
	}

	function label(view: CellView, cell: number): string {
		const where = { row: rowOf(cell) + 1, column: columnOf(cell) + 1 };
		const ping = pingCounts.get(cell);
		const base = (() => {
			switch (view.kind) {
				case 'water':
					return m.fleethunt_cell_water(where);
				case 'miss':
					return view.contacts === null
						? m.fleethunt_cell_miss(where)
						: m.fleethunt_cell_contacts({ ...where, count: view.contacts });
				case 'decoy':
					return m.fleethunt_cell_decoy(where);
				case 'hit':
					return m.fleethunt_cell_hit(where);
				case 'sunk':
					return m.fleethunt_cell_sunk({ ...where, ship: SHIP_NAMES[view.ship.class]() });
			}
		})();
		return ping === undefined ? base : `${base}. ${m.fleethunt_cell_ping({ count: ping })}`;
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
	bind:this={board}
	class="overflow-hidden rounded-[10px_6px_12px_8px] border-3 border-ink bg-ink shadow-[4px_4px_0_var(--color-ink)]"
>
	<div
		role="group"
		aria-label={m.fleethunt_board_label({ columns: COLUMNS, rows: ROWS })}
		class="relative grid gap-[3px] p-[3px] {interactive ? 'cursor-crosshair' : ''}"
		style:grid-template-columns="repeat({COLUMNS}, minmax(1.5rem, 1fr))"
		onpointerleave={() => (aim = null)}
	>
		<!-- Every cell has a fixed place, so the sunk ships can lie across the same grid lines -->
		{#each sunkShips.filter((ship) => !sinking.includes(ship.cells[0])) as ship (ship.cells[0])}
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
			{@const fogged = view.kind === 'water' && !revealed.has(cell)}
			<button
				type="button"
				bind:this={buttons[cell]}
				class="relative flex aspect-square items-center justify-center rounded-[4px] {view.kind ===
				'water'
					? 'bg-flag-blue'
					: view.kind === 'miss'
						? 'bg-sky'
						: view.kind === 'decoy'
							? 'bg-mustard'
							: view.kind === 'hit'
								? 'bg-tie-red'
								: 'bg-transparent'}"
				class:open-water={view.kind === 'water' && interactive}
				class:fog={fogged}
				class:aimed={preview.has(cell)}
				style:grid-column={columnOf(cell) + 1}
				style:grid-row={rowOf(cell) + 1}
				tabindex={cell === focusIndex ? 0 : -1}
				aria-label={label(view, cell)}
				aria-disabled={view.kind !== 'water' || !interactive}
				onfocus={() => {
					focusIndex = cell;
					aim = cell;
				}}
				onblur={() => (aim = null)}
				onpointerenter={() => (aim = cell)}
				onclick={() => interactive && onstrike(cell)}
				onkeydown={(event) => onkeydown(event, cell)}
			>
				{#if view.kind === 'water'}
					<svg viewBox="0 0 40 20" class="wave w-[46%] opacity-50" aria-hidden="true">
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
				{:else if view.kind === 'decoy'}
					<IconSparkles class="pop-in size-[62%] text-ink" stroke-width="2.5" aria-hidden="true" />
				{:else if view.kind === 'hit'}
					<IconFlame
						class="pop-in size-[70%] text-explosion-yellow"
						stroke-width="2.5"
						aria-hidden="true"
					/>
				{/if}
				{#if pingCounts.has(cell)}
					<span
						class="pointer-events-none absolute top-0 left-0 flex min-w-[1.1em] items-center justify-center rounded-br-md border-2 border-ink bg-[#7dffc8] px-0.5 font-display text-[0.65rem] leading-tight font-bold text-ink"
						aria-hidden="true">{pingCounts.get(cell)}</span
					>
				{/if}
			</button>
		{/each}
		<FleetHuntFx {world} {burning} shakeTarget={board} />
	</div>
</div>

<style>
	.open-water:hover,
	.open-water:focus-visible {
		filter: brightness(1.2);
	}

	/* Fog of war: water nobody has looked at is murky */
	.fog {
		filter: brightness(0.72) saturate(0.7);
	}

	.aimed {
		outline: 3px solid var(--color-explosion-yellow);
		outline-offset: -3px;
		z-index: 1;
	}

	@media (prefers-reduced-motion: no-preference) {
		.wave {
			animation: bob 3.2s ease-in-out infinite;
		}

		@keyframes bob {
			50% {
				transform: translateY(-6%);
			}
		}
	}
</style>
