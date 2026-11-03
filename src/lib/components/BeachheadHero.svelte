<!--
	The commander's detail screen, laid out like the weapon details of a shooter: a portrait with his
	level on the left, stat bars in the middle that show what the next level adds in green, and the
	two upgrades on the right: his level and his command skill. Both are paid in cards found on
	conquered bases and in resources, and neither can pass the level of the dojo that trains him.
-->
<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { troopStatsForLevel, type Resources } from '#lib/game/beachhead/campaign.js';
	import BeachheadPortrait from '#lib/components/BeachheadPortrait.svelte';
	import {
		AZOV_COMMAND,
		MAX_TROOP_LEVEL,
		MAX_HERO_LEVEL,
		MAX_HERO_SKILL_LEVEL,
		TROOPS
	} from '#lib/game/beachhead/config.js';
	import ResourceIcon from '#lib/components/ResourceIcon.svelte';
	import type { BeachheadGame } from '#lib/stores/beachheadGame.svelte.js';
	import IconCircleArrowUp from '~icons/lucide/circle-arrow-up';
	import IconCircleDashed from '~icons/lucide/circle-dashed';
	import IconFlame from '~icons/lucide/flame';
	import IconHeart from '~icons/lucide/heart';
	import IconGem from '~icons/lucide/gem';
	import IconLock from '~icons/lucide/lock';
	import IconStar from '~icons/lucide/star';
	import IconSwords from '~icons/lucide/swords';
	import IconWind from '~icons/lucide/wind';

	let { game }: { game: BeachheadGame } = $props();
	/** Which of the two commanders is shown: the Azov commander or Prigozhin with his hammer */
	let selected = $state<'azov' | 'hero'>('azov');
	const heroLevel = $derived(game.troopLevel('hero'));
	const heroNow = $derived(troopStatsForLevel('hero', heroLevel));
	const heroNext = $derived(
		heroLevel < MAX_TROOP_LEVEL ? troopStatsForLevel('hero', heroLevel + 1) : heroNow
	);
	const heroPeak = $derived(troopStatsForLevel('hero', MAX_TROOP_LEVEL));
	const heroCost = $derived(game.troopUpgradeCost('hero'));

	const RESOURCE_KINDS = ['wood', 'stone', 'iron', 'gold'] as const;
	const level = $derived(game.heroLevel);
	const skill = $derived(game.heroSkill);
	const now = $derived(troopStatsForLevel('azov', level));
	const next = $derived(
		level < MAX_HERO_LEVEL
			? troopStatsForLevel('azov', level + 1)
			: troopStatsForLevel('azov', level)
	);
	const peak = $derived(troopStatsForLevel('azov', MAX_HERO_LEVEL));

	/** The aura after one more skill level, for the green part of its bars */
	const aura = $derived({
		radius: AZOV_COMMAND.radius,
		damage: AZOV_COMMAND.damagePerLevel * skill,
		speed: AZOV_COMMAND.speedPerLevel * skill
	});
	const auraNext = $derived({
		damage: AZOV_COMMAND.damagePerLevel * Math.min(MAX_HERO_SKILL_LEVEL, skill + 1),
		speed: AZOV_COMMAND.speedPerLevel * Math.min(MAX_HERO_SKILL_LEVEL, skill + 1)
	});

	const percent = (value: number): number => Math.round(value * 100);
</script>

