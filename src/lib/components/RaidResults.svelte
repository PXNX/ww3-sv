<!--
	The end of a raid, in two beats. First a banner over the frozen battlefield saying how it ended:
	a hunt shows the time held out; a boss fight "Victory" with its stars (one per 20 seconds left on
	the clock, the ones reached on this map for the first time lit up and paying XP) or "Time's up";
	a defense the waves held and whether the pot was cashed out or lost. Raids keep no high score.
	A tap or a moment later the full result screen follows: the XP earned counting up with the
	gold and scrap under it, the loot as tiles, today's quests as job cards whose bars grow by what
	this raid added, the level and season bars, the raid's numbers, and the player's agent beside the
	buttons to raid again or close, which goes back to the lobby.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { cubicOut } from 'svelte/easing';
	import { Tween } from 'svelte/motion';
	import { m } from '#lib/paraglide/messages.js';
	import { BOSS_MAX_STARS, MAX_PLAYER_LEVEL, SEASON_TIERS } from '#lib/game/raid/config.js';
	import { xpToNext } from '#lib/game/raid/profile.js';
	import { seasonTier, seasonTierProgress } from '#lib/game/raid/season.js';
	import type { ScoreCard } from '#lib/services/share.js';
	import { soundManager } from '#lib/sound/soundManager.svelte.js';
	import type { RaidResult } from '#lib/stores/raidGame.svelte.js';
	import Avatar from './Avatar.svelte';
	import Confetti from './Confetti.svelte';
	import RaidCrystalIcon from './RaidCrystalIcon.svelte';
	import RaidItemIcon from './RaidItemIcon.svelte';
	import RaidQuestCard from './RaidQuestCard.svelte';
	import ShareButton from './ShareButton.svelte';
	import {
		crystalName,
		ENEMY_NAMES,
		formatTime,
		itemName,
		MAP_NAMES,
		RARITY_NAMES
	} from './raidText';
	import IconCoins from '~icons/lucide/coins';
	import IconRotate from '~icons/lucide/rotate-ccw';
	import IconShield from '~icons/lucide/shield';
	import IconSparkles from '~icons/lucide/sparkles';
	import IconStar from '~icons/lucide/star';
	import IconTimer from '~icons/lucide/timer';
	import IconWrench from '~icons/lucide/wrench';

	let {
		result,
		isNewBest,
		modeName,
		drawBoard,
		reducedMotion = false,
		onRetry,
		onClose
	}: {
		result: RaidResult;
		isNewBest: boolean;
		modeName: string;
		drawBoard?: ScoreCard['drawBoard'];
		reducedMotion?: boolean;
		onRetry: () => void;
		onClose: () => void;
	} = $props();

	/** The banner's headline, by how the raid ended */
	const title = $derived(
		{
			raid: m.raid_gameover_title(),
			victory: m.raid_result_victory(),
			'time-up': m.raid_result_time_up(),
			'cashed-out': m.raid_result_cashed_out(),
			'post-lost': m.raid_result_post_lost(),
			'defense-lost': m.raid_result_defense_lost()
		}[result.outcome]
	);
	const lost = $derived(
		result.outcome === 'time-up' ||
			result.outcome === 'post-lost' ||
			result.outcome === 'defense-lost'
	);

	/** The banner first, then the full screen */
	let banner = $state(true);
	onMount(() => {
		soundManager().play(isNewBest ? 'new-best' : 'game-over');
		const timer = setTimeout(() => (banner = false), reducedMotion ? 1200 : 2600);
		return () => clearTimeout(timer);
	});

	const xp = new Tween(0, { easing: cubicOut });
	/** Grows the bars once the result screen is up */
	let shown = $state(false);
	$effect(() => {
		if (banner) return;
		void xp.set(result.xp, { duration: reducedMotion ? 0 : 1200 });
		const timer = setTimeout(() => (shown = true), reducedMotion ? 0 : 250);
		return () => clearTimeout(timer);
	});

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

	const killsBy = $derived(
		Object.entries(result.killsBy)
			.filter(([, count]) => count > 0)
			.sort((a, b) => b[1] - a[1]) as [keyof typeof ENEMY_NAMES, number][]
	);
	const numbers = $derived([
		{ label: m.raid_result_kills_title(), value: result.kills },
		{ label: m.raid_stat_bosses(), value: result.bossKills },
		{ label: m.raid_stat_elites(), value: result.eliteKills },
		{ label: m.raid_result_damage(), value: result.damageDealt },
		{ label: m.raid_result_biggest_hit(), value: result.biggestHit }
	]);
