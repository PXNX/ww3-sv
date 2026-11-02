<!--
	The player's shore base: the four resources the islands produce, the headquarters, the training
	ground and the eight landing craft, all levelled with timed builds on one builder (two for Pro).
	The training ground improves the troops; below it the landing party is packed into the boats.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import type { Component } from 'svelte';
	import type { SvelteHTMLElements } from 'svelte/elements';
	import { m } from '#lib/paraglide/messages.js';
	import { ARMY_KINDS, type BuildingKey, type Resources } from '#lib/game/beachhead/campaign.js';
	import { MAX_TROOP_LEVEL, TROOPS, type TroopKind } from '#lib/game/beachhead/config.js';
	import { achievementHint, achievementName, troopName } from '#lib/components/beachheadText.js';
	import type { BeachheadGame } from '#lib/stores/beachheadGame.svelte.js';
	import IconAnvil from '~icons/lucide/anvil';
	import IconBlocks from '~icons/lucide/blocks';
	import IconBomb from '~icons/lucide/bomb';
	import IconCrosshair from '~icons/lucide/crosshair';
	import IconFlame from '~icons/lucide/flame';
	import IconTruck from '~icons/lucide/truck';
	import IconCheck from '~icons/lucide/check';
	import IconCoins from '~icons/lucide/coins';
	import IconDumbbell from '~icons/lucide/dumbbell';
	import IconFlag from '~icons/lucide/flag-triangle-right';
	import IconGavel from '~icons/lucide/gavel';
	import IconHeartPulse from '~icons/lucide/heart-pulse';
	import IconLeaf from '~icons/lucide/leaf';
	import IconLock from '~icons/lucide/lock';
	import IconMinus from '~icons/lucide/minus';
	import IconPlus from '~icons/lucide/plus';
	import IconSend from '~icons/lucide/send';
	import IconShield from '~icons/lucide/shield';
	import IconShip from '~icons/lucide/ship';
	import IconTarget from '~icons/lucide/target';
	import IconTreePalm from '~icons/lucide/tree-palm';
	import IconTrophy from '~icons/lucide/trophy';
	import IconUsers from '~icons/lucide/users';
	import IconWrench from '~icons/lucide/wrench';

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

	const TROOP_ICONS: Record<TroopKind, Component<SvelteHTMLElements['svg']>> = {
		assault: IconUsers,
		tank: IconShield,
		mortar: IconTarget,
		drone: IconSend,
		medic: IconHeartPulse,
		hero: IconGavel,
		artillery: IconCrosshair,
		apc: IconTruck,
		demo: IconBomb,
		heavy: IconFlame
	};

	const BUILD_ICONS: Record<'hq' | 'training' | 'boat', Component<SvelteHTMLElements['svg']>> = {
		hq: IconFlag,
		training: IconDumbbell,
		boat: IconShip
	};

	let clock = $state(0);

	// Supplies tick in whole minutes and builds finish over time; checking often keeps both close
	onMount(() => {
		const timer = setInterval(() => {
			clock = Date.now();
			game.tick();
		}, 5_000);
		return () => clearInterval(timer);
	});

	const timeLeft = (ms: number): string => {
		const total = Math.max(0, Math.ceil(ms / 1000));
		const minutes = Math.floor(total / 60);
		const seconds = total % 60;
		return `${minutes}:${String(seconds).padStart(2, '0')}`;
	};

	const buildCards = $derived.by(() => {
		void clock;
		return game.buildRows().map((row) => {
			const boatIndex = row.key.startsWith('boat-') ? Number(row.key.slice('boat-'.length)) : null;
			const boat = boatIndex === null ? null : game.boats[boatIndex];
			return {
				...row,
				boatIndex,
				unlocked: boat?.unlocked ?? true,
				capacity: boat?.capacity ?? 0,
				name:
					row.key === 'hq'
						? m.beachhead_upgrade_hq()
						: row.key === 'training'
							? m.beachhead_building_training()
							: m.beachhead_building_boat({ index: (boatIndex ?? 0) + 1 }),
				hint:
					row.key === 'hq'
						? m.beachhead_building_hq_hint()
						: row.key === 'training'
							? m.beachhead_building_training_hint()
							: m.beachhead_building_boat_hint({ space: boat?.capacity ?? 0 }),
				icon: BUILD_ICONS[row.key === 'hq' ? 'hq' : row.key === 'training' ? 'training' : 'boat'],
				unlockLevel: boatIndex === null ? 0 : boatIndex - 1
			};
		});
	});

	const troopCards = $derived.by(() => {
		void clock;
		return (Object.keys(TROOPS) as TroopKind[]).map((kind) => {
			const stats = game.troopStats(kind);
			return {
				kind,
				icon: TROOP_ICONS[kind],
				level: game.troopLevel(kind),
				stats,
				cost: game.troopUpgradeCost(kind),
				locked: game.troopUpgradeLocked(kind),
				canTrain: game.canUpgradeTroop(kind)
			};
		});
	});

	const boatCards = $derived.by(() => {
		void clock;
		return game.boats.map((boat) => ({
			...boat,
			counts: ARMY_KINDS.map((kind) => ({
				kind,
				count: boat.units.filter((unit) => unit === kind).length
			})).filter((entry) => entry.count > 0)
		}));
	});

	const canAdd = (kind: Exclude<TroopKind, 'hero'>): boolean =>
		game.armyCapacity - game.armyUsed >= TROOPS[kind].space;
