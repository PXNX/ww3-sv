<script lang="ts">
	import { onMount } from 'svelte';
	import GameOverModal from '#lib/components/GameOverModal.svelte';
	import GameShell from '#lib/components/GameShell.svelte';
	import RaidCanvas from '#lib/components/RaidCanvas.svelte';
	import RaidItemIcon from '#lib/components/RaidItemIcon.svelte';
	import RaidLobby from '#lib/components/RaidLobby.svelte';
	import TutorialModal from '#lib/components/TutorialModal.svelte';
	import { formatTime, itemName, RARITY_NAMES } from '#lib/components/raidText.js';
	import { prefersReducedMotion } from '#lib/game/loop.js';
	import { RARITIES, RARITY_COLOR } from '#lib/game/raid/config.js';
	import type { GearItem } from '#lib/game/raid/items.js';
	import { m } from '#lib/paraglide/messages.js';
	import { firstPlay } from '#lib/services/tutorial.js';
	import { RaidGame } from '#lib/stores/raidGame.svelte.js';
	import IconHelp from '~icons/lucide/circle-help';
	import IconPause from '~icons/lucide/pause';
	import IconPlay from '~icons/lucide/play';
	import IconRotate from '~icons/lucide/smartphone';

	const game = new RaidGame({ reducedMotion: prefersReducedMotion() });
	const modeName = m.mode_raid_name();

	let showTutorial = $state(false);
	let portrait = $state(false);
	let rotateDismissed = $state(false);

	onMount(() => {
		game.load();
		// Development only: lets a browser console (or a screenshot script) poke at the raid
		if (import.meta.env.DEV) Object.assign(window, { raidGame: game });
		showTutorial = firstPlay('raid');
		const query = matchMedia('(orientation: portrait)');
		const update = () => (portrait = query.matches);
		update();
		query.addEventListener('change', update);
		return () => {
			query.removeEventListener('change', update);
			if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
		};
	});

	/**
	 * Raids are played sideways: on a phone, starting one asks for full screen and a landscape lock
	 * (both need the tap that starts it). Browsers that refuse simply keep the page as it is.
	 */
	async function goLandscape() {
		if (!matchMedia('(pointer: coarse)').matches) return;
		try {
			if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.();
			const orientation = screen.orientation as ScreenOrientation & {
				lock?: (orientation: string) => Promise<void>;
			};
			await orientation.lock?.('landscape');
		} catch {
			// Not supported here (iOS Safari, desktop): the rotate hint covers it
		}
	}

	function start() {
		void goLandscape();
		game.start();
	}

	function openHelp() {
		game.pause();
		showTutorial = true;
	}

	const inRaid = $derived(game.status !== 'lobby');
	const result = $derived(game.result);
	/** The rarest piece found, named under the loot icons */
	const topFind = $derived(
		result?.gear.reduce<GearItem | null>(
			(best, item) =>
				!best || RARITIES.indexOf(item.rarity) > RARITIES.indexOf(best.rarity) ? item : best,
			null
		) ?? null
	);
</script>

<GameShell
	title={modeName}
	score={inRaid ? game.score : undefined}
	best={game.best}
	wide
	confirmLeave={game.status === 'playing' || game.status === 'paused' || game.status === 'down'}