</script>

{#if banner}
	<button
		type="button"
		class="fixed inset-0 z-50 flex flex-col items-center justify-center gap-2 bg-linear-to-b from-[#1b1036]/30 via-[#1b1036]/55 to-[#1b1036]/30 text-white"
		onclick={() => (banner = false)}
	>
		<span
			class="banner-title font-display text-6xl font-black tracking-tight uppercase italic sm:text-7xl"
			class:text-[#ff8a8a]={lost}>{title}</span
		>
		{#if result.mode === 'boss'}
			<!-- The stars: new ones on this map burst in gold, ones reached before stay pale gold -->
			<span class="flex gap-1" aria-label="{result.stars}/{BOSS_MAX_STARS}">
				{#each { length: BOSS_MAX_STARS }, index (index)}
					{@const earned = index < result.stars}
					{@const fresh = earned && index >= result.starsBefore}
					<IconStar
						class="raid-star size-11 {fresh
							? 'fresh fill-[#ffc83a] text-[#e09a12]'
							: earned
								? 'fill-[#ffe9a8] text-[#c9a24a]'
								: 'fill-white/20 text-white/40'}"
						style="animation-delay: {reducedMotion ? 0 : 300 + index * 140}ms"
						aria-hidden="true"
					/>
				{/each}
			</span>
			{#if result.newStars > 0}
				<span
					class="pop-in mt-1 rounded-lg bg-[#ffc83a] px-3 py-0.5 font-display text-lg font-black text-[#3d1478]"
					>{m.raid_result_new_stars({ count: result.newStars, xp: result.starXp })}</span
				>
			{/if}
			{#if result.outcome === 'victory'}
				<span class="flex items-center gap-2 font-display text-4xl font-bold tabular-nums">
					<span class="text-xl uppercase opacity-80">{m.raid_result_boss_time()}</span>
					{formatTime(result.timeMs)}
				</span>
			{/if}
		{:else if result.mode === 'defense'}
			<span class="flex items-center gap-2 font-display text-5xl font-bold tabular-nums">
				<IconShield class="size-9" aria-hidden="true" />
				{result.wavesHeld}
				<span class="text-xl uppercase opacity-80">{m.raid_result_waves()}</span>
			</span>
			{#if result.forfeited}
				<span dir="auto" class="max-w-sm text-center text-base font-bold text-[#ffb3b3]"
					>{m.raid_result_pot_lost()}</span
				>
			{/if}
		{:else}
			<span class="flex items-center gap-2 font-display text-5xl font-bold tabular-nums">
				{formatTime(result.timeMs)}
				<IconTimer class="size-8" aria-hidden="true" />
			</span>
		{/if}
		<span class="mt-2 text-xs font-bold opacity-70">{m.raid_result_continue()}</span>
	</button>
{:else}
	<div
		class="fixed inset-0 z-50 overflow-y-auto bg-[radial-gradient(ellipse_at_80%_70%,#9a4fe0,#6a2bb8_45%,#3d1478)] pt-[calc(0.75rem+var(--top-inset))] pr-(--hud-right) pb-[calc(0.75rem+env(safe-area-inset-bottom))] pl-(--hud-left) text-white"
		role="dialog"
		aria-modal="true"
		aria-labelledby="raid-result-title"
	>
		{#if isNewBest}
			<Confetti />
		{/if}
		<h2 id="raid-result-title" class="sr-only">
			{title}: {MAP_NAMES[result.map]()}
		</h2>

		<div class="grid min-h-full gap-4 md:grid-cols-[minmax(0,1fr)_14rem]">
			<div class="flex min-w-0 flex-col gap-4">
				<div class="flex flex-wrap items-start gap-4">
					<!-- XP earned, with the gold and scrap -->
					<section class="flex flex-col gap-1">
						<h3 class="heading">{m.raid_stat_xp()}</h3>
						<div class="flex min-w-60 flex-col rounded-xl bg-[#1b0b3a]/80 px-4 py-2">
							<span class="flex items-center justify-end gap-2 font-display text-4xl font-bold">
								<span class="tabular-nums">{Math.round(xp.current)}</span>
								<IconSparkles class="size-8 text-[#7fd3ff]" aria-hidden="true" />
							</span>
							<span
								class="flex justify-between gap-4 font-display text-base font-bold text-white/85 tabular-nums"
							>
								<span class="flex items-center gap-1"
									><IconCoins class="size-4 text-[#ffd23a]" aria-hidden="true" /><span
										class="sr-only">{m.raid_stat_gold()}</span
									>{result.gold}</span
								>
								<span class="flex items-center gap-1"
									><IconWrench class="size-4 text-[#c9ced4]" aria-hidden="true" /><span
										class="sr-only">{m.raid_result_scrap()}</span
									>{result.scrap}</span
								>
								<span class="flex items-center gap-1"
									><IconTimer class="size-4" aria-hidden="true" /><span class="sr-only"
										>{m.raid_stat_time()}</span
									>{formatTime(result.timeMs)}</span
								>
							</span>
							{#if result.starXp > 0}
								<span
									class="flex items-center justify-end gap-1 font-display text-sm font-black text-[#ffc83a]"
								>
									<IconStar class="size-4 fill-[#ffc83a]" aria-hidden="true" />
									{m.raid_result_new_stars({ count: result.newStars, xp: result.starXp })}
								</span>
							{/if}
							{#if result.forfeited}
								<span dir="auto" class="max-w-60 text-xs font-bold text-[#ffb3b3]"
									>{m.raid_result_pot_lost()}</span
								>
							{/if}
						</div>
					</section>

					<!-- Loot -->
					<section class="flex min-w-0 flex-1 flex-col gap-1">
						<h3 class="heading">{m.raid_result_loot()}</h3>
						{#if result.gear.length === 0 && result.crystals.length === 0}
							<p class="rounded-xl bg-[#1b0b3a]/60 px-3 py-4 text-sm font-semibold opacity-85">
								{m.raid_result_no_loot()}
							</p>
						{:else}
							<ul class="flex flex-wrap gap-2">
								{#each result.gear as item, index (item.id)}
									<li
										class="loot relative rounded-xl bg-[#1b0b3a]/80 p-1.5"
										style:animation-delay="{reducedMotion ? 0 : 400 + index * 110}ms"
										title="{itemName(item)}, {RARITY_NAMES[item.rarity]()}, {m.raid_item_level({
											level: item.level
										})}"
									>
										<RaidItemIcon
											kind={item.type === 'weapon' ? item.kind : item.slot}
											rarity={item.rarity}
											class="size-14"
										/>
										<span
											class="absolute right-1 bottom-0.5 font-display text-xs font-black drop-shadow-[0_1px_0_#000]"
											>{m.raid_item_level({ level: item.level })}</span
										>
										<span class="sr-only">{itemName(item)}, {RARITY_NAMES[item.rarity]()}</span>
									</li>
								{/each}
								{#each result.crystals as crystal, index (index)}
									<li
										class="loot rounded-xl bg-[#1b0b3a]/80 p-1.5"
										style:animation-delay="{reducedMotion
											? 0
											: 400 + (result.gear.length + index) * 110}ms"
										title={crystalName(crystal)}
									>
										<RaidCrystalIcon kind={crystal.kind} rarity={crystal.rarity} class="size-14" />
										<span class="sr-only">{crystalName(crystal)}</span>
									</li>
								{/each}
							</ul>
						{/if}
						{#if result.salvaged > 0}
							<p dir="auto" class="text-xs opacity-85">
								{m.raid_result_salvaged_scrap({
									count: result.salvaged,
									gold: result.salvageGold,
									scrap: result.salvageScrap
								})}
							</p>
						{/if}
					</section>
				</div>

				<!-- Today's quests: the jobs this raid worked on -->
				<section class="flex flex-col gap-1">
					<h3 class="heading">{m.raid_quests_title()}</h3>
					<div class="grid gap-3 ps-2 pt-2 sm:grid-cols-2 lg:grid-cols-3">
						{#each result.quests as quest, index (index)}
							<RaidQuestCard
								{quest}
								before={result.questsBefore[index]?.progress ?? 0}
								{shown}
								delay={reducedMotion ? 0 : index * 150}
							/>
						{/each}
					</div>
				</section>

				<!-- Level, season and the raid's numbers -->
				<section class="grid gap-3 font-display text-xs font-bold sm:grid-cols-2">
					<div class="flex flex-col gap-1.5">
						<div class="flex items-center gap-2">
							<span class="w-24 shrink-0">{m.raid_result_level({ level: result.level })}</span>
							<span class="h-3 flex-1 overflow-hidden rounded-full bg-black/35">
								<span
									class="bar block h-full rounded-full bg-[#7fd3ff]"
									style:width="{(shown ? levelShare : levelFrom) * 100}%"
								></span>
							</span>
						</div>
						{#if result.levelsGained > 0}
							<p
								dir="auto"
								class="pop-in w-fit rounded-md bg-[#ffc83a] px-2 text-sm text-[#3d1478]"
							>
								{m.raid_result_level_up({ level: result.level })}
							</p>
						{/if}
						<div class="flex items-center gap-2">
							<span class="w-24 shrink-0"
								>{m.raid_season_tier({ tier: tierAfter, max: SEASON_TIERS })}</span
							>
							<span class="h-3 flex-1 overflow-hidden rounded-full bg-black/35">
								<span
									class="bar block h-full rounded-full bg-[#ffc83a]"
									style:width="{(shown ? seasonShare : 0) * 100}%"
								></span>
							</span>
						</div>
						{#if tierAfter > tierBefore}
							<p
								dir="auto"
								class="pop-in w-fit rounded-md bg-[#2fd0a8] px-2 text-sm text-[#0c2b22]"
							>
								{m.raid_result_season_up({ count: tierAfter - tierBefore })}
							</p>
						{/if}
					</div>
					<div class="flex flex-col gap-1.5">
						<dl class="flex flex-wrap gap-1.5">
							{#each numbers as stat (stat.label)}
								<div class="flex flex-col rounded-lg bg-[#1b0b3a]/60 px-2 py-0.5">
									<dt class="text-[0.65rem] text-white/75 uppercase">{stat.label}</dt>
									<dd class="text-sm tabular-nums">{stat.value}</dd>
								</div>
							{/each}
						</dl>
						{#if killsBy.length > 0}
							<p dir="auto" class="text-[0.7rem] text-white/80">
								{killsBy
									.map(([archetype, count]) => `${ENEMY_NAMES[archetype]()} ${count}`)
									.join(' · ')}
							</p>
						{/if}
					</div>
				</section>
			</div>

			<!-- The agent and the buttons -->
			<div class="flex flex-col items-end justify-end gap-3 pe-2 pb-1">
				<div class="relative hidden md:block">
					<Avatar size={150} />
				</div>
				{#if isNewBest}
					<ShareButton {modeName} score={result.stars} {drawBoard} />
				{/if}
				<button
					type="button"
					class="flex -skew-x-6 items-center gap-2 rounded-lg border-b-4 border-[#4b1d8f] bg-[#7a3fe0] px-4 py-2 font-display text-base font-black uppercase italic shadow-[0_3px_0_rgb(0_0_0/0.25)] active:translate-y-0.5"
					onclick={onRetry}
				>
					<IconRotate class="size-5" aria-hidden="true" />
					{m.gameover_try_again()}
				</button>
				<!-- svelte-ignore a11y_autofocus -->
				<button
					type="button"
					class="-skew-x-6 rounded-lg border-b-4 border-[#b84300] bg-linear-to-b from-[#ff9a3c] to-[#ff6a10] px-8 py-3 font-display text-2xl leading-none font-black uppercase italic shadow-[0_4px_0_rgb(0_0_0/0.25)] active:translate-y-0.5"
					autofocus
					onclick={onClose}
				>
					{m.raid_result_close()}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.heading {
		font-family: var(--font-display);
		font-size: 1.25rem;
		line-height: 1;
		font-weight: 900;
		font-style: italic;
		text-transform: uppercase;
		color: #e2c9ff;
	}

	.banner-title {
		-webkit-text-stroke: 2px #1b1036;
		paint-order: stroke fill;
		animation: banner-in 500ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
	}

	:global(.raid-star) {
		animation: banner-in 420ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
	}

	/* A star reached for the first time on this map lands bigger and glows */
	:global(.raid-star.fresh) {
		animation: star-new 620ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
		filter: drop-shadow(0 0 10px rgb(255 200 58 / 0.9));
	}

	@keyframes star-new {
		from {
			opacity: 0;
			scale: 2.4;
			rotate: -90deg;
		}
	}

	@keyframes banner-in {
		from {
			opacity: 0;
			scale: 0.4;
		}
	}

	.bar {
		transition: width 900ms cubic-bezier(0.22, 1, 0.36, 1);
	}

	.loot {
		animation: banner-in 420ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
	}

	@media (prefers-reduced-motion: reduce) {
		.banner-title,
		:global(.raid-star),
		:global(.raid-star.fresh),
		.loot {
			animation: none;
		}

		.bar {
			transition: none;
		}
	}
</style>
