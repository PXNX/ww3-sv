<!--
	The home base: your island fills the whole landscape screen in isometric view, and everything else
	floats over it as round icon buttons, in the manner of a mobile base builder. Resources top right,
	the army, mines and trophies as a dock bottom left, a big attack button bottom right. Tap a
	building and a small bar rises with its level and upgrade. Rearranging lets you drag buildings and
	mines around the grid. Names, hints and counts are icons and numbers; the words live in tooltips.
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
	import { achievementHint, achievementName } from '#lib/components/beachheadText.js';
	import BeachheadArmy from '#lib/components/BeachheadArmy.svelte';
	import BeachheadHero from '#lib/components/BeachheadHero.svelte';
	import BeachheadResources from '#lib/components/BeachheadResources.svelte';
	import BeachheadSheet from '#lib/components/BeachheadSheet.svelte';
	import BeachheadTraining from '#lib/components/BeachheadTraining.svelte';
	import BeachheadTakeoverNotice from '#lib/components/BeachheadTakeoverNotice.svelte';
	import ResourceIcon from '#lib/components/ResourceIcon.svelte';
	import type { BeachheadGame } from '#lib/stores/beachheadGame.svelte.js';
	import IconArrowDownLeft from '~icons/lucide/arrow-down-left';
	import IconArrowDownRight from '~icons/lucide/arrow-down-right';
	import IconArrowUpLeft from '~icons/lucide/arrow-up-left';
	import IconArrowUpRight from '~icons/lucide/arrow-up-right';
	import IconBomb from '~icons/lucide/bomb';
	import IconCheck from '~icons/lucide/check';
	import IconCircleArrowUp from '~icons/lucide/circle-arrow-up';
	import IconCrosshair from '~icons/lucide/crosshair';
	import IconFlag from '~icons/lucide/flag-triangle-right';
	import IconGraduationCap from '~icons/lucide/graduation-cap';
	import IconCrown from '~icons/lucide/crown';
	import IconHammer from '~icons/lucide/hammer';
	import IconLock from '~icons/lucide/lock';
	import IconMove from '~icons/lucide/move';
	import IconShieldCheck from '~icons/lucide/shield-check';
	import IconSkull from '~icons/lucide/skull';
	import IconTrash from '~icons/lucide/trash-2';
	import IconTrophy from '~icons/lucide/trophy';
	import IconUsers from '~icons/lucide/users';
	import IconZap from '~icons/lucide/zap';

	let { game }: { game: BeachheadGame } = $props();

	const RESOURCE_KINDS = ['wood', 'stone', 'iron', 'gold'] as const;

	type Selection = { kind: 'building'; key: string } | { kind: 'mine'; id: number };
	type Drag = {
		item: { kind: 'building'; key: LayoutKey } | { kind: 'mine'; id: number };
		grab: { x: number; y: number };
		cell: Cell;
		valid: boolean;
	};
	type Sheet = 'army' | 'training' | 'hero' | 'mines' | 'trophies';

	let stage: HTMLDivElement | undefined = $state();
	let canvas: HTMLCanvasElement | undefined = $state();
	let context: CanvasRenderingContext2D | null = null;
	let scale = 1;
	let arranging = $state(false);
	let selected = $state<Selection | null>(null);
	let sheet = $state<Sheet | null>(null);
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
		if (key === 'bunker') {
			return {
				name: m.beachhead_building_bunker(),
				hint: m.beachhead_building_bunker_hint({ percent: Math.round(game.securedShare * 100) })
			};
		}
		if (key === 'dojo') {
			return { name: m.beachhead_building_dojo(), hint: m.beachhead_building_dojo_hint() };
		}
		if (key.startsWith('warehouse-')) {
			const kind = warehouseResource(key as WarehouseKey);
			const label =
				kind === 'wood'
					? m.beachhead_resource_wood()
					: kind === 'stone'
						? m.beachhead_resource_stone()
						: kind === 'iron'
							? m.beachhead_resource_iron()
							: m.beachhead_resource_gold();
			return {
				name: m.beachhead_warehouse_name({
					resource: label,
					index: warehouseIndex(key as WarehouseKey) + 1
				}),
				hint: m.beachhead_warehouse_hint({ capacity: game.storageCapacity(kind) })
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
		const hours = Math.floor(total / 3600);
		const minutes = Math.floor((total % 3600) / 60);
		const seconds = total % 60;
		return hours > 0
			? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
			: `${minutes}:${String(seconds).padStart(2, '0')}`;
	};

	/** The bar for whatever is selected, re-read as the builders and the stock change */
	const panel = $derived.by(() => {
		void clock;
		const current = selected;
		if (!current) return null;
		if (current.kind === 'mine') {
			const mine = game.layout.mines.find((candidate) => candidate.id === current.id);
			return mine ? { type: 'mine' as const, mine } : null;
		}
		const key = current.key;
		const boatIndex = key.startsWith('boat-') ? Number(key.slice('boat-'.length)) : null;
		return {
			type: 'building' as const,
			key,
			row: game.buildRowFor(key as BuildingKey),
			...describe(key),
			movable: isLayoutKey(key),
			boatLocked: boatIndex !== null && !(game.boats[boatIndex]?.unlocked ?? true),
			boatUnlockLevel: boatIndex === null ? 0 : boatIndex - 1
		};
	});

	const dock = $derived<
		{
			id: string;
			label: string;
			icon: Component<SvelteHTMLElements['svg']>;
			active: boolean;
			badge?: number;
			onclick: () => void;
		}[]
	>([
		{
			id: 'army',
			label: m.beachhead_army_title(),
			icon: IconUsers,
			active: sheet === 'army',
			badge: game.lostTotal,
			onclick: () => (sheet = 'army')
		},
		{
			id: 'mines',
			label: m.beachhead_island_mines_title(),
			icon: IconBomb,
			active: sheet === 'mines',
			onclick: () => (sheet = 'mines')
		},
		{
			id: 'trophies',
			label: m.beachhead_achievements_title(),
			icon: IconTrophy,
			active: sheet === 'trophies',
			onclick: () => (sheet = 'trophies')
		},
		{
			id: 'test',
			label: m.beachhead_test_start(),
			icon: IconShieldCheck,
			active: false,
			onclick: () => {
				game.startDefenseTest();
			}
		},
		{
			id: 'arrange',
			label: arranging ? m.beachhead_island_arrange_done() : m.beachhead_island_arrange(),
			icon: IconMove,
			active: arranging,
			onclick: () => {
				arranging = !arranging;
				drag = null;
				dragging = false;
			}
		}
	]);

	function buildProgress(key: string): number | null {
		const task = game.constructionOf(key as BuildingKey);
		if (!task) return null;
		return Math.min(1, Math.max(0, (Date.now() - task.startedAt) / (task.endsAt - task.startedAt)));
	}

	function draw(timeMs: number) {
		if (!canvas || !context) return;
		const ratio = window.devicePixelRatio || 1;
		context.setTransform(scale * ratio, 0, 0, scale * ratio, 0, 0);
		drawHome(context, {
			layout: game.layout,
			levelOf: (key) => game.levelOf(key as BuildingKey),
			maxOf: (key) => game.maxLevelOf(key as BuildingKey),
			fillOf: (resource: HomeResource) => {
				const capacity = game.storageCapacity(resource);
				return capacity > 0 ? Math.min(1, game.resources[resource] / capacity) : 0;
			},
			buildProgress,
			boatCount: game.boats.filter((boat) => boat.unlocked).length,
			boatUnits: (index) => game.boats[index]?.units ?? [],
			timeMs,
			arranging,
			selected,
			drag: drag ? { item: drag.item, cell: drag.cell, valid: drag.valid } : null
		});
	}

	// The island is drawn as large as the screen allows and the sea fills whatever is left over
	function resize() {
		if (!stage || !canvas) return;
		const width = stage.clientWidth;
		const height = stage.clientHeight;
		if (width === 0 || height === 0) return;
		scale = Math.min(width / HOME_VIEW.width, height / HOME_VIEW.height);
		const ratio = window.devicePixelRatio || 1;
		canvas.style.width = `${HOME_VIEW.width * scale}px`;
		canvas.style.height = `${HOME_VIEW.height * scale}px`;
		canvas.width = Math.round(HOME_VIEW.width * scale * ratio);
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
		// Supplies tick in whole minutes and builds finish over time; the bar needs a heartbeat too
		const timer = setInterval(() => {
			clock = Date.now();
			game.tick();
		}, 1000);
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
		const boats = game.boats.filter((boat) => boat.unlocked).length;
		const hit = pickHome(HOME_VIEW, game.layout, boats, point.x, point.y);
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
		const cell = { x: Math.round(ground.x - drag.grab.x), y: Math.round(ground.y - drag.grab.y) };
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

	const costOf = (kind: MineKind): Resources => ({ ...MINE_COST[kind] });
</script>

{#snippet costChips(cost: Resources)}
	<span class="flex flex-wrap items-center gap-1 font-display text-xs font-bold">
		{#each RESOURCE_KINDS as resource (resource)}
			{#if cost[resource] > 0}
				<span
					class="inline-flex items-center gap-0.5 rounded-full border-2 border-ink py-px ps-0.5 pe-1.5 {game
						.resources[resource] >= cost[resource]
						? 'bg-paper'
						: 'bg-tie-red text-paper'}"
				>
					<ResourceIcon kind={resource} class="size-4" />
					{cost[resource]}
				</span>
			{/if}
		{/each}
	</span>
{/snippet}

<div class="relative h-full w-full overflow-hidden bg-[#4fa8d8]">
	<div bind:this={stage} class="absolute inset-0 flex items-center justify-center">
		<canvas
			bind:this={canvas}
			class="block shrink-0 select-none"
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

	<!-- Top left: how many islands are in your hands; the retaken-islands warning sits under it -->
	<div
		class="pointer-events-none absolute top-(--hud-top) left-(--hud-left) z-20 flex max-w-[55%] flex-col items-start gap-1.5"
	>
		<p
			class="pointer-events-auto flex items-center gap-1.5 rounded-full border-2 border-ink bg-paper px-2.5 py-0.5 font-display text-sm font-bold tabular-nums shadow-[2px_2px_0_var(--color-ink)]"
			title={m.beachhead_controlled_count({ count: game.controlled, total: game.islandCount })}
		>
			<IconFlag class="size-4 text-khaki" aria-hidden="true" />
			{game.controlled}/{game.islandCount}
		</p>
		<div class="pointer-events-auto">
			<BeachheadTakeoverNotice {game} />
		</div>
	</div>

	{#if game.testResult}
		<p
			class="pop-in absolute top-(--hud-top) left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full border-2 border-ink px-3 py-1 font-display text-sm font-bold shadow-[2px_2px_0_var(--color-ink)] {game
				.testResult.fell
				? 'bg-tie-red text-paper'
				: 'bg-[#3fa65a] text-paper'}"
			role="status"
		>
			{#if game.testResult.fell}
				<IconSkull class="size-4" aria-hidden="true" />
				{m.beachhead_test_fell({ seconds: game.testResult.seconds })}
			{:else}
				<IconShieldCheck class="size-4" aria-hidden="true" />
				{m.beachhead_test_held()}
			{/if}
		</p>
	{/if}

	<!-- Top right: resources and builders -->
	<div class="pointer-events-none absolute top-(--hud-top) right-(--hud-right) z-20">
		<div class="pointer-events-auto">
			<BeachheadResources {game} />
		</div>
	</div>

	<!-- Bottom left: the dock -->
	<div
		class="pointer-events-none absolute bottom-[calc(0.5rem+env(safe-area-inset-bottom))] left-(--hud-left) z-20 flex gap-2 *:pointer-events-auto"
	>
		{#each dock as item (item.id)}
			{@const DockIcon = item.icon}
			<button
				type="button"
				class="btn-chunky relative flex size-12 items-center justify-center rounded-full p-0 sm:size-14 {item.active
					? 'bg-explosion-yellow'
					: ''}"
				aria-label={item.label}
				title={item.label}
				aria-pressed={item.active}
				onclick={item.onclick}
			>
				<DockIcon class="size-6" aria-hidden="true" />
				{#if item.badge}
					<span
						class="absolute -end-1 -top-1 flex min-w-5 items-center justify-center rounded-full border-2 border-ink bg-tie-red px-1 font-display text-[0.7rem] leading-4 font-bold text-paper tabular-nums"
					>
						{item.badge}
					</span>
				{/if}
			</button>
		{/each}
	</div>

	<!-- Bottom right: off to the islands -->
	<div
		class="pointer-events-none absolute right-(--hud-right) bottom-[calc(0.5rem+env(safe-area-inset-bottom))] z-20"
	>
		<button
			type="button"
			class="attack-button btn-chunky pointer-events-auto flex size-16 items-center justify-center rounded-full bg-tie-red p-0 text-paper sm:size-20"
			aria-label={m.beachhead_to_map()}
			title={m.beachhead_to_map()}
			onclick={() => game.goMap()}
		>
			<IconCrosshair class="size-9 sm:size-11" aria-hidden="true" />
		</button>
	</div>

	<!-- Bottom centre: the selected building or mine -->
	{#if panel}
		<div
			class="pointer-events-none absolute inset-x-0 bottom-[calc(0.5rem+env(safe-area-inset-bottom))] z-20 flex justify-center px-[11rem] sm:px-[13rem]"
		>
			<div
				class="sticker pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-x-3 gap-y-1 px-3 py-1.5"
				style:--tilt="0deg"
			>
				{#if panel.type === 'mine'}
					<p class="flex items-center gap-1.5 font-bold" title={mineHint(panel.mine.kind)}>
						{#if panel.mine.kind === 'mine-emp'}
							<IconZap class="size-5" aria-hidden="true" />
						{:else}
							<IconBomb class="size-5" aria-hidden="true" />
						{/if}
						{mineName(panel.mine.kind)}
					</p>
					<button
						type="button"
						class="btn-chunky flex size-9 items-center justify-center rounded-full p-0"
						aria-label={m.beachhead_island_mine_sell()}
						title={m.beachhead_island_mine_sell()}
						onclick={() => game.sellMine(panel.mine.id)}
					>
						<IconTrash class="size-5" aria-hidden="true" />
					</button>
				{:else}
					{@const row = panel.row}
					<p class="flex items-center gap-2 leading-tight font-bold" title={panel.hint}>
						{panel.name}
						<span
							class="rounded-full border-2 border-ink bg-paper px-1.5 font-display text-xs tabular-nums"
							title={m.beachhead_upgrade_level({ level: row.level, max: row.max })}
						>
							{row.level}/{row.max}
						</span>
					</p>
					{#if panel.key === 'dojo'}
						<button
							type="button"
							class="btn-chunky flex size-10 items-center justify-center rounded-full bg-explosion-yellow p-0"
							aria-label={m.beachhead_open_hero()}
							title={m.beachhead_open_hero()}
							onclick={() => (sheet = 'hero')}
						>
							<IconCrown class="size-6" aria-hidden="true" />
						</button>
					{/if}
					{#if panel.key === 'training'}
						<button
							type="button"
							class="btn-chunky flex size-10 items-center justify-center rounded-full bg-explosion-yellow p-0"
							aria-label={m.beachhead_open_training()}
							title={m.beachhead_open_training()}
							onclick={() => (sheet = 'training')}
						>
							<IconGraduationCap class="size-6" aria-hidden="true" />
						</button>
					{/if}
					{#if row.remainingMs !== null}
						<p class="flex items-center gap-1 font-display font-bold text-flag-blue tabular-nums">
							<IconHammer class="size-4" aria-hidden="true" />
							{timeLeft(row.remainingMs)}
						</p>
					{:else if panel.boatLocked}
						<p
							class="flex items-center gap-1 text-sm font-bold"
							title={m.beachhead_boat_locked({ level: panel.boatUnlockLevel })}
						>
							<IconLock class="size-4" aria-hidden="true" />
							<IconFlag class="size-4" aria-hidden="true" />
							{panel.boatUnlockLevel}
						</p>
					{:else if row.locked}
						<p
							class="flex items-center gap-1 text-sm font-bold"
							title={m.beachhead_upgrade_locked()}
						>
							<IconLock class="size-4" aria-hidden="true" />
							<IconFlag class="size-4" aria-hidden="true" />
						</p>
					{:else if row.cost === null}
						<IconCheck class="size-5 text-khaki" aria-label={m.beachhead_upgrade_max()} />
					{:else}
						{@render costChips(row.cost)}
						<button
							type="button"
							class="btn-chunky flex size-10 items-center justify-center rounded-full bg-khaki p-0 text-paper"
							aria-label={m.beachhead_upgrade_button()}
							title={game.buildersBusy >= game.builderSlots
								? m.beachhead_builders_busy()
								: m.beachhead_upgrade_button()}
							disabled={!row.canStart}
							onclick={() => game.upgrade(row.key)}
						>
							<IconCircleArrowUp class="size-6" aria-hidden="true" />
						</button>
					{/if}
				{/if}
				{#if arranging && (panel.type === 'mine' || panel.movable)}
					<div class="flex gap-1" role="group" aria-label={m.beachhead_island_move()}>
						<button
							type="button"
							class="btn-chunky p-1.5"
							aria-label={m.beachhead_island_move_back_left()}
							onclick={() => nudge(-1, 0)}
						>
							<IconArrowUpLeft class="size-4" aria-hidden="true" />
						</button>
						<button
							type="button"
							class="btn-chunky p-1.5"
							aria-label={m.beachhead_island_move_back_right()}
							onclick={() => nudge(0, -1)}
						>
							<IconArrowUpRight class="size-4" aria-hidden="true" />
						</button>
						<button
							type="button"
							class="btn-chunky p-1.5"
							aria-label={m.beachhead_island_move_front_left()}
							onclick={() => nudge(0, 1)}
						>
							<IconArrowDownLeft class="size-4" aria-hidden="true" />
						</button>
						<button
							type="button"
							class="btn-chunky p-1.5"
							aria-label={m.beachhead_island_move_front_right()}
							onclick={() => nudge(1, 0)}
						>
							<IconArrowDownRight class="size-4" aria-hidden="true" />
						</button>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>

<BeachheadSheet
	open={sheet === 'army'}
	title={m.beachhead_army_title()}
	onclose={() => (sheet = null)}
>
	<BeachheadArmy {game} />
</BeachheadSheet>

<BeachheadSheet
	open={sheet === 'training'}
	title={m.beachhead_building_training()}
	onclose={() => (sheet = null)}
>
	<BeachheadTraining {game} />
</BeachheadSheet>

<BeachheadSheet
	open={sheet === 'hero'}
	title={m.beachhead_hero_title()}
	onclose={() => (sheet = null)}
>
	<BeachheadHero {game} />
</BeachheadSheet>

<BeachheadSheet
	open={sheet === 'mines'}
	title={m.beachhead_island_mines_title()}
	onclose={() => (sheet = null)}
>
	<p class="text-sm font-semibold tabular-nums">
		{m.beachhead_island_mines_count({ count: game.layout.mines.length, max: MAX_MINES })}
	</p>
	<ul class="grid grid-cols-3 gap-2">
		{#each MINE_KINDS as kind (kind)}
			<li class="flex flex-col items-center gap-1.5 rounded-[14px] border-2 border-ink bg-sand p-2">
				<span
					class="flex size-12 items-center justify-center rounded-full border-3 border-ink bg-paper shadow-[2px_2px_0_var(--color-ink)]"
					title={mineHint(kind)}
				>
					{#if kind === 'mine-emp'}
						<IconZap class="size-7" aria-hidden="true" />
					{:else}
						<IconBomb class="size-7" aria-hidden="true" />
					{/if}
				</span>
				<p class="text-center text-xs leading-tight font-bold">{mineName(kind)}</p>
				<p class="text-center text-[0.7rem] leading-snug">{mineHint(kind)}</p>
				{@render costChips(costOf(kind))}
				<button
					type="button"
					class="btn-chunky flex size-9 items-center justify-center rounded-full p-0"
					aria-label={m.beachhead_island_mine_buy()}
					disabled={!game.canBuyMine(kind) || game.layout.mines.length >= MAX_MINES}
					onclick={() => game.buyMine(kind)}
				>
					<IconCircleArrowUp class="size-5" aria-hidden="true" />
				</button>
			</li>
		{/each}
	</ul>
</BeachheadSheet>

<BeachheadSheet
	open={sheet === 'trophies'}
	title={m.beachhead_achievements_title()}
	onclose={() => (sheet = null)}
>
	<ul class="grid grid-cols-2 gap-2 sm:grid-cols-3">
		{#each game.achievements as achievement (achievement.id)}
			<li
				class="flex items-center gap-2 rounded-[14px] border-2 border-ink p-2 {achievement.earned
					? 'bg-explosion-yellow'
					: 'bg-sand opacity-80'}"
				title={achievementHint(achievement.id)}
			>
				<IconTrophy class="size-7 shrink-0" aria-hidden="true" />
				<div class="min-w-0 leading-tight">
					<p class="text-sm font-bold">{achievementName(achievement.id)}</p>
					<p class="text-xs font-semibold">
						{#if achievement.earned}
							<IconCheck class="inline size-3.5" aria-label={m.beachhead_achievement_earned()} />
						{:else}
							+{achievement.coins}
						{/if}
					</p>
				</div>
			</li>
		{/each}
	</ul>
</BeachheadSheet>

<style>
	.attack-button {
		animation: attack-pulse 2s ease-in-out infinite;
	}

	@keyframes attack-pulse {
		0%,
		100% {
			box-shadow: 3px 3px 0 var(--color-ink);
		}
		50% {
			box-shadow:
				3px 3px 0 var(--color-ink),
				0 0 0 6px color-mix(in srgb, var(--color-tie-red) 40%, transparent);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.attack-button {
			animation: none;
		}
	}
</style>
