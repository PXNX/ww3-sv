<!--
	The daily dispatch: the seven-day login track, today's challenge and the time until the next
	one. The store moves itself to the new day on the first tick after midnight, so the panel can
	stay open on a phone overnight and still show the right rewards.
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
	import IconCoins from '~icons/lucide/coins';
	import IconFlame from '~icons/lucide/flame';
	import IconHeartPulse from '~icons/lucide/heart-pulse';
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

<section class="sticker flex flex-col gap-4 bg-sand p-4" style:--tilt="-0.6deg">
	<div class="flex flex-wrap items-center justify-between gap-2">
		<h2 class="flex items-center gap-2 font-display text-xl font-bold">
			<IconCalendarDays class="size-5" aria-hidden="true" />
			{m.daily_title()}
		</h2>
		<span
			class="inline-flex items-center gap-1 rounded-[10px_5px_9px_6px] border-2 border-ink bg-explosion-yellow px-2 py-0.5 text-sm font-bold"
		>
			<IconFlame class="size-4 text-tie-red" aria-hidden="true" />
			{#if streak > 0}
				{m.daily_streak({ count: streak })}
			{:else}
				{m.daily_streak_none()}
			{/if}
		</span>
	</div>

	<ol class="grid grid-cols-7 gap-1.5" aria-label={m.daily_title()}>
		{#each DAILY_TRACK as reward, index (index)}
			{@const active = index === nextSlot}
			{@const claimed = active && !careerState.dailyAvailable}
			<li
				class="flex min-w-0 flex-col items-center gap-0.5 rounded-[8px_4px_7px_5px] border-2 border-ink px-0.5 py-1 text-xs font-bold {claimed
					? 'bg-khaki text-paper'
					: active
						? 'bg-explosion-yellow'
						: 'bg-paper/70'}"
				aria-current={active ? 'step' : undefined}
			>
				<span class="text-[0.65rem] leading-none opacity-75">{index + 1}</span>
				<span class="flex items-center gap-0.5 tabular-nums">
					<IconCoins class="size-3" aria-hidden="true" />
					{reward.coins}
				</span>
				{#if reward.revives > 0}
					<span
						class="flex items-center gap-0.5 text-tie-red"
						title={m.daily_reward_revive({ count: reward.revives })}
					>
						<IconHeartPulse class="size-3" aria-hidden="true" />
						<span class="sr-only">{m.daily_reward_revive({ count: reward.revives })}</span>
					</span>
				{/if}
			</li>
		{/each}
	</ol>

	<button
		type="button"
		class="btn-chunky bg-explosion-yellow"
		disabled={!careerState.dailyAvailable}
		onclick={claim}
	>
		{#if careerState.dailyAvailable}
			<IconCalendarDays class="size-5" aria-hidden="true" />
			{m.daily_claim({ day: nextSlot + 1 })}
		{:else}
			<IconCheck class="size-5" aria-hidden="true" />
			{m.daily_claimed()}
		{/if}
	</button>

	{#if rewardNote}
		<p role="status" class="pop-in text-center text-sm font-bold text-khaki">{rewardNote}</p>
	{/if}

	<div class="rounded-[12px_6px_14px_8px] border-3 border-ink bg-paper p-3">
		<div class="flex flex-wrap items-center justify-between gap-2">
			<h3 class="font-display text-lg font-bold">{m.daily_challenge()}</h3>
			{#if careerState.profile.challenge.done}
				<span
					class="inline-flex items-center gap-1 rounded-md border-2 border-ink bg-khaki px-2 py-0.5 text-xs font-bold text-paper"
				>
					<IconCheck class="size-3.5" aria-hidden="true" />
					{m.daily_challenge_done()}
				</span>
			{/if}
		</div>
		<p class="mt-1">{m.daily_challenge_goal({ mode: challenge.name() })}</p>
		<p class="text-xs font-semibold opacity-75">
			{m.daily_challenge_reward({ coins: DAILY_CHALLENGE_COINS })}
		</p>
		{#if !careerState.profile.challenge.done && challengeHref}
			<a href={challengeHref} class="btn-chunky mt-2 bg-khaki px-3 py-1 text-sm">
				<IconPlay class="size-4" aria-hidden="true" />
				{m.daily_challenge_play()}
			</a>
		{/if}
	</div>

	<p class="flex items-center justify-center gap-1 text-xs font-semibold opacity-75">
		<IconClock class="size-3.5" aria-hidden="true" />
		{m.daily_next({ time: countdown })}
	</p>
	<p class="text-center text-xs leading-snug opacity-75">{m.daily_hint()}</p>
</section>
