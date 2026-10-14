<!--
	Gold & Cheese Vault (roadmap 3.14): a memory game in a Swiss vault. Pair gold bars, cheese
	wheels, watches and chocolate; a gold bar with a cheese wheel is a bonus pair. A stern banker
	raises an eyebrow for every mismatch and the third one costs a heart, and now and then a ringing
	phone shuffles a few face-down cards. Every vault is bigger than the last.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import GameOverModal from '#lib/components/GameOverModal.svelte';
	import GameShell from '#lib/components/GameShell.svelte';
	import LivesBar from '#lib/components/LivesBar.svelte';
	import TutorialModal from '#lib/components/TutorialModal.svelte';
	import VaultBanker from '#lib/components/VaultBanker.svelte';
	import VaultField from '#lib/components/VaultField.svelte';
	import { prefersReducedMotion } from '#lib/game/loop.js';
	import { bankerFile, bankerPortrait } from '#lib/game/vault/banker.js';
	import { EYEBROWS_PER_HEART, STARTING_LIVES } from '#lib/game/vault/config.js';
	import { m } from '#lib/paraglide/messages.js';
	import { firstPlay } from '#lib/services/tutorial.js';
	import { VaultGame } from '#lib/stores/vaultGame.svelte.js';
	import { cameoAsset } from '#lib/theme/cameos.js';
	import IconHelp from '~icons/lucide/circle-help';
	import IconPause from '~icons/lucide/pause';
	import IconPlay from '~icons/lucide/play';

	const game = new VaultGame({ reducedMotion: prefersReducedMotion() });
	const modeName = m.mode_vault_name();

	// The how-to-play screen opens on the first visit and whenever the help button is tapped
	let showTutorial = $state(false);
	onMount(() => {
		game.loadBest();
		showTutorial = firstPlay('vault');
	});

	function openHelp() {
		game.pause();
		showTutorial = true;
	}

	// What the banker says depends on his mood and his raised eyebrows
	const caption = $derived(
		game.mood === 'glare'
			? m.vault_banker_glare()
			: game.mood === 'twitch'
				? m.vault_banker_twitch()
				: game.eyebrows >= 2
					? m.vault_banker_two()
					: game.eyebrows === 1
						? m.vault_banker_one()
						: m.vault_banker_neutral()
	);

	const pairsLeft = $derived(game.cards.filter((card) => card.state !== 'matched').length / 2);

	// Game over: the banker keeps a straight face after a good run, otherwise both eyebrows go up
	const cameo = $derived.by(() => {
		const pose = bankerPortrait(game.levelsCleared);
		return {
			image: cameoAsset(bankerFile(pose)),
			alt: pose === 'neutral' ? m.vault_cameo_alt_neutral() : m.vault_cameo_alt_raised(),
			message:
				pose === 'neutral'
					? m.vault_cameo_message_neutral()
					: game.score % 2 === 0
						? m.vault_cameo_message_raised()
						: m.vault_cameo_message_raised_2(),
			label: m.vault_banker_name()
		};
	});
</script>

<GameShell
	title={modeName}
	score={game.score}
	best={game.best}
	confirmLeave={game.status === 'playing' || game.status === 'paused'}
>
	{#snippet actions()}
		<button
			type="button"
			class="btn-chunky px-2 py-1 text-sm sm:px-3"
			aria-label={m.vault_help_button()}
			onclick={openHelp}
		>
			<IconHelp class="size-4" aria-hidden="true" />
			<span class="hidden sm:inline">{m.vault_help_button()}</span>
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

	<!-- The HUD and the playfield share one width, as wide as the height allows -->
	<section
		class="mx-auto flex w-full flex-col items-center gap-2"
		style:max-width="max(17rem, min(100%, calc((100dvh - 14rem) * {(game.cols * 10) /
			(game.rows * 11)})))"
	>
		<div
			class="flex w-full gap-3 rounded-[12px_6px_14px_8px] border-3 border-ink bg-paper px-3 py-2 shadow-[3px_3px_0_var(--color-ink)]"
		>
			<VaultBanker
				eyebrows={game.eyebrows}
				mood={game.mood}
				class="size-16 shrink-0 self-center sm:size-20"
			/>
			<div class="flex min-w-0 flex-1 flex-col gap-1">
				<div class="flex items-center justify-between gap-3">
					<p dir="auto" class="font-display text-base font-bold sm:text-lg">
						{m.vault_hud_level({ level: game.level })}
					</p>
					<LivesBar lives={game.lives} max={STARTING_LIVES} class="shrink-0 text-xl" />
				</div>
				<div class="flex items-center gap-2">
					<p dir="auto" class="font-display text-xs font-bold tabular-nums sm:text-sm">
						{m.vault_hud_eyebrows({ count: game.eyebrows, max: EYEBROWS_PER_HEART })}
					</p>
					<span class="flex gap-1" aria-hidden="true">
						{#each Array.from({ length: EYEBROWS_PER_HEART }, (_, i) => i) as pip (pip)}
							<span
								class="h-2 w-5 rounded-full border-2 border-ink transition-colors"
								class:bg-tie-red={pip < game.eyebrows}
								class:bg-sand={pip >= game.eyebrows}
							></span>
						{/each}
					</span>
					<p dir="auto" class="ms-auto font-display text-xs font-bold tabular-nums sm:text-sm">
						{m.vault_hud_pairs({ count: pairsLeft })}
					</p>
				</div>
				<p
					dir="auto"
					class="truncate font-display text-xs font-semibold italic"
					class:text-tie-red={game.ringing}
					aria-live="off"
				>
					{game.ringing ? m.vault_hud_ringing() : caption}
				</p>
			</div>
		</div>

		<VaultField {game} />
	</section>

	<TutorialModal
		open={showTutorial}
		title={m.vault_tutorial_title()}
		closeLabel={m.vault_tutorial_close()}
		onclose={() => (showTutorial = false)}
	>
		<p>{m.vault_tutorial_goal()}</p>
		<p>{m.vault_tutorial_special()}</p>
		<p>{m.vault_tutorial_banker()}</p>
		<p>{m.vault_tutorial_phone()}</p>
		<p>{m.vault_tutorial_score()}</p>
	</TutorialModal>

	<GameOverModal
		open={game.status === 'over'}
		score={game.score}
		mode="vault"
		{modeName}
		isNewBest={game.isNewBest}
		title={m.vault_gameover_title()}
		customCameo={cameo}
		drawBoard={game.drawBoard}
		onRetry={() => game.start()}
	>
		<dl class="grid grid-cols-2 gap-2 font-display text-sm">
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="font-bold">{m.vault_stat_levels()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{game.levelsCleared}</dd>
			</div>
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="font-bold">{m.vault_stat_special()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{game.specialPairs}</dd>
			</div>
		</dl>
	</GameOverModal>
</GameShell>
