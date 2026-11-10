<!--
	A support skill's detail view in the lab, built like a troop's: a big pulsing picture, what the
	skill does with every number it gains at the next level, and the price and research time of that
	level with the upgrade button or, while it is being researched, the countdown.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import type { Resources } from '#lib/game/beachhead/campaign.js';
	import {
		MAX_SUPPORT_SKILL_LEVEL,
		skillStatsAt,
		type SkillId
	} from '#lib/game/beachhead/config.js';
	import { SKILL_ICONS } from '#lib/components/beachheadIcons.js';
	import ResourceIcon from '#lib/components/ResourceIcon.svelte';
	import type { BeachheadGame } from '#lib/stores/beachheadGame.svelte.js';
	import IconArrowLeft from '~icons/lucide/arrow-left';
	import IconArrowRight from '~icons/lucide/arrow-right';
	import BeachheadUpgradeButton from '#lib/components/BeachheadUpgradeButton.svelte';
	import IconHourglass from '~icons/lucide/hourglass';
	import IconLock from '~icons/lucide/lock';
	import IconStar from '~icons/lucide/star';
	import IconTrendingUp from '~icons/lucide/trending-up';

	let {
		game,
		skill,
		name,
		onback
	}: { game: BeachheadGame; skill: SkillId; name: string; onback: () => void } = $props();

	const RESOURCE_KINDS = ['wood', 'stone', 'iron', 'gold'] as const;
	let now = $state(Date.now());
	onMount(() => {
		const timer = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(timer);
	});

	const Icon = $derived(SKILL_ICONS[skill]);
	const level = $derived(game.supportSkillLevel(skill));
	const cost = $derived(game.supportSkillCost(skill));
	const researching = $derived(game.research?.skill === skill ? game.research : null);
	const nextLevel = $derived(Math.min(MAX_SUPPORT_SKILL_LEVEL, level + 1));

	const clock = (ms: number): string => {
		const total = Math.max(0, Math.ceil(ms / 1000));
		const hours = Math.floor(total / 3600);
		const minutes = Math.floor((total % 3600) / 60);
		return hours > 0
			? `${hours}:${String(minutes).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
			: `${minutes}:${String(total % 60).padStart(2, '0')}`;
	};

	/** Every number the skill has, now and at the next level, with how much better it gets */
	const rows = $derived.by(() => {
		const current = skillStatsAt(skill, level);
		const next = skillStatsAt(skill, nextLevel);
		const list: { label: string; from: string; to: string; gain: string }[] = [];
		const add = (label: string, from: number, to: number, unit = '', digits = 1) => {
			if (!(from > 0 || to > 0)) return;
			const round = (value: number) => `${Math.round(value * 10 ** digits) / 10 ** digits}${unit}`;
			const delta = Math.round((to - from) * 10 ** digits) / 10 ** digits;
			list.push({
				label,
				from: round(from),
				to: round(to),
				gain: delta > 0 ? `+${delta}${unit}` : ''
			});
		};
		add(m.beachhead_stat_radius(), current.radius, next.radius);
		add(m.beachhead_hero_stat_damage(), current.damage, next.damage, '', 0);
		if (current.shells) {
			add(m.beachhead_stat_shells(), current.shells, next.shells ?? current.shells, '', 0);
		}
		if (current.durationMs) {
			add(
				m.beachhead_stat_duration(),
				current.durationMs / 1000,
				(next.durationMs ?? 0) / 1000,
				's'
			);
		}
		if (current.healPerSecond) {
			add(m.beachhead_stat_heal(), current.healPerSecond, next.healPerSecond ?? 0, '', 1);
		}
		return list;
	});
</script>

<button
	type="button"
	class="btn-chunky flex w-fit items-center gap-1 px-2 py-1 text-sm"
	onclick={onback}
>
	<IconArrowLeft class="size-4 rtl:rotate-180" aria-hidden="true" />
	{name}
</button>

<div class="grid gap-3 sm:grid-cols-[auto_1fr_auto] sm:items-start">
	<div
		class="relative flex size-36 items-center justify-center rounded-[20px] border-3 border-ink bg-banner-slate shadow-[3px_3px_0_var(--color-ink)]"
	>
		<span class="pulse absolute size-24 rounded-full border-4 border-explosion-yellow/70"></span>
		<span class="pulse late absolute size-24 rounded-full border-4 border-explosion-yellow/50"
		></span>
		<span
			class="relative flex size-20 items-center justify-center rounded-full border-3 border-ink bg-paper"
		>
			<Icon class="size-12" aria-hidden="true" />
		</span>
		<span
			class="absolute -end-2 -top-2 flex size-9 items-center justify-center rounded-full border-3 border-ink bg-explosion-yellow font-display text-lg font-bold tabular-nums"
		>
			{level}
		</span>
	</div>

	<ul class="flex flex-col gap-1 rounded-[14px] border-2 border-ink bg-sand p-2">
		{#each rows as row (row.label)}
			<li
				class="flex items-center justify-between gap-2 font-display text-sm font-bold tabular-nums"
			>
				<span class="flex items-center gap-1.5">
					<IconTrendingUp class="size-4" aria-hidden="true" />
					{row.label}
				</span>
				{#if level >= MAX_SUPPORT_SKILL_LEVEL || row.gain === ''}
					<span class="opacity-70">{row.from}</span>
				{:else}
					<span class="flex items-center gap-1">
						{row.from}
						<IconArrowRight class="size-3.5 rtl:rotate-180" aria-hidden="true" />
						<span class="text-[#2f8a49]">{row.to}</span>
						<span class="rounded-full bg-[#3fa65a] px-1.5 text-xs text-paper">{row.gain}</span>
					</span>
				{/if}
			</li>
		{/each}
	</ul>

	<div class="flex flex-col gap-1.5 rounded-[14px] border-2 border-ink bg-sand p-2 sm:w-48">
		<p class="flex items-center justify-between text-sm font-bold">
			{m.beachhead_troop_train()}
			<span class="font-display tabular-nums">{level}/{MAX_SUPPORT_SKILL_LEVEL}</span>
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
			{#if game.supportSkillLocked(skill)}
				<IconLock class="size-5" aria-label={m.beachhead_upgrade_locked()} />
			{:else}
				<BeachheadUpgradeButton
					label={m.beachhead_troop_train()}
					short={!game.canAfford(cost as Resources)}
					disabled={!game.canUpgradeSupportSkill(skill)}
					onclick={() => game.upgradeSupportSkill(skill)}
				>
					<IconHourglass class="size-4" aria-hidden="true" />
					{clock(game.skillResearchMs(skill))}
				</BeachheadUpgradeButton>
			{/if}
		{/if}
	</div>
</div>

<style>
	.pulse {
		animation: skill-pulse 1.8s ease-out infinite;
	}

	.late {
		animation-delay: 0.9s;
	}

	@keyframes skill-pulse {
		from {
			transform: scale(0.6);
			opacity: 1;
		}
		to {
			transform: scale(1.5);
			opacity: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.pulse {
			animation: none;
		}
	}
</style>
