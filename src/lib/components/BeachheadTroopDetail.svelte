<!--
	A troop's detail view in the lab: a big picture that acts out its attack in a loop, what it does
	and how hard, its level, and the price and research time of the next level with the upgrade button
	and, while it is being researched, the countdown.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { troopStatsForLevel, type Resources } from '#lib/game/beachhead/campaign.js';
	import { MAX_TROOP_LEVEL, TROOPS, type TroopKind } from '#lib/game/beachhead/config.js';
	import { troopName } from '#lib/components/beachheadText.js';
	import BeachheadPortrait from '#lib/components/BeachheadPortrait.svelte';
	import ResourceIcon from '#lib/components/ResourceIcon.svelte';
	import type { BeachheadGame } from '#lib/stores/beachheadGame.svelte.js';
	import IconArrowLeft from '~icons/lucide/arrow-left';
	import IconCircleArrowUp from '~icons/lucide/circle-arrow-up';
	import IconCircleDashed from '~icons/lucide/circle-dashed';
	import IconCrosshair from '~icons/lucide/crosshair';
	import IconGauge from '~icons/lucide/gauge';
	import IconHeart from '~icons/lucide/heart';
	import IconHourglass from '~icons/lucide/hourglass';
	import IconLock from '~icons/lucide/lock';
	import IconStar from '~icons/lucide/star';
	import IconSwords from '~icons/lucide/swords';
	import IconTimer from '~icons/lucide/timer';
	import IconUsers from '~icons/lucide/users';

	let { game, kind, onback }: { game: BeachheadGame; kind: TroopKind; onback: () => void } =
		$props();

	const RESOURCE_KINDS = ['wood', 'stone', 'iron', 'gold'] as const;
	let now = $state(Date.now());
	onMount(() => {
		const timer = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(timer);
	});

	const level = $derived(game.troopLevel(kind));
	const base = $derived(TROOPS[kind]);
	const stats = $derived(troopStatsForLevel(kind, level));
	const next = $derived(level < MAX_TROOP_LEVEL ? troopStatsForLevel(kind, level + 1) : stats);
	const peak = $derived(troopStatsForLevel(kind, MAX_TROOP_LEVEL));
	const cost = $derived(game.troopUpgradeCost(kind));
	const researching = $derived(game.research?.kind === kind ? game.research : null);

	const clock = (ms: number): string => {
		const total = Math.max(0, Math.ceil(ms / 1000));
		const hours = Math.floor(total / 3600);
		const minutes = Math.floor((total % 3600) / 60);
		return hours > 0
			? `${hours}:${String(minutes).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
			: `${minutes}:${String(total % 60).padStart(2, '0')}`;
	};

	/** What the troop does besides shooting: the second line of the "weapon detail" */
	const ability = $derived.by(() => {
		if (base.healRadius)
			return { icon: IconHeart, value: `${base.healAmount} · ${base.healRadius}` };
		if (base.commandRadius) return { icon: IconCircleDashed, value: `${base.commandRadius}` };
		if (base.spawnKind) return { icon: IconUsers, value: `${base.spawnCap ?? 0}` };
		if (base.splash) return { icon: IconCircleDashed, value: `${base.splash}` };
		return null;
	});
</script>

{#snippet bar(label: string, value: number, extra: number, max: number, Icon: typeof IconHeart)}
	<li class="flex items-center gap-2" title={label}>
		<Icon class="size-5 shrink-0" aria-hidden="true" />
		<div
			class="relative h-3.5 flex-1 overflow-hidden rounded-full border-2 border-ink bg-sand"
			role="meter"
			aria-label={label}
			aria-valuenow={value}
			aria-valuemin={0}
			aria-valuemax={max}
		>
			<div
				class="absolute inset-y-0 start-0 bg-khaki"
				style:width="{Math.min(100, (value / max) * 100)}%"
			></div>
			{#if extra > 0}
				<div
					class="absolute inset-y-0 bg-[#3fa65a]"
					style:inset-inline-start="{Math.min(100, (value / max) * 100)}%"
					style:width="{Math.min(100 - (value / max) * 100, (extra / max) * 100)}%"
				></div>
			{/if}
		</div>
		<span class="w-14 text-end font-display text-sm font-bold tabular-nums">
			{Math.round(value * 10) / 10}
		</span>
	</li>
{/snippet}

<button
	type="button"
	class="btn-chunky flex w-fit items-center gap-1 px-2 py-1 text-sm"
	onclick={onback}
>
	<IconArrowLeft class="size-4 rtl:rotate-180" aria-hidden="true" />
	{troopName(kind)}
</button>

<div class="grid gap-3 sm:grid-cols-[auto_1fr_auto] sm:items-start">
	<div
		class="relative flex size-36 items-center justify-center rounded-[20px] border-3 border-ink bg-banner-slate shadow-[3px_3px_0_var(--color-ink)]"
	>
		<BeachheadPortrait type="troop" {kind} {level} size={128} animated />
		<span
			class="absolute -end-2 -top-2 flex size-9 items-center justify-center rounded-full border-3 border-ink bg-explosion-yellow font-display text-lg font-bold tabular-nums"
		>
			{level}
		</span>
	</div>

	<ul class="flex flex-col gap-2">
		{@render bar(m.beachhead_hero_stat_hp(), stats.hp, next.hp - stats.hp, peak.hp, IconHeart)}
		{@render bar(
			m.beachhead_hero_stat_damage(),
			stats.damage,
			next.damage - stats.damage,
			peak.damage,
			IconSwords
		)}
		{@render bar(m.beachhead_stat_range(), base.range, 0, 7, IconCrosshair)}
		{@render bar(m.beachhead_stat_speed(), base.speed, 0, 4, IconGauge)}
		{@render bar(m.beachhead_stat_rate(), 1000 / base.attackMs, 0, 9, IconTimer)}
		{@render bar(m.beachhead_stat_space(), base.space, 0, 6, IconUsers)}
		{#if ability}
			{@const AbilityIcon = ability.icon}
			<li
				class="flex items-center gap-2 font-display text-sm font-bold tabular-nums"
				title={m.beachhead_stat_ability()}
			>
				<AbilityIcon class="size-5 shrink-0" aria-hidden="true" />
				{ability.value}
			</li>
		{/if}
	</ul>

	<div class="flex flex-col gap-1.5 rounded-[14px] border-2 border-ink bg-sand p-2 sm:w-48">
		<p class="flex items-center justify-between text-sm font-bold">
			{m.beachhead_troop_train()}
			<span class="font-display tabular-nums">{level}/{MAX_TROOP_LEVEL}</span>
		</p>
		{#if researching}
			<p class="flex items-center gap-1 font-display text-lg font-bold text-flag-blue tabular-nums">
				<IconHourglass class="size-5" aria-hidden="true" />
				{clock(researching.endsAt - now)}
			</p>
		{:else if cost === null}
			<IconStar class="size-6 text-explosion-yellow" aria-label={m.beachhead_upgrade_max()} />
		{:else}
			<span class="flex flex-wrap items-center gap-1 font-display text-xs font-bold">
				{#each RESOURCE_KINDS as resource (resource)}
					<span
						class="inline-flex items-center gap-0.5 rounded-full border-2 border-ink py-px ps-0.5 pe-1.5 {game
							.resources[resource] >= (cost as Resources)[resource]
							? 'bg-paper'
							: 'bg-tie-red text-paper'}"
					>
						<ResourceIcon kind={resource} class="size-4" />
						{(cost as Resources)[resource]}
					</span>
				{/each}
			</span>
			<p
				class="flex items-center gap-1 font-display text-sm font-bold tabular-nums"
				title={m.beachhead_build_time()}
			>
				<IconHourglass class="size-4" aria-hidden="true" />
				{clock((game.troopResearchMs(kind) / 1000) * 1000)}
			</p>
			{#if game.troopUpgradeLocked(kind)}
				<IconLock class="size-5" aria-label={m.beachhead_troop_locked()} />
			{:else}
				<button
					type="button"
					class="btn-chunky flex size-10 items-center justify-center rounded-full bg-khaki p-0 text-paper"
					aria-label={m.beachhead_troop_train()}
					disabled={!game.canUpgradeTroop(kind)}
					onclick={() => game.upgradeTroop(kind)}
				>
					<IconCircleArrowUp class="size-6" aria-hidden="true" />
				</button>
			{/if}
		{/if}
	</div>
</div>
