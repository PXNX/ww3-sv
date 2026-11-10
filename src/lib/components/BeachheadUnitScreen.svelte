<!--
	The detail screen of a hero or a troop, laid out like the hero screen of a base builder. On the
	left the unit stands on a lit tile, drawn as in battle and acting out its attack in a loop, with
	its level, name and what it is for. On the right an Attack card and, for units that have one, a
	Skill card: every number is a bar that shows in green what the next level adds. The upgrades are
	along the bottom, each with its price and the one upgrade button, grey with a lock while short.
-->
<script lang="ts" module>
	import type { Component } from 'svelte';
	import type { SvelteHTMLElements } from 'svelte/elements';
	import type { Resources } from '#lib/game/beachhead/campaign.js';

	export interface UnitStat {
		label: string;
		icon: Component<SvelteHTMLElements['svg']>;
		now: number;
		/** The value at the next level; the difference shows in green */
		next?: number;
		/** The far end of the bar, usually the value at the top level */
		max: number;
		format?: (value: number) => string;
	}

	export interface UnitUpgrade {
		id: string;
		title: string;
		at: number;
		max: number;
		/** Null at the top level */
		cost: Resources | null;
		/** Shards the commander's upgrades take on top of the resources */
		cards?: number | null;
		timeMs?: number | null;
		/** Counting down while it is being trained */
		remainingMs?: number | null;
		/** Held back by the level of a building */
		locked: boolean;
		lockedLabel: string;
		can: boolean;
		go: () => void;
	}
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import type { TroopKind } from '#lib/game/beachhead/config.js';
	import BeachheadPortrait from '#lib/components/BeachheadPortrait.svelte';
	import BeachheadUpgradeButton from '#lib/components/BeachheadUpgradeButton.svelte';
	import ResourceIcon from '#lib/components/ResourceIcon.svelte';
	import type { BeachheadGame } from '#lib/stores/beachheadGame.svelte.js';
	import IconArrowLeft from '~icons/lucide/arrow-left';
	import IconGem from '~icons/lucide/gem';
	import IconHourglass from '~icons/lucide/hourglass';
	import IconLock from '~icons/lucide/lock';
	import IconSparkles from '~icons/lucide/sparkles';
	import IconStar from '~icons/lucide/star';
	import IconSwords from '~icons/lucide/swords';

	let {
		game,
		kind,
		level,
		name,
		hint = '',
		attack,
		skill,
		upgrades,
		extra,
		onback
	}: {
		game: BeachheadGame;
		kind: TroopKind;
		level: number;
		name: string;
		hint?: string;
		attack: { title: string; stats: UnitStat[] };
		skill?: { title: string; text?: string; stats: UnitStat[] } | null;
		upgrades: UnitUpgrade[];
		/** Something more under the name, such as the commander's shards */
		extra?: Snippet;
		onback?: () => void;
	} = $props();

	const RESOURCE_KINDS = ['wood', 'stone', 'iron', 'gold'] as const;
	const shown = (stat: UnitStat, value: number): string =>
		stat.format ? stat.format(value) : `${Math.round(value * 10) / 10}`;
	const clock = (ms: number): string => {
		const total = Math.max(0, Math.ceil(ms / 1000));
		const hours = Math.floor(total / 3600);
		const minutes = Math.floor((total % 3600) / 60);
		return hours > 0
			? `${hours}h ${minutes}m`
			: `${minutes}:${String(total % 60).padStart(2, '0')}`;
	};
	const short = (upgrade: UnitUpgrade): boolean =>
		(upgrade.cost !== null && !game.canAfford(upgrade.cost)) ||
		(upgrade.cards !== undefined && upgrade.cards !== null && game.heroCards < upgrade.cards);
</script>

