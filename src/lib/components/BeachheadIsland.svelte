<!--
	The player's own island in isometric view. Tap a building to see it and level it up; switch to
	rearranging to drag buildings and mines to other spots on the grid (green shows where they fit,
	red where they do not), or nudge the selection one cell at a time with the arrow buttons.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import type { Component } from 'svelte';
	import type { SvelteHTMLElements } from 'svelte/elements';
	import { m } from '#lib/paraglide/messages.js';
	import { drawHome, HOME_VIEW, pickHome, type HomeResource } from '#lib/game/beachhead/baseArt.js';
	import {
		MAX_MINES,
		MINE_COST,
		canPlace,
		footprintOf,
		isLayoutKey,
		positionOf,
		type Cell,
		type LayoutKey
	} from '#lib/game/beachhead/baseLayout.js';
	import { MINE_KINDS, type MineKind } from '#lib/game/beachhead/config.js';
	import {
		warehouseIndex,
		warehouseResource,
		type BuildingKey,
		type Resources,
		type WarehouseKey
	} from '#lib/game/beachhead/campaign.js';
	import type { BeachheadGame } from '#lib/stores/beachheadGame.svelte.js';
	import IconAnvil from '~icons/lucide/anvil';
	import IconArrowDownLeft from '~icons/lucide/arrow-down-left';
	import IconArrowDownRight from '~icons/lucide/arrow-down-right';
	import IconArrowUpLeft from '~icons/lucide/arrow-up-left';
	import IconArrowUpRight from '~icons/lucide/arrow-up-right';
	import IconBlocks from '~icons/lucide/blocks';
	import IconBomb from '~icons/lucide/bomb';
	import IconCoins from '~icons/lucide/coins';
	import IconLeaf from '~icons/lucide/leaf';
	import IconLock from '~icons/lucide/lock';
	import IconMove from '~icons/lucide/move';
	import IconTreePalm from '~icons/lucide/tree-palm';
	import IconWrench from '~icons/lucide/wrench';
	import IconZap from '~icons/lucide/zap';

	let { game }: { game: BeachheadGame } = $props();

	const RESOURCES: readonly {
		kind: keyof Resources;
		icon: Component<SvelteHTMLElements['svg']>;
		label: () => string;
	}[] = [
		{ kind: 'wood', icon: IconLeaf, label: () => m.beachhead_resource_wood() },
		{ kind: 'stone', icon: IconBlocks, label: () => m.beachhead_resource_stone() },
		{ kind: 'iron', icon: IconAnvil, label: () => m.beachhead_resource_iron() },
		{ kind: 'gold', icon: IconCoins, label: () => m.beachhead_resource_gold() }
	];

	type Selection = { kind: 'building'; key: string } | { kind: 'mine'; id: number };
	type Drag = {
		item: { kind: 'building'; key: LayoutKey } | { kind: 'mine'; id: number };
		grab: { x: number; y: number };
		cell: Cell;
		valid: boolean;
	};

	let stage: HTMLDivElement | undefined = $state();
	let canvas: HTMLCanvasElement | undefined = $state();
	let context: CanvasRenderingContext2D | null = null;
	let scale = 1;
	let arranging = $state(false);
	let selected = $state<Selection | null>(null);
	let drag: Drag | null = null;
	let dragging = $state(false);
	let clock = $state(0);

	const mineName = (kind: MineKind): string =>
		kind === 'mine-emp'
			? m.beachhead_building_mine_emp()
			: kind === 'mine-at'
				? m.beachhead_building_mine_at()
				: m.beachhead_building_mine_personnel();
	const mineHint = (kind: MineKind): string =>
		kind === 'mine-emp'
			? m.beachhead_mine_hint_emp()
			: kind === 'mine-at'
				? m.beachhead_mine_hint_at()
				: m.beachhead_mine_hint_personnel();

	function describe(key: string): { name: string; hint: string } {
		if (key === 'hq') {
			return { name: m.beachhead_upgrade_hq(), hint: m.beachhead_building_hq_hint() };
		}
		if (key === 'training') {
			return { name: m.beachhead_building_training(), hint: m.beachhead_building_training_hint() };
		}
		if (key === 'radar') {
			return {
				name: m.beachhead_building_radar(),
				hint: m.beachhead_building_radar_hint({ count: game.chartedCount })
			};
		}
		if (key === 'dojo') {
			return { name: m.beachhead_building_dojo(), hint: m.beachhead_building_dojo_hint() };
		}
		if (key.startsWith('warehouse-')) {
			const resource = RESOURCES.find(
				(entry) => entry.kind === warehouseResource(key as WarehouseKey)
			);
			return {
				name: m.beachhead_warehouse_name({
					resource: resource?.label() ?? '',
					index: warehouseIndex(key as WarehouseKey) + 1
				}),
				hint: m.beachhead_warehouse_hint({
					capacity: game.storageCapacity(warehouseResource(key as WarehouseKey))
				})
			};
		}
		const index = Number(key.slice('boat-'.length));
		return {
			name: m.beachhead_building_boat({ index: index + 1 }),
			hint: m.beachhead_building_boat_hint({ space: game.boats[index]?.capacity ?? 0 })
		};
	}

	const timeLeft = (ms: number): string => {
		const total = Math.max(0, Math.ceil(ms / 1000));
		return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
	};

	/** The card for whatever is selected, re-read as the builders and the stock change */
	const panel = $derived.by(() => {
		void clock;
		const current = selected;
		if (!current) return null;
		if (current.kind === 'mine') {
			const mine = game.layout.mines.find((candidate) => candidate.id === current.id);
			return mine ? { type: 'mine' as const, mine } : null;
		}
		const key = current.key;
		const row = game.buildRowFor(key as BuildingKey);
		const boatIndex = key.startsWith('boat-') ? Number(key.slice('boat-'.length)) : null;
		return {
			type: 'building' as const,
			key,
			row,
			...describe(key),
			movable: isLayoutKey(key),
			footprint: isLayoutKey(key) ? footprintOf(key) : null,
			boatLocked: boatIndex !== null && !(game.boats[boatIndex]?.unlocked ?? true),
			boatUnlockLevel: boatIndex === null ? 0 : boatIndex - 1
		};
	});

	function buildProgress(key: string): number | null {
		const task = game.constructionOf(key as BuildingKey);
		if (!task) return null;
		return Math.min(1, Math.max(0, (Date.now() - task.startedAt) / (task.endsAt - task.startedAt)));
	}

	function draw(timeMs: number) {
		if (!canvas || !context) return;
		const ratio = window.devicePixelRatio || 1;
		context.setTransform(scale * ratio, 0, 0, scale * ratio, 0, 0);
		const layout = game.layout;
		drawHome(context, {
			layout,
			levelOf: (key) => game.levelOf(key as BuildingKey),
			maxOf: (key) => game.maxLevelOf(key as BuildingKey),
			fillOf: (resource: HomeResource) => {
				const capacity = game.storageCapacity(resource);
				return capacity > 0 ? Math.min(1, game.resources[resource] / capacity) : 0;
			},
			buildProgress,
			boatCount: game.boats.filter((boat) => boat.unlocked).length,
			timeMs,
			arranging,
			selected,
			drag: drag ? { item: drag.item, cell: drag.cell, valid: drag.valid } : null
		});
	}

	function resize() {
		if (!stage || !canvas) return;
		const width = stage.clientWidth;
		if (width === 0) return;
		scale = width / HOME_VIEW.width;
		const ratio = window.devicePixelRatio || 1;
		canvas.style.width = `${width}px`;
		canvas.style.height = `${HOME_VIEW.height * scale}px`;
		canvas.width = Math.round(width * ratio);
		canvas.height = Math.round(HOME_VIEW.height * scale * ratio);
		draw(performance.now());
	}

	onMount(() => {
		if (!stage || !canvas) return;
		context = canvas.getContext('2d');
		const observer = new ResizeObserver(resize);
		observer.observe(stage);
		resize();
		let frame = 0;
		const tick = (now: number) => {
			draw(game.reducedMotion ? 0 : now);
			frame = requestAnimationFrame(tick);
		};
		frame = requestAnimationFrame(tick);
		// The panel needs a heartbeat for the build timers
		const timer = setInterval(() => (clock = Date.now()), 1000);
		return () => {
			cancelAnimationFrame(frame);
			clearInterval(timer);
			observer.disconnect();
		};
	});

	function viewPoint(event: PointerEvent): { x: number; y: number } | null {
		const rect = canvas?.getBoundingClientRect();
		if (!rect || rect.width === 0 || rect.height === 0) return null;
		return {
			x: ((event.clientX - rect.left) / rect.width) * HOME_VIEW.width,
			y: ((event.clientY - rect.top) / rect.height) * HOME_VIEW.height
		};
	}

	function onPointerDown(event: PointerEvent) {
		if (event.pointerType === 'mouse' && event.button !== 0) return;
		const point = viewPoint(event);
		if (!point) return;
		const hit = pickHome(
			HOME_VIEW,
			game.layout,
			game.boats.filter((b) => b.unlocked).length,
			point.x,
			point.y
		);
		selected = hit;
		if (!hit || !arranging) return;
		const ground = HOME_VIEW.unproject(point.x, point.y);
		if (hit.kind === 'building') {
			if (!isLayoutKey(hit.key)) return;
			const at = positionOf(game.layout, hit.key);
			drag = {
				item: { kind: 'building', key: hit.key },
				grab: { x: ground.x - at.x, y: ground.y - at.y },
				cell: at,
				valid: true
			};
		} else {
			const mine = game.layout.mines.find((candidate) => candidate.id === hit.id);
			if (!mine) return;
			drag = {
				item: { kind: 'mine', id: hit.id },
				grab: { x: ground.x - mine.x, y: ground.y - mine.y },
				cell: { x: mine.x, y: mine.y },
				valid: true
			};
		}
		dragging = true;
		try {
			canvas?.setPointerCapture(event.pointerId);
		} catch {
			// A pointer that is already gone cannot be captured; the drag still works on this canvas
		}
		event.preventDefault();
	}

	function fits(item: Drag['item'], cell: Cell): boolean {
		return item.kind === 'building'
			? canPlace(game.layout, footprintOf(item.key), cell, { key: item.key })
			: canPlace(game.layout, { width: 1, height: 1 }, cell, { mineId: item.id });
	}

	function onPointerMove(event: PointerEvent) {
		if (!drag) return;
		const point = viewPoint(event);
		if (!point) return;
		const ground = HOME_VIEW.unproject(point.x, point.y);
		const cell = {
			x: Math.round(ground.x - drag.grab.x),
			y: Math.round(ground.y - drag.grab.y)
		};
		drag = { ...drag, cell, valid: fits(drag.item, cell) };
	}

	function onPointerUp() {
		if (!drag) return;
		const done = drag;
		drag = null;
		dragging = false;
		if (!done.valid) return;
		if (done.item.kind === 'building') game.moveBuilding(done.item.key, done.cell);
		else game.moveMine(done.item.id, done.cell);
	}

	/** One cell along a grid axis; the buttons are drawn in the screen direction each one moves */
	function nudge(dx: number, dy: number) {
		const current = selected;
		if (!current) return;
		if (current.kind === 'building') {
			if (!isLayoutKey(current.key)) return;
			const at = positionOf(game.layout, current.key);
			game.moveBuilding(current.key, { x: at.x + dx, y: at.y + dy });
			return;
		}
		const mine = game.layout.mines.find((candidate) => candidate.id === current.id);
		if (mine) game.moveMine(mine.id, { x: mine.x + dx, y: mine.y + dy });
	}

	function buy(kind: MineKind) {
		game.buyMine(kind);
	}

	const costOf = (kind: MineKind): Resources => MINE_COST[kind];