</script>

<section class="flex flex-col gap-4" aria-labelledby="beachhead-base-title">
	<div class="flex flex-wrap items-end justify-between gap-2">
		<div class="flex items-center gap-3">
			<span
				class="flex size-14 shrink-0 items-center justify-center rounded-[14px_8px_16px_10px] border-3 border-ink bg-khaki text-paper shadow-[3px_3px_0_var(--color-ink)]"
			>
				<IconTreePalm class="size-8" aria-hidden="true" />
			</span>
			<div>
				<h2 id="beachhead-base-title" class="text-2xl font-bold">{m.beachhead_base_title()}</h2>
				<p>{m.beachhead_base_intro()}</p>
			</div>
		</div>
		<p class="rounded-md border-2 border-ink bg-paper px-2 py-0.5 font-display font-bold">
			{m.beachhead_controlled_count({ count: game.controlled, total: game.islandCount })}
		</p>
	</div>

	<!-- The resource bar: what is in the warehouse, and what every minute adds to it -->
	<div class="sticker flex flex-wrap items-center justify-between gap-3 p-3" style:--tilt="-0.5deg">
		<div>
			<h3 class="font-bold">{m.beachhead_resources_title()}</h3>
			<ul class="flex flex-wrap gap-2 font-display font-bold">
				{#each RESOURCES as resource (resource.kind)}
					{@const Icon = resource.icon}
					<li
						class="flex items-center gap-1 rounded-md border-2 border-ink bg-paper px-2 py-0.5 tabular-nums"
						title={resource.label()}
					>
						<Icon class="size-4" aria-hidden="true" />
						{game.resources[resource.kind]}
						<span class="text-smoke text-xs font-semibold">
							{m.beachhead_resource_rate({ amount: game.income[resource.kind] })}
						</span>
					</li>
				{/each}
			</ul>
		</div>
		<div class="text-right text-sm font-semibold">
			<p>{m.beachhead_income_summary(game.income)}</p>
			<p class="flex items-center justify-end gap-1">
				<IconWrench class="size-4" aria-hidden="true" />
				{m.beachhead_builders({ busy: game.buildersBusy, total: game.builderSlots })}
			</p>
			{#if !game.isPro}
				<p class="text-smoke text-xs">{m.beachhead_builders_pro()}</p>
			{/if}
		</div>
	</div>

	<div
		class="relative overflow-hidden rounded-[18px_10px_16px_8px] border-3 border-ink bg-sand shadow-[4px_4px_0_var(--color-ink)]"
	>
		<div
			class="h-12 border-b-3 border-ink bg-flag-blue"
			aria-hidden="true"
			style:background-image="repeating-linear-gradient(90deg,#fff3 0 18px,#0000 18px 24px)"
		></div>
		<div class="flex flex-wrap items-center justify-between gap-3 p-4">
			<div class="flex items-center gap-3">
				<IconTreePalm class="size-12 shrink-0 text-khaki" aria-hidden="true" />
				<div>
					<p class="text-lg font-bold">{m.beachhead_home_base()}</p>
					<p class="text-sm font-semibold">{m.beachhead_tutorial_base()}</p>
				</div>
			</div>
			<button type="button" class="btn-chunky bg-flag-blue text-lg" onclick={() => game.goMap()}>
				{m.beachhead_to_map()}
			</button>
		</div>
	</div>

	{#snippet costChips(cost: Resources)}
		<span class="flex flex-wrap items-center justify-center gap-1.5 font-display text-xs font-bold">
			{#each RESOURCES as resource (resource.kind)}
				{@const Icon = resource.icon}
				<span
					class="inline-flex items-center gap-0.5 rounded border-2 border-ink px-1 {game.resources[
						resource.kind
					] >= cost[resource.kind]
						? 'bg-paper'
						: 'bg-tie-red text-paper'}"
					title={resource.label()}
				>
					<Icon class="size-3" aria-hidden="true" />
					{cost[resource.kind]}
				</span>
			{/each}
		</span>
	{/snippet}

	<h3 class="text-xl font-bold">{m.beachhead_buildings_title()}</h3>
	{#if game.buildersBusy >= game.builderSlots}
		<p class="text-sm font-semibold text-tie-red">{m.beachhead_builders_busy()}</p>
	{/if}
	<ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
		{#each buildCards as card (card.key)}
			{@const Icon = card.icon}
			<li>
				<div class="sticker flex h-full flex-col gap-2 p-3" style:--tilt="-0.8deg">
					<div class="flex items-center gap-2">
						<Icon class="size-6 shrink-0" aria-hidden="true" />
						<div class="leading-tight">
							<p class="font-bold">{card.name}</p>
							{#key card.level}
								<p class="pop-in text-xs font-semibold">
									{m.beachhead_upgrade_level({ level: card.level, max: card.max })}
								</p>
							{/key}
						</div>
					</div>
					<p class="text-sm leading-snug">{card.hint}</p>
					<div class="flex gap-1" aria-hidden="true">
						{#each Array.from({ length: card.max }, (_, index) => index + 1) as pip (pip)}
							<span
								class="h-2 flex-1 rounded-sm border-2 border-ink {pip <= card.level
									? 'bg-khaki'
									: 'bg-paper'}"
							></span>
						{/each}
					</div>
					{#if card.remainingMs !== null}
						<p class="flex items-center gap-1 text-sm font-bold text-flag-blue">
							<IconWrench class="size-4" aria-hidden="true" />
							{m.beachhead_building_remaining({ time: timeLeft(card.remainingMs) })}
						</p>
					{:else if !card.unlocked}
						<p class="flex items-center gap-1 text-sm font-semibold">
							<IconLock class="size-4" aria-hidden="true" />
							{m.beachhead_boat_locked({ level: card.unlockLevel })}
						</p>
					{:else if card.locked}
						<p class="flex items-center gap-1 text-sm font-semibold">
							<IconLock class="size-4" aria-hidden="true" />
							{m.beachhead_upgrade_locked()}
						</p>
					{:else if card.cost === null}
						<p class="mt-auto text-center text-sm font-bold">{m.beachhead_upgrade_max()}</p>
					{:else}
						{@render costChips(card.cost)}
						<button
							type="button"
							class="btn-chunky mt-auto w-full text-sm"
							disabled={!card.canStart}
							onclick={() => game.upgrade(card.key as BuildingKey)}
						>
							{m.beachhead_upgrade_button()}
						</button>
					{/if}
				</div>
			</li>
		{/each}
	</ul>

	<h3 class="text-xl font-bold">{m.beachhead_training_title()}</h3>
	<p class="text-sm font-semibold">{m.beachhead_training_intro()}</p>
	<ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
		{#each troopCards as troop (troop.kind)}
			{@const Icon = troop.icon}
			<li>
				<div class="sticker flex h-full flex-col gap-2 p-3" style:--tilt="0.7deg">
					<div class="flex items-center gap-2">
						<Icon class="size-6 shrink-0" aria-hidden="true" />
						<div class="leading-tight">
							<p class="font-bold">{troopName(troop.kind)}</p>
							<p class="text-xs font-semibold">
								{m.beachhead_troop_level({ level: troop.level, max: MAX_TROOP_LEVEL })}
							</p>
						</div>
					</div>
					<p class="text-xs font-semibold">
						{m.beachhead_troop_stats({ hp: troop.stats.hp, damage: troop.stats.damage })}
						· {m.beachhead_troop_space({ space: troop.stats.space })}
					</p>
					{#if troop.kind === 'hero'}
						<p class="text-sm leading-snug">{m.beachhead_troop_hero_hint()}</p>
					{/if}
					{#if troop.cost === null}
						<p class="mt-auto text-center text-sm font-bold">{m.beachhead_upgrade_max()}</p>
					{:else if troop.locked}
						<p class="mt-auto flex items-center justify-center gap-1 text-sm font-semibold">
							<IconLock class="size-4" aria-hidden="true" />
							{m.beachhead_troop_locked()}
						</p>
					{:else}
						{@render costChips(troop.cost)}
						<button
							type="button"
							class="btn-chunky mt-auto w-full text-sm"
							disabled={!troop.canTrain}
							onclick={() => game.upgradeTroop(troop.kind)}
						>
							{m.beachhead_troop_train()}
						</button>
					{/if}
				</div>
			</li>
		{/each}
	</ul>

	<h3 class="text-xl font-bold">{m.beachhead_army_title()}</h3>
	<p class="text-sm font-semibold">
		{m.beachhead_army_capacity({ used: game.armyUsed, capacity: game.armyCapacity })}
	</p>
	<ul class="grid gap-2 sm:grid-cols-2">
		{#each ARMY_KINDS as kind (kind)}
			{@const Icon = TROOP_ICONS[kind]}
			<li
				class="flex items-center justify-between gap-2 rounded-md border-2 border-ink bg-paper px-2 py-1"
			>
				<span class="flex items-center gap-1.5 font-bold">
					<Icon class="size-4" aria-hidden="true" />
					{troopName(kind)}
				</span>
				<span class="flex items-center gap-1">
					<button
						type="button"
						class="btn-chunky px-2 py-0.5 text-sm"
						aria-label={m.beachhead_army_remove({ troop: troopName(kind) })}
						disabled={game.campaign.army[kind] <= 0}
						onclick={() => game.changeTroop(kind, -1)}
					>
						<IconMinus class="size-3" aria-hidden="true" />
					</button>
					<span class="w-8 text-center font-display font-bold tabular-nums">
						{game.campaign.army[kind]}
					</span>
					<button
						type="button"
						class="btn-chunky px-2 py-0.5 text-sm"
						aria-label={m.beachhead_army_add({ troop: troopName(kind) })}
						disabled={!canAdd(kind)}
						onclick={() => game.changeTroop(kind, 1)}
					>
						<IconPlus class="size-3" aria-hidden="true" />
					</button>
				</span>
			</li>
		{/each}
	</ul>
	{#if game.armyCapacity - game.armyUsed < 1}
		<p class="text-sm font-semibold text-tie-red">{m.beachhead_army_full()}</p>
	{/if}

	<h4 class="font-bold">{m.beachhead_boats_title()}</h4>
	<ul class="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
		{#each boatCards as boat (boat.index)}
			<li class="rounded-md border-2 border-ink bg-paper px-2 py-1">
				<p class="flex items-center gap-1 font-bold">
					<IconShip class="size-4" aria-hidden="true" />
					{m.beachhead_boat_label({ index: boat.index + 1 })}
					{#if boat.unlocked}
						<span class="ml-auto text-xs font-semibold">
							{m.beachhead_boat_units({ count: boat.units.length, capacity: boat.capacity })}
						</span>
					{:else}
						<IconLock class="ml-auto size-4" aria-hidden="true" />
					{/if}
				</p>
				{#if boat.unlocked}
					{#if boat.counts.length === 0}
						<p class="text-smoke text-xs font-semibold">{m.beachhead_boat_empty()}</p>
					{:else}
						<ul class="mt-1 flex flex-wrap gap-1">
							{#each boat.counts as entry (entry.kind)}
								{@const Icon = TROOP_ICONS[entry.kind]}
								<li
									class="flex items-center gap-0.5 rounded border-2 border-ink bg-sand px-1 text-xs font-bold"
									title={troopName(entry.kind)}
								>
									<Icon class="size-3" aria-hidden="true" />
									{entry.count}
								</li>
							{/each}
						</ul>
					{/if}
				{/if}
			</li>
		{/each}
	</ul>

	<h3 class="text-xl font-bold">{m.beachhead_achievements_title()}</h3>
	<ul class="grid gap-2 sm:grid-cols-2">
		{#each game.achievements as achievement (achievement.id)}
			<li
				class="flex flex-col gap-1 rounded-md border-2 border-ink px-2 py-1 {achievement.earned
					? 'bg-khaki text-paper'
					: 'bg-paper'}"
			>
				<p class="flex items-center gap-1 font-bold">
					<IconTrophy class="size-4" aria-hidden="true" />
					{achievementName(achievement.id)}
					{#if achievement.earned}
						<span class="ml-auto flex items-center gap-1 text-xs">
							<IconCheck class="size-4" aria-hidden="true" />
							{m.beachhead_achievement_earned()}
						</span>
					{:else}
						<span class="ml-auto text-xs">
							{m.beachhead_achievement_reward({ coins: achievement.coins })}
						</span>
					{/if}
				</p>
				<p class="text-sm leading-snug">{achievementHint(achievement.id)}</p>
				{#if achievement.id === 'all-stars' || achievement.id === 'fortress'}
					<p class="text-xs font-semibold">
						{m.beachhead_achievement_cosmetic({
							item:
								achievement.id === 'all-stars'
									? m.beachhead_cosmetic_cap()
									: m.beachhead_cosmetic_ogre_ears()
						})}
					</p>
				{/if}
			</li>
		{/each}
	</ul>
</section>