{#snippet costChips(cost: Resources)}
	<span class="flex flex-wrap items-center gap-1 font-display text-xs font-bold">
		{#each RESOURCE_KINDS as resource (resource)}
			<span
				class="inline-flex items-center gap-0.5 rounded-full border-2 border-ink py-px ps-0.5 pe-1.5 {game
					.resources[resource] >= cost[resource]
					? 'bg-paper'
					: 'bg-tie-red text-paper'}"
			>
				<ResourceIcon kind={resource} class="size-4" />
				{cost[resource]}
			</span>
		{/each}
	</span>
{/snippet}

{#snippet bar(
	label: string,
	now: number,
	extra: number,
	max: number,
	shown: string,
	Icon: typeof IconHeart
)}
	<li class="flex items-center gap-2" title={label}>
		<Icon class="size-5 shrink-0" aria-hidden="true" />
		<div
			class="relative h-3.5 flex-1 overflow-hidden rounded-full border-2 border-ink bg-sand"
			role="meter"
			aria-label={label}
			aria-valuenow={now}
			aria-valuemin={0}
			aria-valuemax={max}
		>
			<div
				class="absolute inset-y-0 start-0 bg-khaki"
				style:width="{Math.min(100, (now / max) * 100)}%"
			></div>
			{#if extra > 0}
				<div
					class="absolute inset-y-0 bg-[#3fa65a]"
					style:inset-inline-start="{Math.min(100, (now / max) * 100)}%"
					style:width="{Math.min(100 - (now / max) * 100, (extra / max) * 100)}%"
				></div>
			{/if}
		</div>
		<span class="w-16 text-end font-display text-sm font-bold tabular-nums">{shown}</span>
	</li>
{/snippet}

<div class="flex gap-2" role="tablist">
	<button
		type="button"
		role="tab"
		aria-selected={selected === 'azov'}
		class="btn-chunky px-3 py-1 text-sm {selected === 'azov' ? 'bg-explosion-yellow' : ''}"
		onclick={() => (selected = 'azov')}
	>
		{m.beachhead_troop_azov()}
	</button>
	<button
		type="button"
		role="tab"
		aria-selected={selected === 'hero'}
		class="btn-chunky px-3 py-1 text-sm {selected === 'hero' ? 'bg-explosion-yellow' : ''}"
		onclick={() => (selected = 'hero')}
	>
		{m.beachhead_troop_hero()}
	</button>
</div>

{#if selected === 'hero'}
	<!-- Prigozhin: the hammer hits hard and every blow pulses healing through the troops around him -->
	<div class="grid gap-3 sm:grid-cols-[auto_1fr_auto] sm:items-start">
		<div class="flex flex-col items-center gap-1.5">
			<div
				class="relative flex size-28 items-center justify-center rounded-[20px] border-3 border-ink bg-banner-slate shadow-[3px_3px_0_var(--color-ink)]"
			>
				<BeachheadPortrait type="troop" kind="hero" level={heroLevel} size={104} animated />
				<span
					class="absolute -end-2 -top-2 flex size-9 items-center justify-center rounded-full border-3 border-ink bg-explosion-yellow font-display text-lg font-bold tabular-nums"
				>
					{heroLevel}
				</span>
			</div>
			<p class="font-bold">{m.beachhead_troop_hero()}</p>
		</div>
		<ul class="flex flex-col gap-2">
			{@render bar(
				m.beachhead_hero_stat_hp(),
				heroNow.hp,
				heroNext.hp - heroNow.hp,
				heroPeak.hp,
				`${heroNow.hp}`,
				IconHeart
			)}
			{@render bar(
				m.beachhead_hero_stat_damage(),
				heroNow.damage,
				heroNext.damage - heroNow.damage,
				heroPeak.damage,
				`${heroNow.damage}`,
				IconSwords
			)}
			{@render bar(
				m.beachhead_hero_stat_aura(),
				TROOPS.hero.healRadius ?? 0,
				0,
				TROOPS.hero.healRadius ?? 1,
				`${TROOPS.hero.healRadius ?? 0}`,
				IconCircleDashed
			)}
			{@render bar(
				m.beachhead_hero_stat_heal(),
				TROOPS.hero.healAmount ?? 0,
				0,
				TROOPS.hero.healAmount ?? 1,
				`${TROOPS.hero.healAmount ?? 0}`,
				IconHeart
			)}
		</ul>
		<div class="flex flex-col gap-2 sm:w-48">
			<div class="flex flex-col gap-1 rounded-[14px] border-2 border-ink bg-sand p-2">
				<p class="flex items-center justify-between text-sm font-bold">
					{m.beachhead_hero_upgrade()}
					<span class="font-display tabular-nums">{heroLevel}/{MAX_TROOP_LEVEL}</span>
				</p>
				{#if heroCost === null}
					<IconStar class="size-5 text-explosion-yellow" aria-label={m.beachhead_upgrade_max()} />
				{:else}
					{@render costChips(heroCost)}
					{#if game.troopUpgradeLocked('hero')}
						<IconLock class="size-5" aria-label={m.beachhead_troop_locked()} />
					{:else}
						<button
							type="button"
							class="btn-chunky flex size-9 items-center justify-center rounded-full bg-khaki p-0 text-paper"
							aria-label={m.beachhead_hero_upgrade()}
							disabled={!game.canUpgradeTroop('hero')}
							onclick={() => game.upgradeTroop('hero')}
						>
							<IconCircleArrowUp class="size-5" aria-hidden="true" />
						</button>
					{/if}
				{/if}
			</div>
		</div>
	</div>
{:else}
	<div class="grid gap-3 sm:grid-cols-[auto_1fr_auto] sm:items-start">
		<!-- Portrait -->
		<div class="flex flex-col items-center gap-1.5">
			<div
				class="relative flex size-28 items-center justify-center rounded-[20px] border-3 border-ink bg-banner-slate shadow-[3px_3px_0_var(--color-ink)]"
			>
				<svg viewBox="0 0 64 64" class="size-24" aria-hidden="true" stroke-linejoin="round">
					<path
						d="M8 62c2-14 12-20 24-20s22 6 24 20z"
						fill="#3b4048"
						stroke="#111"
						stroke-width="2.2"
					/>
					<path d="M24 44l8 10 8-10" fill="#c9c4bb" stroke="#111" stroke-width="1.8" />
					<circle cx="32" cy="26" r="13" fill="#f6c9a0" stroke="#111" stroke-width="2.2" />
					<path
						d="M19 30c2 10 8 16 13 16s11-6 13-16c-3 4-8 6-13 6s-10-2-13-6z"
						fill="#c9c4bb"
						stroke="#111"
						stroke-width="2"
					/>
					<path d="M18 22a14 12 0 0 1 28 0z" fill="#7c8c5c" stroke="#111" stroke-width="2.2" />
					<rect
						x="16"
						y="21"
						width="32"
						height="4"
						rx="2"
						fill="#5f6f45"
						stroke="#111"
						stroke-width="1.8"
					/>
					<circle cx="26.5" cy="29" r="1.6" fill="#111" />
					<circle cx="37.5" cy="29" r="1.6" fill="#111" />
					<path d="M30 52h4l-1 6h-2z" fill="#f5c83a" stroke="#111" stroke-width="1.4" />
				</svg>
				<span
					class="absolute -end-2 -top-2 flex size-9 items-center justify-center rounded-full border-3 border-ink bg-explosion-yellow font-display text-lg font-bold tabular-nums"
					title={m.beachhead_hero_level({ level })}
				>
					{level}
				</span>
			</div>
			<p class="font-bold">{m.beachhead_hero_name()}</p>
			<p
				class="flex items-center gap-1 rounded-full border-2 border-ink bg-paper px-2 font-display text-sm font-bold tabular-nums"
				title={m.beachhead_hero_cards({ cards: game.heroCards })}
			>
				<IconGem class="size-4" aria-hidden="true" />
				{game.heroCards}
			</p>
		</div>

		<!-- Stats -->
		<ul class="flex flex-col gap-2">
			{@render bar(
				m.beachhead_hero_stat_hp(),
				now.hp,
				next.hp - now.hp,
				peak.hp,
				`${now.hp}`,
				IconHeart
			)}
			{@render bar(
				m.beachhead_hero_stat_damage(),
				now.damage,
				next.damage - now.damage,
				peak.damage,
				`${now.damage}`,
				IconSwords
			)}
			{@render bar(
				m.beachhead_hero_stat_aura(),
				aura.radius,
				0,
				TROOPS.azov.commandRadius ?? aura.radius,
				`${aura.radius}`,
				IconCircleDashed
			)}
			{@render bar(
				m.beachhead_hero_stat_aura_damage(),
				aura.damage,
				auraNext.damage - aura.damage,
				AZOV_COMMAND.damagePerLevel * MAX_HERO_SKILL_LEVEL,
				`+${percent(aura.damage)}%`,
				IconFlame
			)}
			{@render bar(
				m.beachhead_hero_stat_aura_speed(),
				aura.speed,
				auraNext.speed - aura.speed,
				AZOV_COMMAND.speedPerLevel * MAX_HERO_SKILL_LEVEL,
				`+${percent(aura.speed)}%`,
				IconWind
			)}
		</ul>

		<!-- Upgrades -->
		<div class="flex flex-col gap-2 sm:w-48">
			{#each [{ id: 'level', title: m.beachhead_hero_upgrade(), at: level, max: MAX_HERO_LEVEL, cards: game.heroCardCost(), cost: game.heroUpgradeCost(), locked: game.heroUpgradeLocked(), can: game.canUpgradeHero(), go: () => game.upgradeHero() }, { id: 'skill', title: m.beachhead_hero_train_skill(), at: skill, max: MAX_HERO_SKILL_LEVEL, cards: game.skillCardCost(), cost: game.skillUpgradeCost(), locked: game.skillUpgradeLocked(), can: game.canUpgradeSkill(), go: () => game.upgradeSkill() }] as entry (entry.id)}
				<div class="flex flex-col gap-1 rounded-[14px] border-2 border-ink bg-sand p-2">
					<p class="flex items-center justify-between text-sm font-bold">
						{entry.title}
						<span class="font-display tabular-nums">{entry.at}/{entry.max}</span>
					</p>
					{#if entry.cost === null || entry.cards === null}
						<IconStar class="size-5 text-explosion-yellow" aria-label={m.beachhead_upgrade_max()} />
					{:else}
						{@render costChips(entry.cost)}
						<div class="flex items-center justify-between gap-2">
							<span
								class="flex items-center gap-1 rounded-full border-2 border-ink px-1.5 font-display text-xs font-bold tabular-nums {game.heroCards >=
								entry.cards
									? 'bg-paper'
									: 'bg-tie-red text-paper'}"
								title={m.beachhead_hero_next_level({ cards: entry.cards })}
							>
								<IconGem class="size-3.5" aria-hidden="true" />
								{entry.cards}
							</span>
							{#if entry.locked}
								<IconLock class="size-5" aria-label={m.beachhead_upgrade_locked()} />
							{:else}
								<button
									type="button"
									class="btn-chunky flex size-9 items-center justify-center rounded-full bg-khaki p-0 text-paper"
									aria-label={entry.title}
									disabled={!entry.can}
									onclick={entry.go}
								>
									<IconCircleArrowUp class="size-5" aria-hidden="true" />
								</button>
							{/if}
						</div>
					{/if}
				</div>
			{/each}
		</div>
	</div>
{/if}
