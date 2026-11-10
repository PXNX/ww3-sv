<!--
	The home base: your island fills the whole landscape screen in isometric view, and everything else
	floats over it as round icon buttons, in the manner of a mobile base builder. Resources top right,
	the army, mines and trophies as a dock bottom left, a big attack button bottom right. Tap a
	building and its name and level float above it, with round info and upgrade buttons under it;
	press on the picked building or mine again and drag it to move it around the grid. Names, hints
	and counts are icons and numbers; the words live in tooltips.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { soundManager } from '#lib/sound/soundManager.svelte.js';
	import type { Component } from 'svelte';
	import type { SvelteHTMLElements } from 'svelte/elements';
	import { m } from '#lib/paraglide/messages.js';
	import {
		drawHome,
		homeAnchor,
		HOME_VIEW,
		pickHome,
		type HomeResource
	} from '#lib/game/beachhead/baseArt.js';
	import {
		DEFENSE_COST,
		GUARD_UNLOCK_HQ,
		defenseCap,
		defenseCount,
		defenseLevel,
		defenseUnlocked,
		isMineKind,
		isGuard,
		isRemovable,
		STORE_CATEGORIES,
		canPlace,
		footprintOf,
		isLayoutKey,
		positionOf,
		type Cell,
		type DefenseKind,
		type LayoutKey
	} from '#lib/game/beachhead/baseLayout.js';
	import {
		BOAT_KEYS,
		WAREHOUSE_KEYS,
		warehouseIndex,
		warehouseResource,
		type BuildingKey,
		type Resources,
		type WarehouseKey
	} from '#lib/game/beachhead/campaign.js';
	import { achievementHint, achievementName, buildingName } from '#lib/components/beachheadText.js';
	import type { BuildingKind } from '#lib/game/beachhead/config.js';
	import { zoomPan } from '#lib/components/zoomPan.js';
	import BeachheadArmy from '#lib/components/BeachheadArmy.svelte';
	import RewardedAdModal from '#lib/components/RewardedAdModal.svelte';
	import BeachheadCrystals from '#lib/components/BeachheadCrystals.svelte';
	import BeachheadPortrait from '#lib/components/BeachheadPortrait.svelte';
	import BeachheadUpgradeWindow from '#lib/components/BeachheadUpgradeWindow.svelte';
	import BeachheadHero from '#lib/components/BeachheadHero.svelte';
	import BeachheadResources from '#lib/components/BeachheadResources.svelte';
	import BeachheadSheet from '#lib/components/BeachheadSheet.svelte';
	import BeachheadTraining from '#lib/components/BeachheadTraining.svelte';
	import BeachheadTakeoverNotice from '#lib/components/BeachheadTakeoverNotice.svelte';
	import ResourceIcon from '#lib/components/ResourceIcon.svelte';
	import type { BeachheadGame } from '#lib/stores/beachheadGame.svelte.js';
	import IconArrowBigUp from '~icons/lucide/arrow-big-up';
	import IconCheck from '~icons/lucide/check';
	import IconCircleArrowUp from '~icons/lucide/circle-arrow-up';
	import IconCrosshair from '~icons/lucide/crosshair';
	import IconFlag from '~icons/lucide/flag-triangle-right';
	import IconGraduationCap from '~icons/lucide/graduation-cap';
	import IconCrown from '~icons/lucide/crown';
	import IconGem from '~icons/lucide/gem';
	import IconHammer from '~icons/lucide/hammer';
	import IconInfo from '~icons/lucide/info';
	import IconLock from '~icons/lucide/lock';
	import IconStore from '~icons/lucide/store';
	import IconShieldCheck from '~icons/lucide/shield-check';
	import IconSkull from '~icons/lucide/skull';
	import IconTv from '~icons/lucide/tv';
	import IconShip from '~icons/lucide/ship';
	import IconTrash from '~icons/lucide/trash-2';
	import IconTrophy from '~icons/lucide/trophy';
	import IconUsers from '~icons/lucide/users';

	let { game }: { game: BeachheadGame } = $props();

	const RESOURCE_KINDS = ['wood', 'stone', 'iron', 'gold'] as const;

	type Selection = { kind: 'building'; key: string } | { kind: 'mine'; id: number };
	type Drag = {
		item: { kind: 'building'; key: LayoutKey } | { kind: 'mine'; id: number };
		grab: { x: number; y: number };
		cell: Cell;
		valid: boolean;
		/** Whether it left its cell yet; a press that never moves is just a tap */
		moved?: boolean;
	};
	type Sheet =
		'army' | 'training' | 'hero' | 'upgrade' | 'mines' | 'crystals' | 'trophies' | 'expedition';

	let stage: HTMLDivElement | undefined = $state();
	let canvas: HTMLCanvasElement | undefined = $state();
	let context: CanvasRenderingContext2D | null = null;
	let scale = 1;
	/** How far the island is zoomed; the canvas is redrawn with that many times the pixels */
	let zoom = 1;
	/** The island is repainted every frame, so its bitmap stays within a pixel budget however far it is zoomed */
	const PIXEL_BUDGET = 2_600_000;
	const pixelRatio = () => {
		const width = Math.max(1, HOME_VIEW.width * scale);
		const height = Math.max(1, HOME_VIEW.height * scale);
		return Math.max(
			1,
			Math.min(
				(window.devicePixelRatio || 1) * zoom,
				4096 / width,
				Math.sqrt(PIXEL_BUDGET / (width * height))
			)
		);
	};
	let selected = $state<Selection | null>(null);
	let sheet = $state<Sheet | null>(null);
	/** The building window shows what something is now, or what its next level brings */
	let windowMode = $state<'info' | 'upgrade'>('upgrade');
	let drag: Drag | null = null;
	let dragging = $state(false);
	let clock = $state(0);
	/** The category tab open in the store */
	type StoreTab = 'resources' | 'guns' | 'obstacles' | 'buildings';
	const STORE_TABS: readonly StoreTab[] = ['resources', 'guns', 'obstacles', 'buildings'];
	let storeTab = $state<StoreTab>('resources');
	/** The buildings the store lists by tab; tapping one opens its upgrade page */
	const STORE_BUILDINGS: Record<'resources' | 'buildings', readonly BuildingKey[]> = {
		resources: [
			...WAREHOUSE_KEYS,
			'bunker',
			'house-0',
			'house-1',
			'house-2',
			'sawmill',
			'quarry',
			'mine'
		] as BuildingKey[],
		buildings: ['hq', 'training', 'radar', 'dojo', ...BOAT_KEYS]
	};
	const storeDefences = $derived(
		storeTab === 'guns' || storeTab === 'obstacles' ? STORE_CATEGORIES[storeTab] : []
	);
	/** The building whose build time an advert is about to cut */
	let adFor = $state<string | null>(null);

	const mineName = (kind: DefenseKind): string => buildingName(kind as BuildingKind);
	const mineHint = (kind: DefenseKind): string =>
		kind === 'mine-emp'
			? m.beachhead_mine_hint_emp()
			: kind === 'mine-at'
				? m.beachhead_mine_hint_at()
				: kind === 'mine-personnel'
					? m.beachhead_mine_hint_personnel()
					: '';

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
		if (key.startsWith('house-')) {
			return { name: m.beachhead_building_house(), hint: m.beachhead_building_house_hint() };
		}
		if (key === 'sawmill') {
			return { name: m.beachhead_building_sawmill(), hint: m.beachhead_resource_wood() };
		}
		if (key === 'quarry') {
			return { name: m.beachhead_building_quarry(), hint: m.beachhead_resource_stone() };
		}
		if (key === 'mine') {
			return { name: m.beachhead_building_mine(), hint: m.beachhead_resource_iron() };
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
			duration: game.buildDuration(key as BuildingKey),
			...describe(key),
			movable: isLayoutKey(key),
			boatLocked: boatIndex !== null && !(game.boats[boatIndex]?.unlocked ?? true),
			boatUnlockLevel: boatIndex === null ? 0 : boatIndex - 1
		};
	});

	/** Where the name tag and the round buttons of the selection sit, in percent of the picture */
	const anchor = $derived.by(() => {
		const current = selected;
		if (!current) return null;
		const at = homeAnchor(
			game.layout,
			current,
			(key) => game.levelOf(key as BuildingKey),
			(key) => game.maxLevelOf(key as BuildingKey)
		);
		if (!at) return null;
		const percent = (point: { x: number; y: number }) => ({
			x: (point.x / HOME_VIEW.width) * 100,
			y: (point.y / HOME_VIEW.height) * 100
		});
		return { top: percent(at.top), foot: percent(at.foot) };
	});

	/** What the tag over the selection says, and what its upgrade would cost */
	const tag = $derived.by(() => {
		const current = panel;
		if (!current) return null;
		if (current.type === 'mine') {
			return {
				name: mineName(current.mine.kind),
				level: defenseLevel(current.mine),
				remainingMs: game.defenseRemaining(current.mine.id),
				cost: game.defenseUpgradeCost(current.mine.id),
				canUpgrade: game.canUpgradeDefense(current.mine.id)
			};
		}
		const locked = game.upgradeLocked(current.key as BuildingKey);
		const cost = locked ? null : game.upgradeCost(current.key as BuildingKey);
		return {
			name: current.name,
			level: current.row.level,
			remainingMs: current.row.remainingMs,
			cost: current.row.remainingMs === null ? cost : null,
			canUpgrade: current.row.canStart
		};
	});

	/** Changes whenever something else is picked, so its tag and buttons pop up afresh */
	const selectionId = $derived(
		selected ? (selected.kind === 'building' ? selected.key : `mine-${selected.id}`) : ''
	);

	function openWindow(mode: 'info' | 'upgrade') {
		windowMode = mode;
		sheet = 'upgrade';
	}

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
			label: m.beachhead_store_title(),
			icon: IconStore,
			active: sheet === 'mines',
			onclick: () => (sheet = 'mines')
		},
		{
			id: 'crystals',
			label: m.beachhead_crystals_title(),
			icon: IconGem,
			active: sheet === 'crystals',
			onclick: () => (sheet = 'crystals')
		},
		{
			id: 'test',
			label: m.beachhead_test_start(),
			icon: IconShieldCheck,
			active: false,
			onclick: () => {
				game.startDefenseTest();
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
		const ratio = pixelRatio();
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
			crystalAt: (target) => game.crystals.slots[target],
			defenseProgress: (id) => {
				const task = game.campaign.builders.find((entry) => entry.defenseIds?.includes(id));
				if (!task) return null;
				return Math.min(
					1,
					Math.max(0, (Date.now() - task.startedAt) / Math.max(1, task.endsAt - task.startedAt))
				);
			},
			boatCount: game.boats.filter((boat) => boat.unlocked).length,
			boatUnits: (index) => game.boats[index]?.units ?? [],
			timeMs,
			arranging: dragging,
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
		const ratio = pixelRatio();
		canvas.style.width = `${HOME_VIEW.width * scale}px`;
		canvas.style.height = `${HOME_VIEW.height * scale}px`;
		canvas.width = Math.round(HOME_VIEW.width * scale * ratio);
		canvas.height = Math.round(HOME_VIEW.height * scale * ratio);
		draw(performance.now());
	}

	// While a builder is at work the hammer knocks in time with the swing, quietly so it stays a backdrop
	$effect(() => {
		if (game.buildersBusy === 0 || sheet !== null) return;
		const timer = setInterval(() => soundManager().play('hammer', 0.35), 1320);
		return () => clearInterval(timer);
	});

	onMount(() => {
		if (!stage || !canvas) return;
		context = canvas.getContext('2d');
		const observer = new ResizeObserver(resize);
		observer.observe(stage);
		const host = stage.parentElement;
		const onZoom = (event: Event) => {
			zoom = (event as CustomEvent<{ scale: number }>).detail.scale;
			resize();
		};
		host?.addEventListener('zoomchange', onZoom);
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
			host?.removeEventListener('zoomchange', onZoom);
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
		const hit = pickHome(
			HOME_VIEW,
			game.layout,
			boats,
			point.x,
			point.y,
			(key) => game.levelOf(key as BuildingKey) >= 1
		);
		// A tap picks a building: its name rises above it and its buttons wait underneath. Pressing on
		// what is already picked grabs it, and dragging moves it around the grid
		const already =
			hit !== null &&
			selected !== null &&
			hit.kind === selected.kind &&
			(hit.kind === 'building'
				? hit.key === (selected as { key: string }).key
				: hit.id === (selected as { id: number }).id);
		selected = hit;
		if (!hit || !already) return;
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
		const moved = drag.moved || cell.x !== drag.cell.x || cell.y !== drag.cell.y;
		drag = { ...drag, cell, valid: fits(drag.item, cell), moved };
	}

	function onPointerUp() {
		if (!drag) return;
		const done = drag;
		drag = null;
		dragging = false;
		if (!done.valid || !done.moved) return;
		if (done.item.kind === 'building') game.moveBuilding(done.item.key, done.cell);
		else game.moveMine(done.item.id, done.cell);
	}

	const costOf = (kind: DefenseKind): Resources => ({ ...DEFENSE_COST[kind] });
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

<div
	class="relative h-full w-full overflow-hidden bg-[#4fa8d8]"
	use:zoomPan={{ max: 3.5, singlePan: () => !dragging }}
>
	<div bind:this={stage} data-zoom class="absolute inset-0 flex items-center justify-center">
		<div class="relative shrink-0">
			<canvas
				bind:this={canvas}
				class="block shrink-0 select-none"
				class:cursor-grabbing={dragging}
				aria-label={m.beachhead_island_canvas_label()}
				onpointerdown={onPointerDown}
				onpointermove={onPointerMove}
				onpointerup={onPointerUp}
				onpointercancel={onPointerUp}
				oncontextmenu={(event) => event.preventDefault()}
			></canvas>
			{#if anchor && tag && !dragging}
				{#key selectionId}
					<!-- The name and level float above the picked building, the round buttons sit under it -->
					<div
						class="pinned-top pointer-events-none absolute z-10"
						style:left="{anchor.top.x}%"
						style:top="{anchor.top.y}%"
					>
						<div class="joy-tag flex flex-col items-center gap-0.5 text-center">
							{#if tag.remainingMs !== null}
								<span
									class="flex items-center gap-1 rounded-full border-2 border-ink bg-explosion-yellow px-2 font-display text-xs font-bold tabular-nums"
								>
									<IconHammer class="size-3.5" aria-hidden="true" />
									{timeLeft(tag.remainingMs)}
								</span>
							{/if}
							<span class="tag-text font-display text-lg leading-tight font-bold whitespace-nowrap">
								{tag.name}
							</span>
							<span class="tag-text font-display text-sm leading-none font-bold whitespace-nowrap">
								{m.beachhead_level_tag({ level: tag.level })}
							</span>
						</div>
					</div>
					<div
						class="pinned-foot absolute z-10 flex items-start gap-0.5"
						style:left="{anchor.foot.x}%"
						style:top="{anchor.foot.y}%"
					>
						<button
							type="button"
							class="btn-chunky flex size-12 items-center justify-center rounded-full p-0 text-flag-blue"
							aria-label={m.beachhead_info_button()}
							title={m.beachhead_info_button()}
							onclick={() => openWindow('info')}
						>
							<IconInfo class="size-7" aria-hidden="true" />
						</button>
						{#if tag.cost}
							<div class="flex flex-col items-center gap-0.5">
								<button
									type="button"
									class="btn-chunky flex size-12 items-center justify-center rounded-full p-0 text-[#2f9a4a]"
									class:opacity-70={!tag.canUpgrade}
									aria-label={m.beachhead_upgrade_button()}
									title={m.beachhead_upgrade_button()}
									onclick={() => openWindow('upgrade')}
								>
									<IconArrowBigUp class="size-8 fill-current" aria-hidden="true" />
								</button>
							</div>
						{/if}
						{#if panel?.type === 'building' && panel.row.remainingMs !== null && game.canCutBuild(panel.row.key)}
							{@const key = panel.row.key}
							<button
								type="button"
								class="btn-chunky flex size-12 items-center justify-center rounded-full bg-explosion-yellow p-0"
								aria-label={m.beachhead_ad_cut()}
								title={m.beachhead_ad_cut()}
								onclick={() => (adFor = key)}
							>
								<IconTv class="size-6" aria-hidden="true" />
							</button>
						{/if}
						{#if panel?.type === 'building' && panel.key === 'training'}
							<button
								type="button"
								class="btn-chunky flex size-12 items-center justify-center rounded-full p-0"
								aria-label={m.beachhead_open_training()}
								title={m.beachhead_open_training()}
								onclick={() => (sheet = 'training')}
							>
								<IconGraduationCap class="size-6" aria-hidden="true" />
							</button>
						{/if}
						{#if panel?.type === 'building' && panel.key === 'dojo'}
							<button
								type="button"
								class="btn-chunky flex size-12 items-center justify-center rounded-full p-0"
								aria-label={m.beachhead_open_hero()}
								title={m.beachhead_open_hero()}
								onclick={() => (sheet = 'hero')}
							>
								<IconCrown class="size-6" aria-hidden="true" />
							</button>
						{/if}
						{#if panel?.type === 'mine' && isRemovable(panel.mine.kind)}
							{@const id = panel.mine.id}
							<button
								type="button"
								class="btn-chunky flex size-12 items-center justify-center rounded-full p-0 text-tie-red"
								aria-label={m.beachhead_island_mine_sell()}
								title={m.beachhead_island_mine_sell()}
								onclick={() => game.sellMine(id)}
							>
								<IconTrash class="size-6" aria-hidden="true" />
							</button>
						{/if}
					</div>
				{/key}
			{/if}
		</div>
	</div>

	<!-- Top left: how many islands are in your hands; the retaken-islands warning sits under it -->
	<div
		class="pointer-events-none absolute top-(--hud-top) left-(--hud-left) z-20 flex max-w-[55%] flex-col items-start gap-1.5"
	>
		<button
			type="button"
			class="btn-chunky pointer-events-auto flex size-11 items-center justify-center rounded-full p-0 {sheet ===
			'trophies'
				? 'bg-explosion-yellow'
				: ''}"
			aria-label={m.beachhead_achievements_title()}
			title={m.beachhead_achievements_title()}
			aria-pressed={sheet === 'trophies'}
			onclick={() => (sheet = 'trophies')}
		>
			<IconTrophy class="size-6" aria-hidden="true" />
		</button>
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
				class="btn-chunky relative flex size-13 items-center justify-center rounded-full p-0 sm:size-15 {item.active
					? 'bg-explosion-yellow'
					: ''}"
				aria-label={item.label}
				title={item.label}
				aria-pressed={item.active}
				onclick={item.onclick}
			>
				<DockIcon class="size-7" aria-hidden="true" />
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
</div>

<RewardedAdModal
	open={adFor !== null}
	coins={0}
	claimLabel={m.beachhead_ad_cut()}
	onClaim={() => {
		if (adFor) game.cutBuildTime(adFor as BuildingKey);
	}}
	onClose={() => (adFor = null)}
/>

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
	open={sheet === 'upgrade' && selected !== null}
	title={tag
		? windowMode === 'upgrade' && tag.cost
			? m.beachhead_upgrade_to_level({ level: tag.level + 1 })
			: tag.name
		: m.beachhead_open_info()}
	onclose={() => (sheet = null)}
>
	{#if selected?.kind === 'building'}
		<BeachheadUpgradeWindow
			{game}
			building={selected.key}
			mode={windowMode}
			hint={panel?.type === 'building' ? panel.hint : ''}
		/>
	{:else if selected?.kind === 'mine'}
		<BeachheadUpgradeWindow
			{game}
			building=""
			defenseId={selected.id}
			mode={windowMode}
			hint={panel?.type === 'mine' ? mineHint(panel.mine.kind) : ''}
		/>
	{/if}
</BeachheadSheet>

<BeachheadSheet
	open={sheet === 'crystals'}
	title={m.beachhead_crystals_title()}
	onclose={() => (sheet = null)}
>
	<BeachheadCrystals {game} />
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
	title={m.beachhead_store_title()}
	onclose={() => (sheet = null)}
>
	{#if storeTab === 'obstacles'}
		<!-- All the mines share one allowance, the headquarters level plus one -->
		<p class="text-sm font-semibold tabular-nums">
			{m.beachhead_island_mines_count({
				count: defenseCount(game.layout, 'mine-at'),
				max: defenseCap('mine-at', game.levelOf('hq'))
			})}
		</p>
	{/if}
	<div class="flex gap-1.5" role="tablist">
		{#each STORE_TABS as tab (tab)}
			<button
				type="button"
				role="tab"
				aria-selected={storeTab === tab}
				class="btn-chunky px-3 py-1 text-sm {storeTab === tab ? 'bg-explosion-yellow' : ''}"
				onclick={() => (storeTab = tab)}
			>
				{tab === 'resources'
					? m.beachhead_store_resources()
					: tab === 'guns'
						? m.beachhead_store_guns()
						: tab === 'obstacles'
							? m.beachhead_store_obstacles()
							: m.beachhead_store_buildings()}
			</button>
		{/each}
	</div>
	{#if storeTab === 'resources' || storeTab === 'buildings'}
		<ul class="flex gap-2 overflow-x-auto pb-2">
			{#each STORE_BUILDINGS[storeTab] as key (key)}
				{@const level = game.levelOf(key)}
				<li class="shrink-0">
					<button
						type="button"
						class="flex w-28 flex-col items-center gap-1 rounded-[14px] border-2 border-ink bg-sand p-2"
						onclick={() => {
							selected = { kind: 'building', key };
							sheet = 'upgrade';
						}}
					>
						<span
							class="flex size-12 items-center justify-center rounded-full border-3 border-ink bg-paper shadow-[2px_2px_0_var(--color-ink)]"
						>
							{#if isLayoutKey(key)}
								<BeachheadPortrait
									type="building"
									kind={key}
									level={Math.max(1, level)}
									max={game.maxLevelOf(key)}
									size={46}
								/>
							{:else}
								<IconShip class="size-7" aria-hidden="true" />
							{/if}
						</span>
						<span class="text-center text-xs leading-tight font-bold">{describe(key).name}</span>
						{#if level === 0}
							<!-- Not built yet: it costs a builder and some resources, and the headquarters must be high enough -->
							{#if game.upgradeLocked(key)}
								<IconLock class="size-5" aria-hidden="true" />
							{:else if game.upgradeCost(key)}
								{@render costChips(game.upgradeCost(key) as Resources)}
							{/if}
						{:else}
							<span class="font-display text-xs font-bold tabular-nums">
								{level}/{game.maxLevelOf(key)}
							</span>
						{/if}
					</button>
				</li>
			{/each}
		</ul>
	{:else}
		<ul class="flex gap-2 overflow-x-auto pb-2">
			{#each storeDefences as kind (kind)}
				{@const unlocked = defenseUnlocked(kind, game.levelOf('hq'))}
				<li
					class="flex w-40 shrink-0 flex-col items-center gap-1.5 rounded-[14px] border-2 border-ink bg-sand p-2 {unlocked
						? ''
						: 'opacity-70'}"
				>
					<span
						class="flex size-12 items-center justify-center rounded-full border-3 border-ink bg-paper shadow-[2px_2px_0_var(--color-ink)]"
						title={mineHint(kind)}
					>
						<BeachheadPortrait type="defense" kind={kind as BuildingKind} size={46} />
					</span>
					<p class="text-center text-xs leading-tight font-bold">{mineName(kind)}</p>
					{#if unlocked && !isMineKind(kind)}
						{@const cap = defenseCap(kind, game.levelOf('hq'))}
						{@const placed = defenseCount(game.layout, kind)}
						<p
							class="rounded-full border-2 border-ink px-2 font-display text-xs font-bold tabular-nums {placed >=
							cap
								? 'bg-tie-red text-paper'
								: 'bg-paper'}"
							title={m.beachhead_defense_allowance({ count: placed, max: cap })}
						>
							{placed}/{cap}
						</p>
					{/if}
					{#if mineHint(kind)}
						<p class="text-center text-[0.7rem] leading-snug">{mineHint(kind)}</p>
					{/if}
					{#if storeTab === 'obstacles' && game.allDefenseUpgrades(kind).ids.length > 0}
						<!-- Every placed one of this kind goes up a level on a single builder -->
						<button
							type="button"
							class="btn-chunky flex h-8 items-center gap-1 rounded-full bg-explosion-yellow px-2 py-0 font-display text-xs font-bold tabular-nums"
							aria-label={m.beachhead_upgrade_all()}
							title={m.beachhead_upgrade_all()}
							disabled={game.buildersBusy >= game.builderSlots}
							onclick={() => game.upgradeAllDefenses(kind)}
						>
							<IconCircleArrowUp class="size-4" aria-hidden="true" />
							×{game.allDefenseUpgrades(kind).ids.length}
						</button>
					{/if}
					{#if unlocked}
						{@render costChips(costOf(kind))}
						<button
							type="button"
							class="btn-chunky flex size-9 items-center justify-center rounded-full p-0"
							aria-label={m.beachhead_island_mine_buy()}
							disabled={!game.canBuyMine(kind)}
							onclick={() => game.buyMine(kind)}
						>
							<IconCircleArrowUp class="size-5" aria-hidden="true" />
						</button>
					{:else if isGuard(kind)}
						<p
							class="flex items-center gap-1 font-display text-sm font-bold"
							title={m.beachhead_unlocks_at_hq({ level: GUARD_UNLOCK_HQ[kind] })}
						>
							<IconLock class="size-4" aria-hidden="true" />
							<IconFlag class="size-4" aria-hidden="true" />
							{GUARD_UNLOCK_HQ[kind]}
						</p>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
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

	/* Pinned onto the zoomed picture, but kept the same size on screen */
	.pinned-top {
		transform: translate(-50%, -100%) scale(calc(1 / var(--zoom, 1)));
		transform-origin: 50% 100%;
	}

	.pinned-foot {
		transform: translate(-50%, 0) scale(calc(1 / var(--zoom, 1)));
		transform-origin: 50% 0;
	}

	/* A little joy: the tag springs up and then bobs, the buttons bounce in one after another */
	.joy-tag {
		transform-origin: 50% 100%;
		animation:
			joy-spring 420ms cubic-bezier(0.3, 1.6, 0.5, 1) both,
			joy-bob 2.4s ease-in-out 420ms infinite;
	}

	.pinned-foot > :global(*) {
		animation: joy-spring 380ms cubic-bezier(0.3, 1.7, 0.5, 1) both;
	}

	.pinned-foot > :global(*:nth-child(2)) {
		animation-delay: 60ms;
	}

	.pinned-foot > :global(*:nth-child(3)) {
		animation-delay: 120ms;
	}

	.pinned-foot > :global(*:nth-child(4)) {
		animation-delay: 180ms;
	}

	@keyframes joy-spring {
		from {
			transform: scale(0.2) translateY(12px);
			opacity: 0;
		}
		to {
			transform: none;
			opacity: 1;
		}
	}

	@keyframes joy-bob {
		0%,
		100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-4px);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.joy-tag,
		.pinned-foot > :global(*) {
			animation: none;
		}
	}

	.tag-text {
		color: var(--color-paper);
		paint-order: stroke fill;
		-webkit-text-stroke: 4px var(--color-ink);
	}
</style>
