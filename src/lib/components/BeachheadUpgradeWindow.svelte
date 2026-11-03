<!--
	The upgrade window of a building, in the manner of a base builder: the building as it is now and as
	it will look after the upgrade side by side, what the upgrade changes in numbers, and for the
	headquarters everything it unlocks. The price, the build time and the button are at the bottom.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import {
		boatCapacity,
		boatsAtHq,
		type BuildingKey,
		type Resources
	} from '#lib/game/beachhead/campaign.js';
	import {
		DEFENSE_LEVEL_GAIN,
		buildingHpScale,
		GUARD_KINDS,
		GUARD_UNLOCK_HQ,
		MAX_DEFENSE_LEVEL,
		defenseLevel,
		isLayoutKey
	} from '#lib/game/beachhead/baseLayout.js';
	import {
		BASE_CHARTED_ISLANDS,
		BUILDINGS,
		MINES,
		isMine,
		type BuildingKind
	} from '#lib/game/beachhead/config.js';
	import { buildingName } from '#lib/components/beachheadText.js';
	import BeachheadPortrait from '#lib/components/BeachheadPortrait.svelte';
	import ResourceIcon from '#lib/components/ResourceIcon.svelte';
	import type { BeachheadGame } from '#lib/stores/beachheadGame.svelte.js';
	import IconArrowRight from '~icons/lucide/arrow-right';
	import IconCircleArrowUp from '~icons/lucide/circle-arrow-up';
	import IconHourglass from '~icons/lucide/hourglass';
	import IconShip from '~icons/lucide/ship';
	import IconStar from '~icons/lucide/star';
	import IconTrendingUp from '~icons/lucide/trending-up';

	let { game, building, defenseId }: { game: BeachheadGame; building: string; defenseId?: number } =
		$props();

	/** A placed mine, gun or hedgehog being looked at instead of a building */
	const defense = $derived(
		defenseId === undefined ? null : (game.layout.mines.find((d) => d.id === defenseId) ?? null)
	);
	/** A ticking clock for the countdown while a builder raises this defence */
	let now = $state(Date.now());
	onMount(() => {
		const timer = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(timer);
	});
	const defenseLeft = $derived.by(() => {
		void now;
		return defense ? game.defenseRemaining(defense.id) : null;
	});
	const defenseNow = $derived(defense ? defenseLevel(defense) : 1);
	const defenseNext = $derived(Math.min(MAX_DEFENSE_LEVEL, defenseNow + 1));
	const defenseCost = $derived(defense ? game.defenseUpgradeCost(defense.id) : null);
	const defenseStats = $derived.by(() => {
		const rows: { label: string; from: string; to: string }[] = [];
		if (!defense) return rows;
		const kind = defense.kind as BuildingKind;
		const base = BUILDINGS[kind];
		const hp = (level: number) => Math.round(base.hp * (1 + DEFENSE_LEVEL_GAIN.hp * (level - 1)));
		const raw = isMine(kind) ? MINES[kind].damage : base.damage;
		const damage = (level: number) =>
			Math.round(raw * (1 + DEFENSE_LEVEL_GAIN.damage * (level - 1)));
		rows.push({
			label: m.beachhead_hero_stat_hp(),
			from: `${hp(defenseNow)}`,
			to: `${hp(defenseNext)}`
		});
		if (raw > 0) {
			rows.push({
				label: m.beachhead_hero_stat_damage(),
				from: `${damage(defenseNow)}`,
				to: `${damage(defenseNext)}`
			});
		}
		// What an upgrade leaves alone is listed too, so the page shows the whole defence
		if (base.range > 0) {
			rows.push({ label: m.beachhead_stat_range(), from: `${base.range}`, to: `${base.range}` });
		}
		if (base.reloadMs > 0) {
			const rate = `${Math.round(10000 / base.reloadMs) / 10}`;
			rows.push({ label: m.beachhead_stat_rate(), from: rate, to: rate });
		}
		return rows;
	});

	const RESOURCE_KINDS = ['wood', 'stone', 'iron', 'gold'] as const;
	const key = $derived(building as BuildingKey);
	const level = $derived(game.levelOf(key));
	const max = $derived(game.maxLevelOf(key));
	const next = $derived(Math.min(max, level + 1));
	const cost = $derived(game.upgradeCost(key));
	const row = $derived(game.buildRowFor(key));

	const timeText = (ms: number): string => {
		const total = Math.ceil(ms / 1000);
		const hours = Math.floor(total / 3600);
		const minutes = Math.floor((total % 3600) / 60);
		return hours > 0
			? `${hours}h ${minutes}m`
			: `${minutes}m ${String(total % 60).padStart(2, '0')}s`;
	};

	/** The numbers an upgrade changes, as a list of "from → to" rows */
	const stats = $derived.by(() => {
		const rows: { label: string; from: string; to: string }[] = [];
		// Every building gets sturdier with its level
		const baseHp = key === 'hq' ? BUILDINGS.hq.hp : BUILDINGS.depot.hp;
		if (!key.startsWith('boat-')) {
			rows.push({
				label: m.beachhead_hero_stat_hp(),
				from: `${Math.round(baseHp * buildingHpScale(Math.max(1, level)))}`,
				to: `${Math.round(baseHp * buildingHpScale(next))}`
			});
		}
		if (key === 'hq') {
			rows.push({
				label: m.beachhead_stat_income(),
				from: `+${25 * (level - 1)}%`,
				to: `+${25 * (next - 1)}%`
			});
			rows.push({
				label: m.beachhead_stat_level_cap(),
				from: `${level + 1}`,
				to: `${next + 1}`
			});
			rows.push({
				label: m.beachhead_stat_boats(),
				from: `${boatsAtHq(level)}`,
				to: `${boatsAtHq(next)}`
			});
		} else if (key.startsWith('warehouse-')) {
			rows.push({
				label: m.beachhead_stat_capacity(),
				from: `${level * 500}`,
				to: `${next * 500}`
			});
			rows.push({
				label: m.beachhead_stat_secured(),
				from: `${Math.round(game.securedShare * 100)}%`,
				to: `${Math.round(game.securedShare * 100)}%`
			});
		} else if (key.startsWith('boat-')) {
			rows.push({
				label: m.beachhead_stat_boat_space(),
				from: `${boatCapacity(level)}`,
				to: `${boatCapacity(next)}`
			});
		} else if (key === 'radar') {
			rows.push({
				label: m.beachhead_stat_charted(),
				from: `${BASE_CHARTED_ISLANDS + (level - 1) * 3}`,
				to: `${BASE_CHARTED_ISLANDS + (next - 1) * 3}`
			});
		} else if (key === 'bunker') {
			rows.push({
				label: m.beachhead_stat_secured(),
				from: `${Math.round((0.2 + (level - 1) * 0.12) * 100)}%`,
				to: `${Math.round((0.2 + (next - 1) * 0.12) * 100)}%`
			});
		} else if (key === 'training' || key === 'dojo') {
			rows.push({ label: m.beachhead_stat_level_cap(), from: `${level}`, to: `${next}` });
		}
		return rows;
	});

	/** What the headquarters opens at its next level: a landing craft, guns, and the higher caps */
	const unlocks = $derived.by(() => {
		if (key !== 'hq' || level >= max) return null;
		return {
			boat: boatsAtHq(next) > boatsAtHq(level) ? boatsAtHq(next) : null,
			guns: GUARD_KINDS.filter((kind) => GUARD_UNLOCK_HQ[kind] === next)
		};
	});
