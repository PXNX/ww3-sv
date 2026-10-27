<!--
	The raid's results, shown in the game over card: the enemies defeated and the XP earned count
	up among the other stats, the defeats are broken down by enemy type in growing bars, then the
	level and season bars fill, and the gear and crystals found pop in one after another. On wider
	screens the stats and the progress sit side by side, so a sideways phone scrolls less.
-->
<script lang="ts">
	import { cubicOut } from 'svelte/easing';
	import { Tween } from 'svelte/motion';
	import { m } from '#lib/paraglide/messages.js';
	import {
		ARCHETYPES,
		MAX_PLAYER_LEVEL,
		RARITIES,
		RARITY_COLOR,
		SEASON_TIERS
	} from '#lib/game/raid/config.js';
	import { xpToNext } from '#lib/game/raid/profile.js';
	import { seasonTier, seasonTierProgress } from '#lib/game/raid/season.js';
	import type { GearItem } from '#lib/game/raid/items.js';
	import type { RaidResult } from '#lib/stores/raidGame.svelte.js';
	import RaidCrystalIcon from './RaidCrystalIcon.svelte';
	import RaidItemIcon from './RaidItemIcon.svelte';
	import { crystalName, ENEMY_NAMES, formatTime, itemName, RARITY_NAMES } from './raidText';
	import IconSkull from '~icons/lucide/skull';
	import IconSparkles from '~icons/lucide/sparkles';

	let { result, reducedMotion = false }: { result: RaidResult; reducedMotion?: boolean } = $props();

	const duration = $derived(reducedMotion ? 0 : 1400);
	const kills = new Tween(0, { easing: cubicOut });
	const xp = new Tween(0, { easing: cubicOut });
	/** Fills the bars once the card is up */
	let shown = $state(false);

	$effect(() => {
		void kills.set(result.kills, { duration });
		void xp.set(result.xp, { duration });
		const timer = setTimeout(() => (shown = true), reducedMotion ? 0 : 150);
		return () => clearTimeout(timer);
	});

	const breakdown = $derived(
		ARCHETYPES.map((archetype) => ({ archetype, count: result.killsBy[archetype] ?? 0 }))
			.filter((entry) => entry.count > 0)
			.sort((a, b) => b.count - a.count)
	);
	const most = $derived(Math.max(1, ...breakdown.map((entry) => entry.count)));

	const levelShare = $derived(
		result.level >= MAX_PLAYER_LEVEL ? 1 : Math.min(1, result.xpAfter / xpToNext(result.level))
	);
	const levelFrom = $derived(
		result.levelsGained > 0 ? 0 : Math.min(1, result.xpBefore / xpToNext(result.levelBefore))
	);

	const tierBefore = $derived(seasonTier(result.seasonXpBefore));
	const tierAfter = $derived(seasonTier(result.seasonXpAfter));
	const seasonProgress = $derived(seasonTierProgress(result.seasonXpAfter));
	const seasonShare = $derived(
		seasonProgress.needed > 0 ? seasonProgress.xp / seasonProgress.needed : 1
	);

	/** The rarest piece found, named under the loot icons */
	const topFind = $derived(
		result.gear.reduce<GearItem | null>(
			(best, item) =>
				!best || RARITIES.indexOf(item.rarity) > RARITIES.indexOf(best.rarity) ? item : best,
			null
		)
	);
</script>

