<!--
	The daily dispatch, in one panel: the seven-day reward track and today's challenge that unlocks
	it. The challenge doubles as the button, so the panel has one goal and one action instead of two
	competing tracks. The store moves itself to the new day on the first tick after midnight, so the
	panel can stay open on a phone overnight and still show the right rewards.
-->
<script lang="ts">
	import { untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import type { ResolvedPathname, RouteId } from '$app/types';
	import { DAILY_CHALLENGE_COINS, DAILY_TRACK } from '#lib/game/career/config.js';
	import { nextStreakSlot } from '#lib/game/career/profile.js';
	import { career } from '#lib/game/career/store.svelte.js';
	import { dayKey } from '#lib/game/random.js';
	import { formatCountdown, msUntilNextDay, previousDay } from '#lib/game/wordle/daily.js';
	import { modeById } from '#lib/modes/registry.js';
	import { m } from '#lib/paraglide/messages.js';
	import { soundManager } from '#lib/sound/soundManager.svelte.js';
	import IconCalendarDays from '~icons/lucide/calendar-days';
	import IconCheck from '~icons/lucide/check';
	import IconClock from '~icons/lucide/clock';
	import IconFlame from '~icons/lucide/flame';
	import IconHeartPulse from '~icons/lucide/heart-pulse';
	import IconNewspaper from '~icons/lucide/newspaper';
	import IconPlay from '~icons/lucide/play';

	// resolve() has one overload per route, and TypeScript gives up on matching a union of more
	// than 25 routes against them. The mode registry already type-checks every href.
	const resolveRoute = resolve as (route: RouteId) => ResolvedPathname;

	const careerState = career();

	let now = $state(new Date());
	let rewardNote = $state('');

	// A slow tick keeps the midnight countdown honest without waking the phone more than twice a
	// minute; coming back to the tab refreshes immediately.
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

	const today = $derived(dayKey(now));
	const streak = $derived.by(() => {
		const last = careerState.profile.lastBonusDay;
		if (!last) return 0;
		return last === today || last === previousDay(today) ? careerState.profile.streak : 0;
	});
	const claimedToday = $derived(careerState.profile.lastBonusDay === today);
	const nextSlot = $derived(nextStreakSlot(careerState.profile, now));
	const countdown = $derived(formatCountdown(msUntilNextDay(now)));
	const challenge = $derived(modeById(careerState.challengeMode));
	const challengeHref = $derived(
		challenge.status === 'playable' ? resolveRoute(challenge.href) : null
	);

	function claim() {
		const claim = careerState.claimDaily(new Date());
		if (!claim) return;
		soundManager().play('chime-big');
		rewardNote =
			claim.revives > 0
				? `${m.daily_reward_coins({ count: claim.coins })} · ${m.daily_reward_revive({
						count: claim.revives
					})}`
				: m.daily_reward_coins({ count: claim.coins });
	}
</script>

<section class="sticker flex flex-col gap-2 bg-sand p-3" style:--tilt="-0.6deg">
	<div class="flex items-center justify-between gap-2">
		<h2 class="flex items-center gap-1.5 font-display text-lg leading-none font-bold">
			<IconCalendarDays class="size-5" aria-hidden="true" />
			{m.daily_title()}
		</h2>
		<span
			class="inline-flex items-center gap-1 rounded-[8px_4px_7px_5px] border-2 border-ink bg-explosion-yellow px-1.5 py-0.5 text-xs leading-none font-bold"
		>
			<IconFlame class="size-3.5 text-tie-red" aria-hidden="true" />
			{#if streak > 0}
				{m.daily_streak({ count: streak })}
			{:else}
				{m.daily_streak_none()}
			{/if}
		</span>
	</div>

	<ol class="grid grid-cols-7 gap-1" aria-label={m.daily_title()}>
		{#each DAILY_TRACK as reward, index (index)}
			{@const active = index === nextSlot}
			{@const collected = active && claimedToday}
			<li
				class="flex min-w-0 flex-col items-center justify-center rounded-[6px_3px_5px_4px] border-2 border-ink px-0.5 py-1 leading-none {collected
					? 'bg-khaki text-paper'
					: active
						? 'bg-explosion-yellow'
						: 'bg-paper/70'}"
				aria-current={active ? 'step' : undefined}
			>
				<span class="text-[0.6rem] font-bold opacity-60">{index + 1}</span>
				<span class="mt-0.5 flex items-center gap-0.5 text-[0.7rem] font-bold tabular-nums">
					<IconNewspaper class="size-3" aria-hidden="true" />
					{reward.coins}
				</span>
				{#if reward.revives > 0}
					<span class="mt-0.5 flex items-center gap-0.5 text-[0.6rem] font-bold text-tie-red">
						<IconHeartPulse class="size-2.5" aria-hidden="true" />
						{reward.revives}
						<span class="sr-only">{m.daily_reward_revive({ count: reward.revives })}</span>
					</span>
				{/if}
			</li>
		{/each}
	</ol>

	<div
		class="flex items-center gap-2 rounded-[10px_5px_9px_6px] border-2 border-ink bg-paper px-2 py-1.5"
	>
		<div class="min-w-0 flex-1">
			<p
				class="flex flex-wrap items-center gap-x-1.5 text-[0.6rem] font-bold tracking-wide uppercase opacity-60"
			>
				{m.daily_challenge()}
				{#if careerState.profile.challenge.done}
					<span class="inline-flex items-center gap-0.5 text-khaki">
						<IconCheck class="size-3" aria-hidden="true" />
						{m.daily_challenge_done()}
					</span>
				{/if}
			</p>
			<p class="truncate text-sm leading-tight font-bold">
				{m.daily_challenge_goal({ mode: challenge.name() })}
			</p>
			<p class="truncate text-[0.65rem] leading-tight font-semibold opacity-70">
				{m.daily_challenge_reward({ coins: DAILY_CHALLENGE_COINS })}
			</p>
		</div>

		{#if !careerState.profile.challenge.done && challengeHref}
			<a
				href={challengeHref}
				class="btn-chunky shrink-0 bg-khaki px-2.5 py-1 text-xs whitespace-nowrap"
			>
				<IconPlay class="size-3.5" aria-hidden="true" />
				{m.daily_challenge_play()}
			</a>
		{:else if careerState.dailyAvailable}
			<button
				type="button"
				class="btn-chunky shrink-0 bg-explosion-yellow px-2.5 py-1 text-xs whitespace-nowrap"
				onclick={claim}
			>
				{m.daily_claim({ day: nextSlot + 1 })}
			</button>
		{:else if claimedToday}
			<span
				class="inline-flex shrink-0 items-center gap-1 rounded-[8px_4px_7px_5px] border-2 border-ink bg-khaki px-2 py-1 text-xs font-bold text-paper"
			>
				<IconCheck class="size-3.5" aria-hidden="true" />
				{m.daily_claimed()}
			</span>
		{/if}
	</div>

	{#if rewardNote}
		<p role="status" class="pop-in text-center text-xs font-bold text-khaki">{rewardNote}</p>
	{:else}
		<p
			class="flex flex-wrap items-center justify-center gap-x-1.5 text-[0.65rem] leading-tight font-semibold opacity-70"
		>
			<span class="inline-flex items-center gap-1">
				<IconClock class="size-3" aria-hidden="true" />
				{m.daily_next({ time: countdown })}
			</span>
			<span aria-hidden="true">·</span>
			{m.daily_hint()}
		</p>
	{/if}
</section>