>
	{#snippet actions()}
		<button
			type="button"
			class="btn-chunky px-2 py-1 text-sm sm:px-3"
			aria-label={m.raid_help_button()}
			onclick={openHelp}
		>
			<IconHelp class="size-4" aria-hidden="true" />
			<span class="hidden sm:inline">{m.raid_help_button()}</span>
		</button>
		{#if game.status === 'playing' || game.status === 'paused'}
			<button type="button" class="btn-chunky px-3 py-1 text-sm" onclick={() => game.togglePause()}>
				{#if game.status === 'paused'}
					<IconPlay class="size-4" aria-hidden="true" />
					{m.game_resume()}
				{:else}
					<IconPause class="size-4" aria-hidden="true" />
					{m.game_pause()}
				{/if}
			</button>
		{/if}
	{/snippet}

	{#if inRaid}
		<div class="relative flex min-h-0 flex-1 flex-col">
			<RaidCanvas {game} />
			{#if portrait && !rotateDismissed && game.status !== 'over'}
				<div
					class="absolute inset-0 z-30 flex items-center justify-center rounded-[14px_8px_16px_10px] bg-banner-slate p-4"
					role="dialog"
					aria-modal="true"
					aria-labelledby="raid-rotate-title"
				>
					<div class="sticker flex max-w-xs flex-col items-center gap-3 p-5 text-center">
						<IconRotate class="rotate-hint size-14" aria-hidden="true" />
						<h2 id="raid-rotate-title" dir="auto" class="font-display text-2xl font-bold">
							{m.raid_rotate_title()}
						</h2>
						<p dir="auto" class="text-sm">{m.raid_rotate_body()}</p>
						<button
							type="button"
							class="btn-chunky text-sm"
							onclick={() => (rotateDismissed = true)}
						>
							{m.raid_rotate_dismiss()}
						</button>
					</div>
				</div>
			{/if}
		</div>
	{:else}
		<RaidLobby {game} onStart={start} />
	{/if}

	<TutorialModal
		open={showTutorial}
		title={m.raid_tutorial_title()}
		closeLabel={m.raid_tutorial_close()}
		onclose={() => (showTutorial = false)}
	>
		<p>{m.raid_tutorial_goal()}</p>
		<p>{m.raid_tutorial_controls()}</p>
		<p>{m.raid_tutorial_weapons()}</p>
		<ul class="flex flex-col gap-2">
			<li class="flex items-center gap-2">
				<RaidItemIcon kind="rifle" rarity="common" class="size-10 shrink-0" />
				<span><strong>{m.raid_weapon_rifle()}</strong> {m.raid_weapon_rifle_trait()}</span>
			</li>
			<li class="flex items-center gap-2">
				<RaidItemIcon kind="marksman" rarity="common" class="size-10 shrink-0" />
				<span><strong>{m.raid_weapon_marksman()}</strong> {m.raid_weapon_marksman_trait()}</span>
			</li>
		</ul>
		<p>{m.raid_tutorial_variants()}</p>
		<p>{m.raid_tutorial_loot()}</p>
		<p>{m.raid_tutorial_revive()}</p>
		<p class="hidden text-sm sm:block">{m.raid_keyboard_hint()}</p>
	</TutorialModal>

	<GameOverModal
		open={game.status === 'over'}
		score={game.score}
		mode="raid"
		{modeName}
		isNewBest={game.isNewBest}
		title={m.raid_gameover_title()}
		drawBoard={game.drawBoard}
		onRetry={start}
	>
		{#if result}
			<dl class="grid grid-cols-3 gap-2 font-display text-sm">
				<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
					<dt class="font-bold">{m.raid_stat_time()}</dt>
					<dd class="text-xl font-bold tabular-nums">{formatTime(result.timeMs)}</dd>
				</div>
				<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
					<dt class="font-bold">{m.raid_stat_kills()}</dt>
					<dd class="text-xl font-bold tabular-nums">{result.kills}</dd>
				</div>
				<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
					<dt class="font-bold">{m.raid_stat_bosses()}</dt>
					<dd class="text-xl font-bold tabular-nums">{result.bossKills}</dd>
				</div>
				<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
					<dt class="font-bold">{m.raid_stat_elites()}</dt>
					<dd class="text-xl font-bold tabular-nums">{result.eliteKills}</dd>
				</div>
				<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
					<dt class="font-bold">{m.raid_stat_xp()}</dt>
					<dd class="text-xl font-bold tabular-nums">{result.xp}</dd>
				</div>
				<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
					<dt class="font-bold">{m.raid_stat_gold()}</dt>
					<dd class="text-xl font-bold tabular-nums">{result.gold}</dd>
				</div>
			</dl>
			{#if result.levelsGained > 0}
				<p
					dir="auto"
					class="pop-in rounded-md border-2 border-ink bg-explosion-yellow p-2 text-center font-display font-bold"
				>
					{m.raid_result_level_up({ level: result.level })}
				</p>
			{/if}
			<div class="flex flex-col gap-1">
				<h3 class="font-display text-sm font-bold">{m.raid_result_loot()}</h3>
				{#if result.gear.length === 0}
					<p class="text-sm opacity-80">{m.raid_result_no_loot()}</p>
				{:else}
					<ul class="flex flex-wrap gap-1.5">
						{#each result.gear as item (item.id)}
							<li
								title="{itemName(item)}, {RARITY_NAMES[item.rarity]()}, {m.raid_item_level({
									level: item.level
								})}"
							>
								<RaidItemIcon
									kind={item.type === 'weapon' ? item.kind : item.slot}
									rarity={item.rarity}
									class="size-10"
								/>
								<span class="sr-only">{itemName(item)}, {RARITY_NAMES[item.rarity]()}</span>
							</li>
						{/each}
					</ul>
					{#if topFind}
						<p dir="auto" class="text-xs font-bold" style:color={RARITY_COLOR[topFind.rarity]}>
							{RARITY_NAMES[topFind.rarity]()} · {itemName(topFind)} · {m.raid_item_level({
								level: topFind.level
							})}
						</p>
					{/if}
				{/if}
				{#if result.salvaged > 0}
					<p dir="auto" class="text-xs">
						{m.raid_result_salvaged({ count: result.salvaged, gold: result.salvageGold })}
					</p>
				{/if}
			</div>
			<button type="button" class="btn-chunky text-sm" onclick={() => game.backToLobby()}>
				{m.raid_back_to_lobby()}
			</button>
		{/if}
	</GameOverModal>
</GameShell>

<style>
	:global(.rotate-hint) {
		animation: rotate-hint 1.6s ease-in-out infinite;
	}

	@keyframes rotate-hint {
		0%,
		30% {
			rotate: 0deg;
		}
		60%,
		100% {
			rotate: -90deg;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		:global(.rotate-hint) {
			animation: none;
		}
	}
</style>