{#snippet statRow(stat: UnitStat)}
	{@const gain = Math.max(0, (stat.next ?? stat.now) - stat.now)}
	{@const top = Math.max(stat.max, stat.next ?? 0, stat.now, 0.0001)}
	<li class="flex flex-col gap-0.5" title={stat.label}>
		<span class="flex items-center justify-between gap-2 text-sm font-bold">
			<span class="flex items-center gap-1.5">
				<stat.icon class="size-4 shrink-0" aria-hidden="true" />
				{stat.label}
			</span>
			<span class="flex items-center gap-1 font-display tabular-nums">
				{shown(stat, stat.now)}
				{#if gain > 0}
					<span class="rounded-full bg-[#3fa65a] px-1.5 text-xs text-paper">
						+{shown(stat, gain)}
					</span>
				{/if}
			</span>
		</span>
		<span
			class="flex h-3 overflow-hidden rounded-full border-2 border-ink bg-ink/70"
			role="meter"
			aria-label={stat.label}
			aria-valuenow={stat.now}
			aria-valuemin={0}
			aria-valuemax={top}
		>
			<span class="h-full bg-[#5aaee8]" style:width="{Math.min(100, (stat.now / top) * 100)}%"
			></span>
			{#if gain > 0}
				<span class="gain h-full bg-[#5fd068]" style:width="{(gain / top) * 100}%"></span>
			{/if}
		</span>
	</li>
{/snippet}

{#if onback}
	<button
		type="button"
		class="btn-chunky flex w-fit items-center gap-1 px-2 py-1 text-sm"
		onclick={onback}
	>
		<IconArrowLeft class="size-4 rtl:rotate-180" aria-hidden="true" />
		{name}
	</button>
{/if}

<div class="grid gap-3 sm:grid-cols-[12rem_1fr]">
	<!-- The unit on its lit tile, as it fights -->
	<div class="flex flex-col items-center gap-1.5">
		<div
			class="stage relative flex aspect-square w-full max-w-48 items-center justify-center rounded-[20px] border-3 border-ink"
		>
			{#key kind}
				<BeachheadPortrait type="troop" {kind} {level} size={168} animated />
			{/key}
			<span
				class="absolute -end-2 -top-2 flex size-10 items-center justify-center rounded-full border-3 border-ink bg-explosion-yellow font-display text-lg font-bold tabular-nums shadow-[2px_2px_0_var(--color-ink)]"
				title={m.beachhead_level_tag({ level })}
			>
				{level}
			</span>
		</div>
		<p class="text-center font-display text-lg leading-tight font-bold">{name}</p>
		{#if hint}
			<p class="text-center text-xs leading-snug">{hint}</p>
		{/if}
		{@render extra?.()}
	</div>

	<div class="flex min-w-0 flex-col gap-2">
		<section class="rounded-[14px] border-2 border-ink bg-sand p-2">
			<h4 class="mb-1.5 flex items-center gap-1.5 font-display font-bold">
				<IconSwords class="size-5" aria-hidden="true" />
				{attack.title}
			</h4>
			<ul class="flex flex-col gap-1.5">
				{#each attack.stats as stat (stat.label)}
					{@render statRow(stat)}
				{/each}
			</ul>
		</section>

		{#if skill}
			<section class="rounded-[14px] border-2 border-ink bg-[#ece3f7] p-2">
				<h4 class="flex items-center gap-1.5 font-display font-bold">
					<IconSparkles class="size-5 text-[#7a4fb5]" aria-hidden="true" />
					{skill.title}
				</h4>
				{#if skill.text}
					<p class="mb-1.5 text-xs leading-snug">{skill.text}</p>
				{/if}
				<ul class="flex flex-col gap-1.5">
					{#each skill.stats as stat (stat.label)}
						{@render statRow(stat)}
					{/each}
				</ul>
			</section>
		{/if}
	</div>
</div>

<!-- The upgrades, side by side along the bottom -->
<div class="grid gap-2 sm:grid-cols-2">
	{#each upgrades as upgrade (upgrade.id)}
		<div class="flex flex-col gap-1.5 rounded-[14px] border-2 border-ink bg-paper p-2">
			<p class="flex items-center justify-between text-sm font-bold">
				{upgrade.title}
				<span class="font-display tabular-nums">{upgrade.at}/{upgrade.max}</span>
			</p>
			{#if upgrade.remainingMs !== undefined && upgrade.remainingMs !== null}
				<p
					class="flex items-center gap-1 font-display text-lg font-bold text-flag-blue tabular-nums"
				>
					<IconHourglass class="size-5" aria-hidden="true" />
					{clock(upgrade.remainingMs)}
				</p>
			{:else if upgrade.cost === null}
				<p class="flex items-center gap-1 font-display text-sm font-bold">
					<IconStar class="size-5 text-explosion-yellow" aria-hidden="true" />
					{m.beachhead_upgrade_max()}
				</p>
			{:else}
				{@const cost = upgrade.cost}
				<div class="flex flex-wrap items-center justify-between gap-2">
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
						{#if upgrade.cards !== undefined && upgrade.cards !== null}
							<span
								class="inline-flex items-center gap-0.5 rounded-full border-2 border-ink px-1.5 tabular-nums {game.heroCards >=
								upgrade.cards
									? 'bg-paper'
									: 'bg-tie-red text-paper'}"
								title={m.beachhead_hero_next_level({ cards: upgrade.cards })}
							>
								<IconGem class="size-3.5" aria-hidden="true" />
								{upgrade.cards}
							</span>
						{/if}
					</span>
					{#if upgrade.locked}
						<span
							class="flex items-center gap-1 text-xs font-bold opacity-80"
							title={upgrade.lockedLabel}
						>
							<IconLock class="size-5" aria-hidden="true" />
						</span>
					{:else}
						<BeachheadUpgradeButton
							label={upgrade.title}
							short={short(upgrade)}
							disabled={!upgrade.can}
							onclick={upgrade.go}
						>
							{#if upgrade.timeMs}
								<IconHourglass class="size-4" aria-hidden="true" />
								{clock(upgrade.timeMs)}
							{/if}
						</BeachheadUpgradeButton>
					{/if}
				</div>
			{/if}
		</div>
	{/each}
</div>

<style>
	.stage {
		background:
			radial-gradient(circle at 50% 62%, rgb(255 255 255 / 0.5), transparent 58%),
			linear-gradient(#7cc4f0, #3b8fd9);
		box-shadow: 3px 3px 0 var(--color-ink);
	}

	.gain {
		background-image: repeating-linear-gradient(
			-45deg,
			rgb(255 255 255 / 0.25) 0 4px,
			transparent 4px 8px
		);
	}
</style>
