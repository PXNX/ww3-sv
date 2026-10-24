<!--
	The season's reward track on its own screen: one card per tier to swipe through (or step with
	the arrows and arrow keys), opening on the next reward to reach, with the claim button below.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { SEASON_TIERS, SEASON_XP_PER_TIER } from '#lib/game/raid/config.js';
	import {
		dateAt,
		seasonDaysLeft,
		seasonId,
		seasonNumber,
		seasonReward,
		seasonTier,
		type SeasonProgress
	} from '#lib/game/raid/season.js';
	import RaidCrystalIcon from './RaidCrystalIcon.svelte';
	import RaidItemIcon from './RaidItemIcon.svelte';
	import { seasonRewardText } from './raidText';
	import IconCheck from '~icons/lucide/check';
	import IconChevronLeft from '~icons/lucide/chevron-left';
	import IconChevronRight from '~icons/lucide/chevron-right';
	import IconCoins from '~icons/lucide/coins';
	import IconGift from '~icons/lucide/gift';
	import IconLock from '~icons/lucide/lock';
	import IconSettings from '~icons/lucide/settings';
	import IconX from '~icons/lucide/x';

	let {
		season,
		onClaim,
		onClose
	}: { season: SeasonProgress; onClaim: () => void; onClose: () => void } = $props();

	const tiers = Array.from({ length: SEASON_TIERS }, (_, index) => index + 1);
	const reached = $derived(seasonTier(season.xp));
	const claimable = $derived(reached - season.claimed);
	const today = dateAt(Date.now());
	const current = $derived(seasonId(today) === season.id);

	let track: HTMLOListElement | undefined = $state();
	let closeButton: HTMLButtonElement | undefined = $state();

	/** Scrolls a tier's card into the middle */
	function show(tier: number, smooth = true) {
		const card = track?.querySelector<HTMLElement>(`[data-tier="${tier}"]`);
		card?.scrollIntoView({
			behavior: smooth ? 'smooth' : 'auto',
			inline: 'center',
			block: 'nearest'
		});
	}

	/** The card closest to the middle of the track */
	function centred(): number {
		if (!track) return 1;
		const middle = track.getBoundingClientRect().left + track.clientWidth / 2;
		let best = 1;
		let bestDistance = Infinity;
		for (const card of track.querySelectorAll<HTMLElement>('[data-tier]')) {
			const box = card.getBoundingClientRect();
			const distance = Math.abs(box.left + box.width / 2 - middle);
			if (distance < bestDistance) {
				bestDistance = distance;
				best = Number(card.dataset.tier);
			}
		}
		return best;
	}

	const step = (by: number) => show(Math.max(1, Math.min(SEASON_TIERS, centred() + by)));

	function onKeyDown(event: KeyboardEvent) {
		if (event.key === 'Escape') onClose();
		else if (event.key === 'ArrowRight') step(document.dir === 'rtl' ? -1 : 1);
		else if (event.key === 'ArrowLeft') step(document.dir === 'rtl' ? 1 : -1);
	}

	onMount(() => {
		// Opens on the first reward still to claim, or the next one to reach
		show(Math.min(SEASON_TIERS, season.claimed + 1), false);
		closeButton?.focus();
	});
</script>

<svelte:window onkeydown={onKeyDown} />

<div
	class="fixed inset-0 z-50 flex flex-col gap-3 bg-banner-slate p-3 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-[calc(0.75rem+env(safe-area-inset-bottom))] text-paper"
	role="dialog"
	aria-modal="true"
	aria-labelledby="raid-season-title"