<!-- Two columns on a sideways phone: what happened on the left, what it earned on the right -->
<div class="grid gap-3 text-start sm:grid-cols-2">
	<div class="flex flex-col gap-2">
		<dl class="grid grid-cols-4 gap-1 font-display text-xs">
			<div
				class="flex flex-col items-center rounded-md border-2 border-ink bg-tie-red p-1 text-center text-paper"
			>
				<dt class="flex items-center gap-0.5 leading-tight font-bold">
					<IconSkull class="size-3.5" aria-hidden="true" />{m.raid_result_kills_title()}
				</dt>
				<dd class="text-lg leading-tight font-bold tabular-nums">{Math.round(kills.current)}</dd>
			</div>
			<div
				class="flex flex-col items-center rounded-md border-2 border-ink bg-flag-blue p-1 text-center text-paper"
			>
				<dt class="flex items-center gap-0.5 leading-tight font-bold">
					<IconSparkles class="size-3.5" aria-hidden="true" />{m.raid_stat_xp()}
				</dt>
				<dd class="text-lg leading-tight font-bold tabular-nums">{Math.round(xp.current)}</dd>
			</div>
			{#each [{ label: m.raid_stat_time(), value: formatTime(result.timeMs) }, { label: m.raid_stat_gold(), value: result.gold }, { label: m.raid_result_damage(), value: result.damageDealt }, { label: m.raid_result_biggest_hit(), value: result.biggestHit }, { label: m.raid_stat_bosses(), value: result.bossKills }, { label: m.raid_stat_elites(), value: result.eliteKills }] as stat (stat.label)}
				<div
					class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-1 text-center"
				>
					<dt class="leading-tight font-bold">{stat.label}</dt>
					<dd class="text-sm leading-tight font-bold tabular-nums">{stat.value}</dd>
				</div>
			{/each}
		</dl>

		<!-- Defeats by enemy type -->
		{#if breakdown.length > 0}
			<ul class="flex flex-col gap-0.5" aria-label={m.raid_result_kills_title()}>
				{#each breakdown as { archetype, count }, index (archetype)}
					<li class="grid grid-cols-[6.5rem_1fr_2.5rem] items-center gap-2 text-xs font-bold">
						<span dir="auto" class="truncate">{ENEMY_NAMES[archetype]()}</span>
						<span class="h-2.5 overflow-hidden rounded-full border-2 border-ink bg-sand">
							<span
								class="bar block h-full"
								class:bg-tie-red={archetype !== 'boss'}
								class:bg-[#a64dff]={archetype === 'boss'}
								style:width="{shown ? (count / most) * 100 : 0}%"
								style:transition-delay="{reducedMotion ? 0 : index * 90}ms"
							></span>
						</span>
						<span class="text-end tabular-nums">{count}</span>
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	<div class="flex flex-col gap-2">
		<!-- Level and season bars -->
		<div class="flex flex-col gap-1 font-display text-xs font-bold">
			<div class="flex items-center gap-2">
				<span class="w-24 shrink-0">{m.raid_result_level({ level: result.level })}</span>
				<span class="h-3 flex-1 overflow-hidden rounded-full border-2 border-ink bg-sand">
					<span
						class="bar block h-full bg-flag-blue"
						style:width="{(shown ? levelShare : levelFrom) * 100}%"
					></span>
				</span>
			</div>
			{#if result.levelsGained > 0}
				<p
					dir="auto"
					class="pop-in rounded-md border-2 border-ink bg-explosion-yellow px-1.5 py-0.5 text-center text-sm"
				>
					{m.raid_result_level_up({ level: result.level })}
				</p>
			{/if}
			<div class="flex items-center gap-2">
				<span class="w-24 shrink-0"
					>{m.raid_season_tier({ tier: tierAfter, max: SEASON_TIERS })}</span
				>
				<span class="h-3 flex-1 overflow-hidden rounded-full border-2 border-ink bg-sand">
					<span class="bar block h-full bg-mustard" style:width="{(shown ? seasonShare : 0) * 100}%"
					></span>
				</span>
			</div>
			{#if tierAfter > tierBefore}
				<p
					dir="auto"
					class="pop-in rounded-md border-2 border-ink bg-khaki px-1.5 py-0.5 text-center text-sm text-paper"
				>
					{m.raid_result_season_up({ count: tierAfter - tierBefore })}
				</p>
			{/if}
		</div>

		<!-- Loot -->
		<div class="flex flex-col gap-1">
			<h3 class="flex items-baseline justify-between gap-2 font-display text-sm font-bold">
				{m.raid_result_loot()}
				<span class="text-xs tabular-nums">{m.raid_result_scrap()}: {result.scrap}</span>
			</h3>
			{#if result.gear.length === 0 && result.crystals.length === 0}
				<p class="text-sm opacity-80">{m.raid_result_no_loot()}</p>
			{:else}
				<ul class="flex flex-wrap gap-1">
					{#each result.gear as item, index (item.id)}
						<li
							class="loot"
							style:animation-delay="{reducedMotion ? 0 : 600 + index * 110}ms"
							title="{itemName(item)}, {RARITY_NAMES[item.rarity]()}, {m.raid_item_level({
								level: item.level
							})}"
						>
							<RaidItemIcon
								kind={item.type === 'weapon' ? item.kind : item.slot}
								rarity={item.rarity}
								class="size-9"
							/>
							<span class="sr-only">{itemName(item)}, {RARITY_NAMES[item.rarity]()}</span>
						</li>
					{/each}
					{#each result.crystals as crystal, index (index)}
						<li
							class="loot"
							style:animation-delay="{reducedMotion
								? 0
								: 600 + (result.gear.length + index) * 110}ms"
							title={crystalName(crystal)}
						>
							<RaidCrystalIcon kind={crystal.kind} rarity={crystal.rarity} class="size-9" />
							<span class="sr-only">{crystalName(crystal)}</span>
						</li>
					{/each}
				</ul>
				{#if topFind}
					<p dir="auto" class="text-xs font-bold" style:color={RARITY_COLOR[topFind.rarity]}>
						{RARITY_NAMES[topFind.rarity]()} · {itemName(topFind)} · {m.raid_item_level({
							level: topFind.level
						})}
					</p>
				{/if}
			{/if}
			{#if result.salvaged > 0}
				<p dir="auto" class="text-xs">
					{m.raid_result_salvaged_scrap({
						count: result.salvaged,
						gold: result.salvageGold,
						scrap: result.salvageScrap
					})}
				</p>
			{/if}
		</div>
	</div>
</div>

<style>
	.bar {
		transition: width 900ms cubic-bezier(0.22, 1, 0.36, 1);
	}

	.loot {
		animation: loot-in 420ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
	}

	@keyframes loot-in {
		from {
			opacity: 0;
			scale: 0.3;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.bar {
			transition: none;
		}

		.loot {
			animation: none;
		}
	}
</style>
