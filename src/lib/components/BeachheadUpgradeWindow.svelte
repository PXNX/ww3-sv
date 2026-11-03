<!--
	The upgrade window of a building, in the manner of a base builder: the building as it is now and as
	it will look after the upgrade side by side, what the upgrade changes in numbers, and for the
	headquarters everything it unlocks. The price, the build time and the button are at the bottom.
-->
<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import {
		boatCapacity,
		boatsAtHq,
		type BuildingKey,
		type Resources
	} from '#lib/game/beachhead/campaign.js';
	import { GUARD_KINDS, GUARD_UNLOCK_HQ, isLayoutKey } from '#lib/game/beachhead/baseLayout.js';
	import {
		BASE_CHARTED_ISLANDS,
		BUILDINGS,
		type BuildingKind
	} from '#lib/game/beachhead/config.js';
	import { buildingName } from '#lib/components/beachheadText.js';
	import BeachheadPortrait from '#lib/components/BeachheadPortrait.svelte';
	import ResourceIcon from '#lib/components/ResourceIcon.svelte';
	import type { BeachheadGame } from '#lib/stores/beachheadGame.svelte.js';
	import IconArrowRight from '~icons/lucide/arrow-right';
	import IconCircleArrowUp from '~icons/lucide/circle-arrow-up';
	import IconCrosshair from '~icons/lucide/crosshair';
	import IconHeart from '~icons/lucide/heart';
	import IconHourglass from '~icons/lucide/hourglass';
	import IconShip from '~icons/lucide/ship';
	import IconTrendingUp from '~icons/lucide/trending-up';

	let { game, building }: { game: BeachheadGame; building: string } = $props();

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
		} else if (key.startsWith('warehouse-')) {
			rows.push({
				label: m.beachhead_stat_capacity(),
				from: `${level * 500}`,
				to: `${next * 500}`
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

	function gunStats(kind: BuildingKind) {
		const stats = BUILDINGS[kind];
		return { hp: stats.hp, damage: stats.damage, range: stats.range };
	}
</script>

<div class="flex flex-col gap-3">
	<div class="flex items-center justify-center gap-3 sm:gap-6">
		{#if isLayoutKey(key)}
			<div class="flex flex-col items-center gap-1">
				<BeachheadPortrait type="building" kind={key} {level} {max} size={150} />
				<span
					class="rounded-full border-2 border-ink bg-paper px-2 font-display text-sm font-bold tabular-nums"
				>
					{level}
				</span>
			</div>
			{#if level < max}
				<IconArrowRight class="size-8 shrink-0 rtl:rotate-180" aria-hidden="true" />
				<div class="flex flex-col items-center gap-1">
					<div class="rounded-[18px] bg-explosion-yellow/40 p-1 ring-4 ring-explosion-yellow/60">
						<BeachheadPortrait type="building" kind={key} level={next} {max} size={150} />
					</div>
					<span
						class="rounded-full border-2 border-ink bg-explosion-yellow px-2 font-display text-sm font-bold tabular-nums"
					>
						{next}
					</span>
				</div>
			{/if}
		{:else}
			<IconShip class="size-16" aria-hidden="true" />
			<span class="font-display text-2xl font-bold tabular-nums">{level}</span>
			{#if level < max}
				<IconArrowRight class="size-8 rtl:rotate-180" aria-hidden="true" />
				<span class="font-display text-2xl font-bold text-khaki tabular-nums">{next}</span>
			{/if}
		{/if}
	</div>

	{#if stats.length > 0}
		<ul class="flex flex-col gap-1 rounded-[14px] border-2 border-ink bg-sand p-2">
			{#each stats as stat (stat.label)}
				<li
					class="flex items-center justify-between gap-2 font-display text-sm font-bold tabular-nums"
				>
					<span class="flex items-center gap-1.5">
						<IconTrendingUp class="size-4" aria-hidden="true" />
						{stat.label}
					</span>
					<span>
						{stat.from}
						<IconArrowRight class="inline size-3.5 rtl:rotate-180" aria-hidden="true" />
						<span class="text-[#2f8a49]">{stat.to}</span>
					</span>
				</li>
			{/each}
		</ul>
	{/if}

	{#if unlocks && (unlocks.boat !== null || unlocks.guns.length > 0)}
		<div class="flex flex-col gap-1.5">
			<h4 class="text-sm font-bold">{m.beachhead_unlocks_title()}</h4>
			<ul class="flex flex-wrap gap-2">
				{#if unlocks.boat !== null}
					<li
						class="flex items-center gap-2 rounded-[14px] border-2 border-ink bg-paper px-2 py-1"
						title={m.beachhead_building_boat({ index: unlocks.boat })}
					>
						<IconShip class="size-8" aria-hidden="true" />
						<span class="font-display text-sm font-bold tabular-nums">#{unlocks.boat}</span>
					</li>
				{/if}
				{#each unlocks.guns as kind (kind)}
					{@const info = gunStats(kind)}
					<li class="flex items-center gap-2 rounded-[14px] border-2 border-ink bg-paper px-2 py-1">
						<BeachheadPortrait type="defense" {kind} size={56} />
						<div class="flex flex-col font-display text-xs font-bold tabular-nums">
							<span class="font-body text-sm">{buildingName(kind)}</span>
							<span class="flex items-center gap-1"
								><IconHeart class="size-3.5" aria-hidden="true" />{info.hp}</span
							>
							{#if info.damage > 0}
								<span class="flex items-center gap-1">
									<IconCrosshair class="size-3.5" aria-hidden="true" />{info.damage} · {info.range}
								</span>
							{/if}
						</div>
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	{#if cost !== null && row.remainingMs === null}
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
			<span
				class="flex items-center gap-1 font-display text-sm font-bold tabular-nums"
				title={m.beachhead_build_time()}
			>
				<IconHourglass class="size-4" aria-hidden="true" />
				{timeText(game.buildDuration(key))}
			</span>
			<button
				type="button"
				class="btn-chunky flex size-11 items-center justify-center rounded-full bg-khaki p-0 text-paper"
				aria-label={m.beachhead_upgrade_button()}
				disabled={!row.canStart}
				onclick={() => game.upgrade(key)}
			>
				<IconCircleArrowUp class="size-6" aria-hidden="true" />
			</button>
		</div>
	{/if}
</div>