>
	<div class="flex items-center gap-3">
		<h2 id="raid-season-title" class="font-display text-2xl font-bold">
			{m.raid_season_title({ number: seasonNumber(season.id) })}
		</h2>
		<span class="rounded bg-paper px-1.5 font-display text-sm font-bold text-ink tabular-nums"
			>{m.raid_season_tier({ tier: reached, max: SEASON_TIERS })}</span
		>
		{#if current}
			<span class="text-sm font-semibold opacity-90"
				>{m.raid_season_days_left({ days: seasonDaysLeft(today) })}</span
			>
		{/if}
		<button
			bind:this={closeButton}
			type="button"
			class="btn-chunky ms-auto px-2 py-1 text-sm text-ink"
			aria-label={m.raid_season_close_screen()}
			onclick={onClose}
		>
			<IconX class="size-4" aria-hidden="true" />
			<span class="hidden sm:inline">{m.raid_season_close_screen()}</span>
		</button>
	</div>

	<div class="relative flex min-h-0 flex-1 items-center">
		<button
			type="button"
			class="btn-chunky absolute start-0 z-10 hidden p-2 text-ink sm:flex"
			aria-label={m.raid_season_previous()}
			onclick={() => step(document.dir === 'rtl' ? 1 : -1)}
		>
			<IconChevronLeft class="size-5 rtl:rotate-180" aria-hidden="true" />
		</button>
		<ol
			bind:this={track}
			class="track flex h-full w-full snap-x snap-mandatory items-center gap-4 overflow-x-auto px-[calc(50%-6.5rem)] py-2"
			aria-label={m.raid_season_rewards()}
		>
			{#each tiers as tier (tier)}
				{@const reward = seasonReward(season.id, tier)}
				{@const done = tier <= season.claimed}
				{@const ready = !done && tier <= reached}
				{@const toGo = tier * SEASON_XP_PER_TIER - season.xp}
				<li
					data-tier={tier}
					class="sticker flex h-full max-h-80 w-52 shrink-0 snap-center flex-col items-center justify-between gap-2 p-4 text-center text-ink"
					class:ring-4={ready}
					class:ring-explosion-yellow={ready}
					class:opacity-70={tier > reached}
				>
					<span class="font-display text-sm font-bold uppercase opacity-70"
						>{m.raid_season_card_tier({ tier })}</span
					>
					<span class="flex flex-1 items-center justify-center">
						{#if reward.type === 'gold'}
							<IconCoins class="size-20 text-mustard" aria-hidden="true" />
						{:else if reward.type === 'scrap'}
							<IconSettings class="size-20 opacity-70" aria-hidden="true" />
						{:else if reward.type === 'crystal'}
							<RaidCrystalIcon
								kind={reward.crystal.kind}
								rarity={reward.crystal.rarity}
								class="size-20"
							/>
						{:else}
							<RaidItemIcon kind={reward.kind} rarity={reward.rarity} class="size-24" />
						{/if}
					</span>
					<span dir="auto" class="font-display text-lg leading-tight font-bold"
						>{seasonRewardText(reward)}</span
					>
					<span
						class="flex items-center gap-1 rounded-full px-2 py-0.5 font-display text-xs font-bold"
						class:bg-khaki={done}
						class:text-paper={done}
						class:bg-explosion-yellow={ready}
						class:bg-sand={tier > reached}
					>
						{#if done}
							<IconCheck class="size-3.5" aria-hidden="true" />{m.raid_season_card_claimed()}
						{:else if ready}
							<IconGift class="size-3.5" aria-hidden="true" />{m.raid_season_card_ready()}
						{:else}
							<IconLock class="size-3.5" aria-hidden="true" />{m.raid_season_card_locked({
								xp: toGo
							})}
						{/if}
					</span>
				</li>
			{/each}
		</ol>
		<button
			type="button"
			class="btn-chunky absolute end-0 z-10 hidden p-2 text-ink sm:flex"
			aria-label={m.raid_season_next()}
			onclick={() => step(document.dir === 'rtl' ? -1 : 1)}
		>
			<IconChevronRight class="size-5 rtl:rotate-180" aria-hidden="true" />
		</button>
	</div>

	<div class="flex flex-wrap items-center justify-center gap-3">
		<button
			type="button"
			class="btn-chunky text-ink"
			class:bg-explosion-yellow={claimable > 0}
			disabled={claimable <= 0}
			onclick={onClaim}
		>
			<IconGift class="size-5" aria-hidden="true" />
			{m.raid_season_claim({ count: Math.max(0, claimable) })}
		</button>
		<p class="max-w-md text-sm opacity-90">{m.raid_season_hint()}</p>
	</div>
</div>

<style>
	.track {
		scrollbar-width: none;
	}
</style>
