<!--
	The daily contest: one game a day, and a medal for the best score entered in it. The card shows
	the featured game, today's best and which of the three medals has been earned so far; a better
	run the same day raises the medal and pays the difference. The medal case underneath counts what
	has been collected, so the contest has a collection behind it instead of a single daily number.
-->
<script lang="ts">
	import { untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import type { ResolvedPathname, RouteId } from '$app/types';
	import { CONTEST_TIERS, type ContestTier } from '#lib/game/contest/config.js';
	import { medalCounts, tierRank } from '#lib/game/contest/contest.js';
	import { career } from '#lib/game/career/store.svelte.js';
	import { formatCountdown, msUntilNextDay } from '#lib/game/wordle/daily.js';
	import { modeById } from '#lib/modes/registry.js';
	import { m } from '#lib/paraglide/messages.js';
	import IconClock from '~icons/lucide/clock';
	import IconMedal from '~icons/lucide/medal';
	import IconPlay from '~icons/lucide/play';
	import IconTrophy from '~icons/lucide/trophy';
	import GroupLeaderboard from './GroupLeaderboard.svelte';
	import { telegram } from '#lib/stores/telegram.svelte.js';

	// resolve() has one overload per route, and TypeScript gives up on matching a union of more
	// than 25 routes against them. The mode registry already type-checks every href.
	const resolveRoute = resolve as (route: RouteId) => ResolvedPathname;

	const careerState = career();

	let now = $state(new Date());

	// Same slow tick as the daily panel, so a card left open overnight rolls on to the new contest
	$effect(() => {
		const tick = () => {
			now = new Date();
			untrack(() => careerState.refresh(now));
		};
		const timer = window.setInterval(tick, 30_000);
		const onVisible = () => {
			if (document.visibilityState === 'visible') tick();
		};
		document.addEventListener('visibilitychange', onVisible);
		return () => {
			window.clearInterval(timer);
			document.removeEventListener('visibilitychange', onVisible);
		};
	});

	const contest = $derived(careerState.profile.contest);
	const game = $derived(modeById(contest.mode));
	const GameIcon = $derived(game.icon);
	const gameHref = $derived(game.status === 'playable' ? resolveRoute(game.href) : null);
	const countdown = $derived(formatCountdown(msUntilNextDay(now)));
	const counts = $derived(medalCounts(careerState.profile.medals));
	const totalMedals = $derived(careerState.profile.medals.length);
	const earnedRank = $derived(tierRank(contest.tier));

	const TIER_LABEL: Record<ContestTier, () => string> = {
		bronze: m.contest_tier_bronze,
		silver: m.contest_tier_silver,
		gold: m.contest_tier_gold
	};
	/** Bronze, silver and gold in one colour each, so the ladder reads at a glance */
	const TIER_CLASS: Record<ContestTier, string> = {
		bronze: 'bg-tie-red text-paper',
		silver: 'bg-banner-slate text-paper',
		gold: 'bg-explosion-yellow text-ink'
	};
</script>

<section class="sticker flex flex-col gap-2 bg-paper p-3" style:--tilt="0.5deg">
	<div class="flex items-center gap-2">
		<h2
			class="flex min-w-0 flex-1 items-center gap-1.5 font-display text-lg leading-none font-bold"
		>
			<IconTrophy class="size-5 shrink-0 text-mustard" aria-hidden="true" />
			<span class="truncate">{m.contest_title()}</span>
		</h2>
		<span
			class="inline-flex shrink-0 items-center gap-1 text-xs leading-none font-bold tabular-nums opacity-70"
			title={m.contest_next({ time: countdown })}
		>
			<IconClock class="size-3.5" aria-hidden="true" />
			<span aria-hidden="true">{countdown}</span>
			<span class="sr-only">{m.contest_next({ time: countdown })}</span>
		</span>
	</div>

	<div
		class="flex items-center gap-2 rounded-[10px_5px_9px_6px] border-2 border-ink bg-sand px-2 py-1.5"
	>
		<span
			class="grid size-9 shrink-0 place-items-center rounded-[7px_4px_6px_5px] border-2 border-ink {game.tileClass}"
		>
			<GameIcon class="size-5" stroke-width="2.5" aria-hidden="true" />
		</span>
		<div class="min-w-0 flex-1">
			<p class="truncate text-sm leading-tight font-bold">
				{m.contest_goal({ mode: game.name() })}
			</p>
			<p class="truncate text-[0.65rem] leading-tight font-semibold tabular-nums opacity-70">
				{#if contest.best > 0}
					{m.contest_best({ score: contest.best })}
				{:else}
					{m.contest_none()}
				{/if}
			</p>
		</div>

		{@const account = telegram()}
		{#if account.inTelegram && account.groupBoard && account.groupBoardStatus === 'ready' && contest.mode === (account.groupGame?.mode ?? '')}
			<GroupLeaderboard rows={account.groupBoard} status={account.groupBoardStatus} />
		{/if}

		{#if gameHref}
			<a href={gameHref} class="btn-chunky shrink-0 bg-khaki px-2.5 py-1 text-xs whitespace-nowrap">
				<IconPlay class="size-3.5" aria-hidden="true" />
				{m.contest_play()}
			</a>
		{/if}
	</div>

	<!-- The ladder of medals: the one earned today is lit, the rest wait for a better run -->
	<ol class="flex items-center justify-between gap-2" aria-label={m.contest_title()}>
		{#each CONTEST_TIERS as tier (tier)}
			{@const won = earnedRank >= tierRank(tier)}
			<li
				class="flex min-w-0 flex-1 items-center justify-center gap-1 rounded-[8px_4px_7px_5px] border-2 border-ink px-1.5 py-1 text-[0.7rem] leading-none font-bold {won
					? TIER_CLASS[tier]
					: 'bg-paper/70 opacity-60'}"
				aria-current={contest.tier === tier ? 'step' : undefined}
			>
				<IconMedal class="size-4 shrink-0" aria-hidden="true" />
				<span class="truncate">{TIER_LABEL[tier]()}</span>
			</li>
		{/each}
	</ol>

	<p class="flex items-center gap-1.5 text-[0.7rem] leading-tight font-semibold opacity-75">
		<IconMedal class="size-3.5 shrink-0" aria-hidden="true" />
		{#if totalMedals > 0}
			{m.contest_case({ count: totalMedals, gold: counts.gold })}
		{:else}
			{m.contest_case_empty()}
		{/if}
	</p>
</section>
