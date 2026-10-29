<!--
	Oil Tycoon Idle Clicker (roadmap 3.16): tap the derrick to pump barrels, buy pumpjacks, tankers,
	lobbyists and a shadow fleet that pump for you in cycles, survive random crises (price spikes,
	sanctions, pipeline maintenance, protests) with a quick decision, unlock achievements with small
	boosts, and nationalize and restart for a permanent multiplier and points to invest. The game saves itself, credits the time away, and has no lives and no
	game over, so there is no end screen and no pause overlay: the help screen simply pauses it.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import GameShell from '#lib/components/GameShell.svelte';
	import TutorialModal from '#lib/components/TutorialModal.svelte';
	import TycoonDerrick from '#lib/components/TycoonDerrick.svelte';
	import TycoonEventCard from '#lib/components/TycoonEventCard.svelte';
	import TycoonPrestige from '#lib/components/TycoonPrestige.svelte';
	import TycoonProducerRow from '#lib/components/TycoonProducerRow.svelte';
	import {
		achievementDescription,
		achievementName,
		achievementReward,
		effectIsGood,
		effectLabel,
		upgradeEffect,
		upgradeName
	} from '#lib/components/tycoonText.js';
	import { createFixedLoop, prefersReducedMotion } from '#lib/game/loop.js';
	import {
		ACHIEVEMENTS,
		COST_GROWTH,
		OFFLINE_CAP_MS,
		OFFLINE_EFFICIENCY,
		PRESTIGE_BONUS,
		PRODUCERS,
		STEP_MS
	} from '#lib/game/tycoon/config.js';
	import { upgradeDef } from '#lib/game/tycoon/economy.js';
	import {
		formatBig,
		formatCount,
		formatDuration,
		formatMultiplier
	} from '#lib/game/tycoon/format.js';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { firstPlay } from '#lib/services/tutorial.js';
	import { TycoonGame, type BuyAmount } from '#lib/stores/tycoonGame.svelte.js';
	import IconCheck from '~icons/lucide/check';
	import IconHelp from '~icons/lucide/circle-help';
	import IconTrophy from '~icons/lucide/trophy';

	const game = new TycoonGame({ reducedMotion: prefersReducedMotion() });
	const modeName = m.mode_tycoon_name();
	const locale = getLocale();

	type Tab = 'producers' | 'upgrades' | 'achievements' | 'prestige';
	let tab = $state<Tab>('producers');
	let showTutorial = $state(false);

	const loop = createFixedLoop({
		stepMs: STEP_MS,
		update: (dtMs) => game.update(dtMs),
		render: () => {}
	});

	onMount(() => {
		game.load();
		showTutorial = firstPlay('tycoon');
		if (showTutorial) game.pause();
		loop.start();

		// A hidden tab stops drawing frames, so the loop stops by itself; on return the time away is
		// credited like offline progress
		const onVisibility = () => {
			if (document.visibilityState === 'hidden') {
				loop.pause();
				game.away();
			} else {
				game.back();
				loop.start();
			}
		};
		const onPageHide = () => game.save();
		document.addEventListener('visibilitychange', onVisibility);
		window.addEventListener('pagehide', onPageHide);
		return () => {
			document.removeEventListener('visibilitychange', onVisibility);
			window.removeEventListener('pagehide', onPageHide);
			loop.pause();
			game.save();
		};
	});

	function openHelp() {
		game.pause();
		showTutorial = true;
	}

	function closeHelp() {
		showTutorial = false;
		game.resume();
	}

	const amounts: { value: BuyAmount; label: () => string }[] = [
		{ value: 1, label: () => '×1' },
		{ value: 10, label: () => '×10' },
		{ value: 'max', label: () => m.tycoon_buy_max() }
	];

	const tabs: { id: Tab; label: () => string }[] = [
		{ id: 'producers', label: () => m.tycoon_tab_producers() },
		{ id: 'upgrades', label: () => m.tycoon_tab_upgrades() },
		{ id: 'achievements', label: () => m.tycoon_tab_achievements() },
		{ id: 'prestige', label: () => m.tycoon_tab_prestige() }
	];

	const availableUpgrades = $derived(
		game.availableIds.flatMap((id) => {
			const def = upgradeDef(id);
			return def ? [def] : [];
		})
	);
	// Only the producers within reach are drawn: the ones owned and the next few, so the list stays
	// short and light however far the game has come
	const REACH = 3;
	const lastOwnedIndex = $derived(
		PRODUCERS.reduce((last, producer, index) => (game.owned[producer.id] > 0 ? index : last), -1)
	);
	const shownProducers = $derived(PRODUCERS.slice(0, lastOwnedIndex + 1 + REACH));
	const hiddenProducers = $derived(PRODUCERS.length - shownProducers.length);
	const secondsLeft = (ms: number) => Math.max(1, Math.ceil(ms / 1000));
	// The boosts the unlocked achievements add up to, as whole percents
	const boosts = $derived(
		Object.fromEntries(
			Object.entries(game.achievementBoosts).map(([kind, value]) => [
				kind,
				formatCount(value * 100, locale)
			])
		) as Record<keyof typeof game.achievementBoosts, string>
	);
