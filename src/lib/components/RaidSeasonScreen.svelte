<!--
	The season's reward track on its own screen, in the brawler look of the other raid screens: one
	reward card per tier to swipe through (or step with the arrows and arrow keys), coloured by what
	it holds and how rare it is, standing on a rail that fills up with the season's XP. It opens on
	the next reward to claim or reach; the claim button sits in the bottom right.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { RARITY_COLOR, SEASON_TIERS, SEASON_XP_PER_TIER } from '#lib/game/raid/config.js';
	import {
		dateAt,
		seasonDaysLeft,
		seasonId,
		seasonNumber,
		seasonReward,
		seasonTier,
		seasonTierProgress,
		type SeasonProgress,
		type SeasonReward
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
	import IconTimer from '~icons/lucide/timer';
	import IconWrench from '~icons/lucide/wrench';
	import IconX from '~icons/lucide/x';

	let {
		season,
		onClaim,
		onClose
	}: { season: SeasonProgress; onClaim: () => void; onClose: () => void } = $props();

	const tiers = Array.from({ length: SEASON_TIERS }, (_, index) => index + 1);
	const reached = $derived(seasonTier(season.xp));
	const progress = $derived(seasonTierProgress(season.xp));
	const claimable = $derived(reached - season.claimed);
	const today = dateAt(Date.now());
	const current = $derived(seasonId(today) === season.id);

	/** The card's colours: gold and scrap in their own, crystals and weapons in their rarity's */
	function cardBackground(reward: SeasonReward): string {
		if (reward.type === 'gold') return 'linear-gradient(160deg, #ffe066, #ffb020 55%, #e07a10)';
		if (reward.type === 'scrap') return 'linear-gradient(160deg, #aab4bf, #6d7884 55%, #48525e)';
		const color = RARITY_COLOR[reward.type === 'crystal' ? reward.crystal.rarity : reward.rarity];
		return `linear-gradient(160deg, color-mix(in srgb, ${color} 70%, white), ${color} 50%, color-mix(in srgb, ${color} 55%, #1b0b3a))`;
	}

	/** How much of the rail leading up to a tier's node is filled */
	const railFill = (tier: number) =>
		Math.max(0, Math.min(1, (season.xp - (tier - 1) * SEASON_XP_PER_TIER) / SEASON_XP_PER_TIER));

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
	class="stage fixed inset-0 z-50 flex flex-col gap-2 overflow-hidden pt-[calc(0.6rem+var(--top-inset))] pb-[calc(0.6rem+env(safe-area-inset-bottom))] text-white"
	role="dialog"
	aria-modal="true"
	aria-labelledby="raid-season-title"
>
	<!-- The season, its time left and the tier reached, with the way back in the top right -->
	<div class="flex items-start gap-3 pr-(--top-right-inset) pl-(--top-left-inset)">
		<div class="flex min-w-0 flex-1 flex-col gap-1.5 ps-3">
			<div class="flex flex-wrap items-center gap-2">
				<h2
					id="raid-season-title"
					class="title font-display text-3xl leading-none font-black uppercase italic"
				>
					{m.raid_season_title({ number: seasonNumber(season.id) })}
				</h2>
				{#if current}
					<span
						class="flex -skew-x-6 items-center gap-1 rounded bg-[#1b0b3a]/70 px-2 py-0.5 font-display text-xs font-black uppercase tabular-nums"
					>
						<IconTimer class="size-3.5 text-[#ffd23a]" aria-hidden="true" />
						{m.raid_season_days_left({ days: seasonDaysLeft(today) })}
					</span>
				{/if}
			</div>
			<div class="flex max-w-md items-center gap-2">
				<span
					class="flex h-8 min-w-12 -skew-x-6 items-center justify-center rounded-md border-b-4 border-[#b87a00] bg-[#ffd23a] px-2 font-display text-lg leading-none font-black text-[#3d1478] tabular-nums shadow-[0_3px_0_rgb(0_0_0/0.25)]"
					title={m.raid_season_tier({ tier: reached, max: SEASON_TIERS })}
					><span class="sr-only">{m.raid_season_tier({ tier: reached, max: SEASON_TIERS })}</span
					><span aria-hidden="true">{reached}</span></span
				>
				<span class="flex min-w-0 flex-1 flex-col gap-0.5">
					<span class="h-3 w-full overflow-hidden rounded-full bg-[#1b0b3a]/70">
						<span
							class="block h-full rounded-full bg-linear-to-r from-[#7fd3ff] to-[#4fb4ff]"
							style:width="{progress.needed ? (progress.xp / progress.needed) * 100 : 100}%"
						></span>
					</span>
					<span class="font-display text-[0.7rem] leading-none font-bold text-white/85 tabular-nums"
						>{progress.needed
							? m.raid_season_xp({ xp: progress.xp, next: progress.needed })
							: m.raid_season_complete()}</span
					>
				</span>
			</div>
		</div>
		<button
			bind:this={closeButton}
			type="button"
			class="me-3 flex size-12 shrink-0 -skew-x-6 items-center justify-center rounded-md bg-[#d9f3ff] text-[#7a2fd0] shadow-[0_3px_0_rgb(0_0_0/0.25)] active:scale-95"
			aria-label={m.raid_season_close_screen()}
			title={m.raid_season_close_screen()}
			onclick={onClose}
		>
			<IconX class="size-8 stroke-[3.5]" aria-hidden="true" />
		</button>
	</div>

	<!-- The track -->
	<div class="relative flex min-h-0 flex-1 items-stretch">
		<button
			type="button"
			class="arrow absolute start-2 top-1/2 z-10 hidden -translate-y-1/2 sm:flex"
			aria-label={m.raid_season_previous()}
			onclick={() => step(document.dir === 'rtl' ? 1 : -1)}
		>
			<IconChevronLeft class="size-6 stroke-[3] rtl:rotate-180" aria-hidden="true" />
		</button>
		<ol
			bind:this={track}
			class="track flex h-full w-full snap-x snap-mandatory gap-3 overflow-x-auto px-[calc(50%-4.5rem)] pt-3 pb-4"
			aria-label={m.raid_season_rewards()}
		>
			{#each tiers as tier (tier)}
				{@const reward = seasonReward(season.id, tier)}
				{@const done = tier <= season.claimed}
				{@const ready = !done && tier <= reached}
				{@const locked = tier > reached}
				{@const milestone = reward.type === 'weapon'}
				<li
					data-tier={tier}
					class="flex w-36 shrink-0 snap-center flex-col items-center justify-center"
					aria-label={m.raid_season_card_tier({ tier })}
				>
					<!-- The reward -->
					<div
						class="card relative flex h-36 w-full shrink-0 flex-col items-center justify-between gap-1 overflow-hidden rounded-xl border-b-5 border-black/30 p-2 text-center shadow-[0_4px_0_rgb(0_0_0/0.3)]"
						class:ready
						class:milestone
						class:brightness-75={locked}
						class:saturate-50={locked}
						style:background={cardBackground(reward)}
					>
						<span class="flex min-h-0 flex-1 items-center justify-center">
							{#if reward.type === 'gold'}
								<IconCoins
									class="size-14 text-white drop-shadow-[0_3px_0_rgb(0_0_0/0.25)]"
									aria-hidden="true"
								/>
							{:else if reward.type === 'scrap'}
								<IconWrench
									class="size-14 text-white drop-shadow-[0_3px_0_rgb(0_0_0/0.25)]"
									aria-hidden="true"
								/>
							{:else if reward.type === 'crystal'}
								<RaidCrystalIcon
									kind={reward.crystal.kind}
									rarity={reward.crystal.rarity}
									class="size-14 drop-shadow-[0_3px_0_rgb(0_0_0/0.25)]"
								/>
							{:else}
								<RaidItemIcon
									kind={reward.kind}
									rarity={reward.rarity}
									class="size-16 drop-shadow-[0_3px_0_rgb(0_0_0/0.25)]"
								/>
							{/if}
						</span>
						<span
							dir="auto"
							class="font-display text-sm leading-tight font-black drop-shadow-[0_1px_0_rgb(0_0_0/0.4)]"
							>{seasonRewardText(reward)}</span
						>
						{#if done}
							<!-- Claimed: dimmed under a big tick -->
							<span
								class="absolute inset-0 flex items-center justify-center bg-[#1b0b3a]/55"
								title={m.raid_season_card_claimed()}
							>
								<span
									class="flex size-12 items-center justify-center rounded-full bg-[#22c3b0] shadow-[0_3px_0_rgb(0_0_0/0.3)] ring-3 ring-white"
								>
									<IconCheck class="size-8 stroke-[3.5]" aria-hidden="true" />
								</span>
								<span class="sr-only">{m.raid_season_card_claimed()}</span>
							</span>
						{/if}
					</div>

					<!-- What it takes: ready, or the XP still to go -->
					<span
						class="mt-1.5 flex h-5 -skew-x-6 items-center gap-1 rounded px-1.5 font-display text-[0.65rem] font-black whitespace-nowrap uppercase italic {ready
							? 'bg-[#ffd23a] text-[#3d1478]'
							: locked
								? 'bg-[#1b0b3a]/70'
								: 'invisible'}"
						aria-hidden={done}
					>
						{#if ready}
							<IconGift class="size-3" aria-hidden="true" />{m.raid_season_card_ready()}
						{:else if locked}
							<IconLock class="size-3" aria-hidden="true" />{m.raid_season_card_locked({
								xp: tier * SEASON_XP_PER_TIER - season.xp
							})}
						{/if}
					</span>

					<!-- The rail, filled with the season's XP, and this tier's stop on it -->
					<div class="relative mt-1 h-8 w-full">
						<span
							class="absolute end-1/2 top-1/2 h-2.5 -translate-y-1/2 overflow-hidden bg-[#1b0b3a]/70 {tier ===
							1
								? 'w-1/2 rounded-s-full'
								: 'w-[calc(100%+0.75rem)]'}"
						>
							<span
								class="block h-full bg-linear-to-r from-[#ffd23a] to-[#ffb020] rtl:bg-linear-to-l"
								style:width="{railFill(tier) * 100}%"
							></span>
						</span>
						<span
							class="absolute start-1/2 top-1/2 flex size-8 -translate-1/2 rotate-45 items-center justify-center rounded-md shadow-[0_2px_0_rgb(0_0_0/0.3)] rtl:translate-x-1/2 {locked
								? 'bg-[#2a1a52] text-white/80 ring-2 ring-white/25'
								: 'bg-[#ffd23a] text-[#3d1478] ring-2 ring-white'}"
						>
							<span class="-rotate-45 font-display text-sm font-black tabular-nums">{tier}</span>
						</span>
					</div>
				</li>
			{/each}
		</ol>
		<button
			type="button"
			class="arrow absolute end-2 top-1/2 z-10 hidden -translate-y-1/2 sm:flex"
			aria-label={m.raid_season_next()}
			onclick={() => step(document.dir === 'rtl' ? -1 : 1)}
		>
			<IconChevronRight class="size-6 stroke-[3] rtl:rotate-180" aria-hidden="true" />
		</button>
	</div>

	<!-- How the track fills, and claiming in the bottom right -->
	<div class="flex items-end gap-3 pr-(--top-right-inset) pl-(--top-left-inset)">
		<p dir="auto" class="min-w-0 flex-1 ps-3 text-xs leading-snug font-semibold text-white/85">
			{m.raid_season_hint()}
		</p>
		<button
			type="button"
			class="me-3 flex shrink-0 -skew-x-6 items-center gap-2 rounded-lg border-b-4 px-5 py-2.5 font-display text-lg leading-none font-black uppercase italic shadow-[0_4px_0_rgb(0_0_0/0.25)] active:translate-y-0.5 {claimable >
			0
				? 'border-[#b84300] bg-linear-to-b from-[#ff9a3c] to-[#ff6a10] text-white'
				: 'border-black/25 bg-white/20 text-white/60 shadow-none'}"
			disabled={claimable <= 0}
			onclick={onClaim}
		>
			<IconGift class="size-6" aria-hidden="true" />
			{m.raid_season_claim({ count: Math.max(0, claimable) })}
		</button>
	</div>
</div>

<style>
	.stage {
		background:
			repeating-linear-gradient(135deg, rgb(255 255 255 / 0.04) 0 18px, transparent 18px 36px),
			radial-gradient(ellipse at 50% 30%, #9a4fe0, #6a2bb8 50%, #2a0f5c);
	}

	.title {
		-webkit-text-stroke: 1.5px #12082e;
		paint-order: stroke fill;
		text-shadow: 0 3px 0 rgb(0 0 0 / 0.35);
	}

	.track {
		scrollbar-width: none;
	}

	.arrow {
		align-items: center;
		justify-content: center;
		width: 2.75rem;
		height: 2.75rem;
		border-radius: 9999px;
		background: #d9f3ff;
		color: #7a2fd0;
		box-shadow: 0 3px 0 rgb(0 0 0 / 0.25);
	}

	/* Ready to claim: a glowing yellow frame that breathes */
	.card.ready {
		outline: 4px solid #ffd23a;
		outline-offset: -2px;
		animation: ready-glow 1.4s ease-in-out infinite;
	}

	@keyframes ready-glow {
		50% {
			box-shadow:
				0 4px 0 rgb(0 0 0 / 0.3),
				0 0 22px 4px rgb(255 210 58 / 0.75);
		}
	}

	/* Every tenth tier is a weapon: a shine sweeps across its card */
	.card.milestone::after {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(
			105deg,
			transparent 35%,
			rgb(255 255 255 / 0.45) 50%,
			transparent 65%
		);
		translate: -120% 0;
		animation: shine 2.6s ease-in-out infinite;
		pointer-events: none;
	}

	@keyframes shine {
		60%,
		100% {
			translate: 120% 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.card.ready,
		.card.milestone::after {
			animation: none;
		}
	}
</style>