</script>

{#snippet statRow(stat: { label: string; from: string; to: string })}
	<li class="flex items-center justify-between gap-2 font-display text-sm font-bold tabular-nums">
		<span class="flex items-center gap-1.5">
			<IconTrendingUp class="size-4" aria-hidden="true" />
			{stat.label}
		</span>
		{#if stat.from === stat.to}
			<span class="opacity-70">{stat.from}</span>
		{:else}
			<span>
				{stat.from}
				<IconArrowRight class="inline size-3.5 rtl:rotate-180" aria-hidden="true" />
				<span class="text-[#2f8a49]">{stat.to}</span>
			</span>
		{/if}
	</li>
{/snippet}

<div class="flex flex-col gap-3">
	<!-- Only the next level is shown: what the building will look like once it is upgraded -->
	<div class="flex items-center justify-center gap-3">
		{#if defense}
			<div class="rounded-[18px] bg-explosion-yellow/40 p-1 ring-4 ring-explosion-yellow/60">
				<BeachheadPortrait type="defense" kind={defense.kind as BuildingKind} size={96} />
			</div>
			<span
				class="rounded-full border-2 border-ink bg-explosion-yellow px-2 font-display text-lg font-bold tabular-nums"
			>
				{defenseNext}
			</span>
		{:else if isLayoutKey(key)}
			<div class="rounded-[18px] bg-explosion-yellow/40 p-1 ring-4 ring-explosion-yellow/60">
				<BeachheadPortrait type="building" kind={key} level={next} {max} size={104} />
			</div>
			<span
				class="rounded-full border-2 border-ink bg-explosion-yellow px-2 font-display text-lg font-bold tabular-nums"
			>
				{next}
			</span>
		{:else}
			<IconShip class="size-12" aria-hidden="true" />
			<span class="font-display text-xl font-bold tabular-nums">
				{next}
			</span>
		{/if}
	</div>

	{#if defense}
		<ul class="flex flex-col gap-1 rounded-[14px] border-2 border-ink bg-sand p-2">
			{#each defenseStats as stat (stat.label)}
				{@render statRow(stat)}
			{/each}
		</ul>
		{#if defenseCost === null}
			<IconStar
				class="mx-auto size-6 text-explosion-yellow"
				aria-label={m.beachhead_upgrade_max()}
			/>
		{:else}
			<div class="flex flex-wrap items-center justify-between gap-2">
				<span class="flex flex-wrap items-center gap-1 font-display text-xs font-bold">
					{#each RESOURCE_KINDS as resource (resource)}
						{#if defenseCost[resource] > 0}
							<span
								class="inline-flex items-center gap-0.5 rounded-full border-2 border-ink py-px ps-0.5 pe-1.5 {game
									.resources[resource] >= defenseCost[resource]
									? 'bg-paper'
									: 'bg-tie-red text-paper'}"
							>
								<ResourceIcon kind={resource} class="size-4" />
								{defenseCost[resource]}
							</span>
						{/if}
					{/each}
				</span>
				{#if defenseLeft !== null}
					<span
						class="flex items-center gap-1 font-display text-sm font-bold text-flag-blue tabular-nums"
					>
						<IconHourglass class="size-4" aria-hidden="true" />
						{timeText(defenseLeft)}
					</span>
				{:else}
					<button
						type="button"
						class="btn-chunky flex h-11 items-center gap-1.5 rounded-full bg-khaki px-4 py-0 font-display text-sm font-bold text-paper tabular-nums"
						aria-label={m.beachhead_upgrade_button()}
						disabled={!game.canUpgradeDefense(defense.id)}
						onclick={() => game.upgradeDefense(defense.id)}
					>
						<IconCircleArrowUp class="size-5" aria-hidden="true" />
						<IconHourglass class="size-4" aria-hidden="true" />
						{timeText(game.defenseUpgradeTime(defense.id) ?? 0)}
					</button>
				{/if}
			</div>
		{/if}
	{/if}

	{#if !defense && stats.length > 0}
		<ul class="flex flex-col gap-1 rounded-[14px] border-2 border-ink bg-sand p-2">
			{#each stats as stat (stat.label)}
				{@render statRow(stat)}
			{/each}
		</ul>
	{/if}

	{#if !defense && unlocks && (unlocks.boat !== null || unlocks.guns.length > 0)}
		<div class="flex flex-col gap-1.5">
			<h4 class="text-sm font-bold">{m.beachhead_unlocks_title()}</h4>
			<ul class="flex flex-wrap gap-2">
				{#if unlocks.boat !== null}
					<li
						class="flex items-center gap-2 rounded-[14px] border-2 border-ink bg-paper px-2 py-1"
						title={m.beachhead_building_boat({ index: unlocks.boat })}
					>
						<IconShip class="size-10" aria-hidden="true" />
					</li>
				{/if}
				{#each unlocks.guns as kind (kind)}
					<li class="rounded-[14px] border-2 border-ink bg-paper p-1" title={buildingName(kind)}>
						<BeachheadPortrait type="defense" {kind} size={60} />
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	{#if !defense && cost !== null && row.remainingMs === null}
		<div class="flex flex-wrap items-center justify-between gap-2">
			<span class="flex flex-wrap items-center gap-1 font-display text-xs font-bold">
				{#each RESOURCE_KINDS as resource (resource)}
					{#if (cost as Resources)[resource] > 0}
						<span
							class="inline-flex items-center gap-0.5 rounded-full border-2 border-ink py-px ps-0.5 pe-1.5 {game
								.resources[resource] >= (cost as Resources)[resource]
								? 'bg-paper'
								: 'bg-tie-red text-paper'}"
						>
							<ResourceIcon kind={resource} class="size-4" />
							{(cost as Resources)[resource]}
						</span>
					{/if}
				{/each}
			</span>
			<button
				type="button"
				class="btn-chunky flex h-11 items-center gap-1.5 rounded-full bg-khaki px-4 py-0 font-display text-sm font-bold text-paper tabular-nums"
				aria-label={m.beachhead_upgrade_button()}
				disabled={!row.canStart}
				onclick={() => game.upgrade(key)}
			>
				<IconCircleArrowUp class="size-5" aria-hidden="true" />
				<IconHourglass class="size-4" aria-hidden="true" />
				{timeText(game.buildDuration(key))}
			</button>
		</div>
	{/if}
</div>