</script>

<section class="flex flex-col gap-3" aria-labelledby="beachhead-island-title">
	<div class="flex flex-wrap items-end justify-between gap-2">
		<div class="flex items-center gap-3">
			<span
				class="flex size-12 shrink-0 items-center justify-center rounded-[14px_8px_16px_10px] border-3 border-ink bg-khaki text-paper shadow-[3px_3px_0_var(--color-ink)]"
			>
				<IconTreePalm class="size-7" aria-hidden="true" />
			</span>
			<div>
				<h3 id="beachhead-island-title" class="text-xl font-bold">{m.beachhead_island_title()}</h3>
				<p class="text-sm font-semibold">{m.beachhead_island_intro()}</p>
			</div>
		</div>
		<button
			type="button"
			class="btn-chunky flex items-center gap-1.5 text-sm {arranging ? 'bg-explosion-yellow' : ''}"
			aria-pressed={arranging}
			onclick={() => {
				arranging = !arranging;
				drag = null;
				dragging = false;
			}}
		>
			<IconMove class="size-4" aria-hidden="true" />
			{arranging ? m.beachhead_island_arrange_done() : m.beachhead_island_arrange()}
		</button>
	</div>

	{#if arranging}
		<p class="text-sm font-semibold">{m.beachhead_island_arrange_hint()}</p>
	{/if}

	<div
		bind:this={stage}
		class="relative w-full overflow-hidden rounded-[18px_10px_16px_8px] border-3 border-ink shadow-[4px_4px_0_var(--color-ink)]"
	>
		<canvas
			bind:this={canvas}
			class="block w-full select-none"
			class:touch-none={arranging}
			class:cursor-grabbing={dragging}
			class:cursor-grab={arranging && !dragging}
			aria-label={m.beachhead_island_canvas_label()}
			onpointerdown={onPointerDown}
			onpointermove={onPointerMove}
			onpointerup={onPointerUp}
			onpointercancel={onPointerUp}
			oncontextmenu={(event) => event.preventDefault()}
		></canvas>
	</div>

	{#snippet costChips(cost: Resources)}
		<span class="flex flex-wrap items-center gap-1.5 font-display text-xs font-bold">
			{#each RESOURCES as resource (resource.kind)}
				{@const Icon = resource.icon}
				{#if cost[resource.kind] > 0}
					<span
						class="inline-flex items-center gap-0.5 rounded border-2 border-ink px-1 {game
							.resources[resource.kind] >= cost[resource.kind]
							? 'bg-paper'
							: 'bg-tie-red text-paper'}"
						title={resource.label()}
					>
						<Icon class="size-3" aria-hidden="true" />
						{cost[resource.kind]}
					</span>
				{/if}
			{/each}
		</span>
	{/snippet}

	{#if panel === null}
		<p class="text-sm font-semibold">{m.beachhead_island_select_hint()}</p>
	{:else if panel.type === 'mine'}
		<div class="sticker flex flex-col gap-2 p-3" style:--tilt="-0.4deg">
			<div class="flex flex-wrap items-center justify-between gap-2">
				<div class="flex items-center gap-2">
					<IconBomb class="size-6 shrink-0" aria-hidden="true" />
					<div class="leading-tight">
						<p class="font-bold">{mineName(panel.mine.kind)}</p>
						<p class="text-xs font-semibold">
							{m.beachhead_island_footprint({ width: 1, height: 1 })}
						</p>
					</div>
				</div>
				<button
					type="button"
					class="btn-chunky text-sm"
					onclick={() => game.sellMine(panel.mine.id)}
				>
					{m.beachhead_island_mine_sell()}
				</button>
			</div>
			<p class="text-sm leading-snug">{mineHint(panel.mine.kind)}</p>
		</div>
	{:else}
		{@const row = panel.row}
		<div class="sticker flex flex-col gap-2 p-3" style:--tilt="-0.4deg">
			<div class="flex flex-wrap items-center justify-between gap-2">
				<div class="leading-tight">
					<p class="font-bold">{panel.name}</p>
					{#key row.level}
						<p class="pop-in text-xs font-semibold">
							{m.beachhead_upgrade_level({ level: row.level, max: row.max })}
							{#if panel.footprint}
								· {m.beachhead_island_footprint({
									width: panel.footprint.width,
									height: panel.footprint.height
								})}
							{/if}
						</p>
					{/key}
				</div>
				<div class="flex gap-1" aria-hidden="true">
					{#each Array.from({ length: row.max }, (_, index) => index + 1) as pip (pip)}
						<span
							class="h-2 w-4 rounded-sm border-2 border-ink {pip <= row.level
								? 'bg-khaki'
								: 'bg-paper'}"
						></span>
					{/each}
				</div>
			</div>
			<p class="text-sm leading-snug">{panel.hint}</p>
			{#if row.remainingMs !== null}
				<p class="flex items-center gap-1 text-sm font-bold text-flag-blue">
					<IconWrench class="size-4" aria-hidden="true" />
					{m.beachhead_building_remaining({ time: timeLeft(row.remainingMs) })}
				</p>
			{:else if panel.boatLocked}
				<p class="flex items-center gap-1 text-sm font-semibold">
					<IconLock class="size-4" aria-hidden="true" />
					{m.beachhead_boat_locked({ level: panel.boatUnlockLevel })}
				</p>
			{:else if row.locked}
				<p class="flex items-center gap-1 text-sm font-semibold">
					<IconLock class="size-4" aria-hidden="true" />
					{m.beachhead_upgrade_locked()}
				</p>
			{:else if row.cost === null}
				<p class="text-sm font-bold">{m.beachhead_upgrade_max()}</p>
			{:else}
				<div class="flex flex-wrap items-center justify-between gap-2">
					{@render costChips(row.cost)}
					<button
						type="button"
						class="btn-chunky text-sm"
						disabled={!row.canStart}
						onclick={() => game.upgrade(row.key)}
					>
						{m.beachhead_upgrade_button()}
					</button>
				</div>
				{#if game.buildersBusy >= game.builderSlots}
					<p class="text-xs font-semibold text-tie-red">{m.beachhead_builders_busy()}</p>
				{/if}
			{/if}
		</div>
	{/if}

	{#if arranging && selected && (selected.kind === 'mine' || isLayoutKey(selected.key))}
		<div class="flex flex-wrap items-center gap-2">
			<span class="text-sm font-bold">{m.beachhead_island_move()}</span>
			<div class="flex gap-1">
				<button
					type="button"
					class="btn-chunky px-2 py-1"
					aria-label={m.beachhead_island_move_back_left()}
					onclick={() => nudge(-1, 0)}
				>
					<IconArrowUpLeft class="size-4" aria-hidden="true" />
				</button>
				<button
					type="button"
					class="btn-chunky px-2 py-1"
					aria-label={m.beachhead_island_move_back_right()}
					onclick={() => nudge(0, -1)}
				>
					<IconArrowUpRight class="size-4" aria-hidden="true" />
				</button>
				<button
					type="button"
					class="btn-chunky px-2 py-1"
					aria-label={m.beachhead_island_move_front_left()}
					onclick={() => nudge(0, 1)}
				>
					<IconArrowDownLeft class="size-4" aria-hidden="true" />
				</button>
				<button
					type="button"
					class="btn-chunky px-2 py-1"
					aria-label={m.beachhead_island_move_front_right()}
					onclick={() => nudge(1, 0)}
				>
					<IconArrowDownRight class="size-4" aria-hidden="true" />
				</button>
			</div>
		</div>
	{/if}

	<div class="sticker flex flex-col gap-2 p-3" style:--tilt="0.4deg">
		<div class="flex flex-wrap items-center justify-between gap-2">
			<div>
				<h4 class="font-bold">{m.beachhead_island_mines_title()}</h4>
				<p class="text-xs font-semibold">{m.beachhead_island_mines_intro()}</p>
			</div>
			<p class="rounded-md border-2 border-ink bg-paper px-2 py-0.5 text-xs font-bold tabular-nums">
				{m.beachhead_island_mines_count({ count: game.layout.mines.length, max: MAX_MINES })}
			</p>
		</div>
		<ul class="grid gap-2 sm:grid-cols-3">
			{#each MINE_KINDS as kind (kind)}
				<li class="flex flex-col gap-1.5 rounded-md border-2 border-ink bg-paper p-2">
					<p class="flex items-center gap-1 text-sm font-bold">
						{#if kind === 'mine-emp'}
							<IconZap class="size-4" aria-hidden="true" />
						{:else}
							<IconBomb class="size-4" aria-hidden="true" />
						{/if}
						{mineName(kind)}
					</p>
					<p class="text-xs leading-snug">{mineHint(kind)}</p>
					{@render costChips(costOf(kind))}
					<button
						type="button"
						class="btn-chunky mt-auto text-sm"
						disabled={!game.canBuyMine(kind) || game.layout.mines.length >= MAX_MINES}
						onclick={() => buy(kind)}
					>
						{m.beachhead_island_mine_buy()}
					</button>
				</li>
			{/each}
		</ul>
		{#if game.layout.mines.length >= MAX_MINES}
			<p class="text-xs font-semibold text-tie-red">{m.beachhead_island_mines_full()}</p>
		{/if}
	</div>
</section>