</script>

<GameShell title={modeName}>
	{#snippet actions()}
		<button
			type="button"
			class="btn-chunky px-2 py-1 text-sm sm:px-3"
			aria-label={m.tycoon_help_button()}
			onclick={openHelp}
		>
			<IconHelp class="size-4" aria-hidden="true" />
			<span class="hidden sm:inline">{m.tycoon_help_button()}</span>
		</button>
	{/snippet}

	<section class="mx-auto flex w-full max-w-none flex-col gap-3">
		{#if game.welcome}
			<div class="sticker pop-in flex flex-col gap-1 bg-explosion-yellow p-3" role="status">
				<h2 dir="auto" class="font-display text-xl font-bold">{m.tycoon_welcome_title()}</h2>
				<p dir="auto" class="text-sm leading-snug">
					{m.tycoon_welcome_text({
						time: formatDuration(game.welcome.creditedMs, locale),
						barrels: formatBig(game.welcome.barrels, locale)
					})}
				</p>
				{#if game.welcome.capped}
					<p dir="auto" class="text-xs leading-snug font-semibold">
						{m.tycoon_welcome_capped({
							hours: formatCount(OFFLINE_CAP_MS / 3_600_000, locale),
							percent: formatCount(OFFLINE_EFFICIENCY * 100, locale)
						})}
					</p>
				{/if}
				<button
					type="button"
					class="btn-chunky mt-1 self-end bg-paper px-3 py-1 text-sm"
					onclick={() => game.dismissWelcome()}
				>
					{m.tycoon_welcome_close()}
				</button>
			</div>
		{/if}

		<!-- The bank: barrels, output per second, per tap and the multiplier -->
		<div
			class="flex flex-col gap-2 rounded-2xl border-3 border-ink bg-paper px-4 py-3 shadow-[3px_3px_0_var(--color-ink)]"
		>
			<div class="flex items-end justify-between gap-3">
				<div class="flex min-w-0 flex-col">
					<p class="font-display text-xs font-bold tracking-wide uppercase">
						{m.tycoon_hud_barrels()}
					</p>
					<p class="truncate font-display text-4xl leading-none font-bold tabular-nums" dir="ltr">
						{formatBig(game.barrels, locale)}
					</p>
				</div>
				<p
					class="shrink-0 rounded-xl border-3 border-ink bg-explosion-yellow px-2.5 py-1 text-end font-display text-sm leading-tight font-bold tabular-nums"
					dir="auto"
				>
					{m.tycoon_hud_per_second({ amount: formatBig(game.perSecond, locale, 1) })}
				</p>
			</div>
			<div class="flex flex-wrap gap-1.5 font-display text-xs font-bold tabular-nums">
				<span class="rounded-full border-2 border-ink bg-sand px-2 py-0.5" dir="auto">
					{m.tycoon_hud_per_tap({ amount: formatBig(game.tapGain, locale, 1) })}
				</span>
				<span class="rounded-full border-2 border-ink bg-sand px-2 py-0.5" dir="auto">
					{m.tycoon_hud_multiplier({ value: formatMultiplier(game.totalMultiplier, locale) })}
				</span>
				<span class="rounded-full border-2 border-ink bg-sand px-2 py-0.5" dir="auto">
					{m.tycoon_hud_lifetime({ amount: formatBig(game.lifetime, locale) })}
				</span>
				{#if game.best !== null}
					<span class="rounded-full border-2 border-ink bg-sand px-2 py-0.5" dir="auto">
						{m.tycoon_hud_best({ amount: formatBig(game.best, locale) })}
					</span>
				{/if}
			</div>
		</div>

		<!-- The playfield: the derrick, active crisis effects and the crisis card -->
		<div data-playfield dir="ltr" class="flex flex-col gap-2" style:touch-action="none">
			<div class="relative mx-auto w-full" aria-label={m.tycoon_playfield_label()} role="group">
				<TycoonDerrick {game} />
				{#if game.toast}
					{#key game.toast.id}
						<p
							dir="auto"
							class="tycoon-toast pointer-events-none absolute inset-x-2 top-2 z-10 text-center font-display text-xl leading-tight font-bold text-paper [-webkit-text-stroke:5px_var(--color-ink)] [paint-order:stroke] sm:text-2xl"
							aria-live="polite"
						>
							{game.toast.text}
						</p>
					{/key}
				{/if}
			</div>
			{#if game.effects.length > 0}
				<ul class="flex flex-wrap gap-2">
					{#each game.effects as effect (effect.id + (effect.producer ?? ''))}
						<li
							class="rounded-full border-3 border-ink px-3 py-0.5 font-display text-xs font-bold tabular-nums {effectIsGood(
								effect.id
							)
								? 'bg-khaki'
								: 'bg-tie-red text-paper'}"
							dir="auto"
						>
							{effectLabel(effect.id, effect.producer)} · {secondsLeft(effect.remainingMs)}s
						</li>
					{/each}
				</ul>
			{/if}
		</div>
		<TycoonEventCard {game} />

		<!-- The shop -->
		<div role="tablist" aria-label={m.tycoon_tabs_label()} class="grid grid-cols-4 gap-1.5">
			{#each tabs as entry (entry.id)}
				<button
					type="button"
					role="tab"
					id="tycoon-tab-{entry.id}"
					aria-selected={tab === entry.id}
					aria-controls="tycoon-panel-{entry.id}"
					class="btn-chunky justify-center px-1 py-1.5 text-center text-xs leading-tight sm:text-sm {tab ===
					entry.id
						? 'bg-explosion-yellow'
						: 'bg-paper'}"
					onclick={() => (tab = entry.id)}
				>
					<span dir="auto">
						{entry.label()}
						{#if entry.id === 'upgrades' && availableUpgrades.length > 0}
							({availableUpgrades.length})
						{:else if entry.id === 'prestige' && (game.pendingPoints >= 1 || game.canInvest)}
							!
						{/if}
					</span>
				</button>
			{/each}
		</div>

		<div
			role="tabpanel"
			id="tycoon-panel-{tab}"
			aria-labelledby="tycoon-tab-{tab}"
			class="flex flex-col gap-2 pb-4"
		>
			{#if tab === 'producers'}
				<div class="flex items-center justify-between gap-2">
					<p dir="auto" class="font-display text-sm font-bold">{m.tycoon_buy_amount_label()}</p>
					<div class="flex gap-1.5" role="group" aria-label={m.tycoon_buy_amount_label()}>
						{#each amounts as amount (amount.value)}
							<button
								type="button"
								class="btn-chunky min-w-12 justify-center px-2 py-1 text-sm {game.buyAmount ===
								amount.value
									? 'bg-explosion-yellow'
									: 'bg-paper'}"
								aria-pressed={game.buyAmount === amount.value}
								onclick={() => (game.buyAmount = amount.value)}
							>
								{amount.label()}
							</button>
						{/each}
					</div>
				</div>
				<ul class="flex flex-col gap-2">
					{#each shownProducers as producer (producer.id)}
						<TycoonProducerRow {game} id={producer.id} />
					{/each}
				</ul>
				{#if hiddenProducers > 0}
					<p dir="auto" class="text-center text-xs font-semibold opacity-70">
						{m.tycoon_producers_locked({ count: formatCount(hiddenProducers, locale) })}
					</p>
				{/if}
			{:else if tab === 'upgrades'}
				{#if availableUpgrades.length === 0}
					<p dir="auto" class="sticker bg-paper p-3 text-sm leading-snug">
						{m.tycoon_upgrades_empty()}
					</p>
				{:else}
					<ul class="flex flex-col gap-2">
						{#each availableUpgrades as upgrade (upgrade.id)}
							{@const price = game.upgradePrices[upgrade.id] ?? upgrade.cost}
							{@const affordable = game.barrels >= price}
							<li class="tycoon-upgrade">
								<button
									type="button"
									class="btn-chunky flex w-full items-center gap-3 rounded-2xl bg-paper px-3 py-2 text-start"
									class:opacity-60={!affordable}
									disabled={!affordable}
									aria-label={m.tycoon_upgrade_buy_label({
										name: upgradeName(upgrade),
										cost: formatBig(price, locale)
									})}
									onclick={() => game.buyUpgrade(upgrade.id)}
								>
									<span class="flex min-w-0 flex-1 flex-col">
										<span dir="auto" class="font-display text-base leading-tight font-bold">
											{upgradeName(upgrade)}
										</span>
										<span dir="auto" class="text-xs leading-tight">{upgradeEffect(upgrade)}</span>
									</span>
									<span class="shrink-0 font-display text-base font-bold tabular-nums" dir="ltr">
										{formatBig(price, locale)}
									</span>
								</button>
							</li>
						{/each}
					</ul>
				{/if}
			{:else if tab === 'achievements'}
				<p dir="auto" class="text-sm font-semibold">
					{m.tycoon_achievements_summary({
						count: formatCount(game.achievementIds.length, locale),
						total: formatCount(ACHIEVEMENTS.length, locale)
					})}
				</p>
				<p dir="auto" class="text-xs font-semibold tabular-nums">
					{m.tycoon_achievements_boosts(boosts)}
				</p>
				<ul class="grid grid-cols-1 gap-2 sm:grid-cols-2">
					{#each ACHIEVEMENTS as achievement (achievement.id)}
						{@const unlocked = game.achievementIds.includes(achievement.id)}
						<li
							class="flex items-center gap-2 rounded-[10px_6px_12px_6px] border-3 border-ink px-3 py-2 {unlocked
								? 'bg-explosion-yellow'
								: 'bg-paper opacity-70'}"
						>
							<span
								class="grid size-8 shrink-0 place-items-center rounded-full border-2 border-ink bg-paper"
							>
								{#if unlocked}
									<IconTrophy class="size-4" aria-hidden="true" />
								{:else}
									<IconCheck class="size-4 opacity-30" aria-hidden="true" />
								{/if}
							</span>
							<span class="flex min-w-0 flex-col">
								<span dir="auto" class="font-display text-sm leading-tight font-bold">
									{achievementName(achievement.id)}
								</span>
								<span dir="auto" class="text-xs leading-tight">
									{achievementDescription(achievement)}
								</span>
								<span dir="auto" class="text-xs leading-tight font-bold">
									{achievementReward(achievement.reward)}
								</span>
							</span>
						</li>
					{/each}
				</ul>
			{:else}
				<TycoonPrestige {game} />
			{/if}
		</div>
	</section>

	<TutorialModal
		open={showTutorial}
		title={m.tycoon_tutorial_title()}
		closeLabel={m.tycoon_tutorial_close()}
		onclose={closeHelp}
	>
		<p>{m.tycoon_tutorial_goal({ percent: formatCount((COST_GROWTH - 1) * 100, locale) })}</p>
		<p>{m.tycoon_tutorial_upgrades()}</p>
		<p>{m.tycoon_tutorial_crises()}</p>
		<p>
			{m.tycoon_tutorial_offline({
				hours: formatCount(OFFLINE_CAP_MS / 3_600_000, locale),
				percent: formatCount(OFFLINE_EFFICIENCY * 100, locale)
			})}
		</p>
		<p>
			{m.tycoon_tutorial_prestige({ percent: formatCount(PRESTIGE_BONUS * 100, locale) })}
		</p>
	</TutorialModal>
</GameShell>

<style>
	/* Upgrades far off screen are not laid out or painted, which keeps a long list light */
	.tycoon-upgrade {
		content-visibility: auto;
		contain-intrinsic-size: auto 60px;
	}

	.tycoon-toast {
		animation: tycoon-toast 2600ms ease-out forwards;
	}

	@keyframes tycoon-toast {
		0% {
			opacity: 0;
			transform: translateY(8px) scale(0.9);
		}
		10% {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
		80% {
			opacity: 1;
		}
		100% {
			opacity: 0;
			transform: translateY(-10px);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.tycoon-toast {
			animation: none;
		}
	}
</style>
