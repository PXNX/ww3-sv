<!--
	Rare Earth Squeeze (roadmap 3.16): route shipments while the quota rules change. Crates of rare
	earths spawn at the mines and have to reach the factory that wants them before their deadline.
	Tap a node to switch its outgoing lane (or drag from it towards the lane you want). Every few
	rounds the ministry of export affairs issues a notice: a banned lane, a tariff, a quota, a licence.
	Breaking a rule, missing a deadline or delivering to the wrong factory costs a heart.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import GameOverModal from '#lib/components/GameOverModal.svelte';
	import GameShell from '#lib/components/GameShell.svelte';
	import LivesBar from '#lib/components/LivesBar.svelte';
	import RareEarthField from '#lib/components/RareEarthField.svelte';
	import TutorialModal from '#lib/components/TutorialModal.svelte';
	import { prefersReducedMotion } from '#lib/game/loop.js';
	import { STARTING_LIVES } from '#lib/game/rareearth/config.js';
	import { m } from '#lib/paraglide/messages.js';
	import { firstPlay } from '#lib/services/tutorial.js';
	import { RareEarthGame } from '#lib/stores/rareearthGame.svelte.js';
	import { cameoAsset } from '#lib/theme/cameos.js';
	import IconHelp from '~icons/lucide/circle-help';
	import IconPause from '~icons/lucide/pause';
	import IconPlay from '~icons/lucide/play';

	const game = new RareEarthGame({ reducedMotion: prefersReducedMotion() });
	const modeName = m.mode_rareearth_name();

	// The how-to-play screen opens on the first visit and whenever the help button is tapped
	let showTutorial = $state(false);
	onMount(() => {
		game.loadBest();
		showTutorial = firstPlay('rareearth');
	});

	function openHelp() {
		game.pause();
		showTutorial = true;
	}

	// Game over: the clerk stamps the application, depending on how the shift went
	const cameoMessage = $derived(
		game.violations >= 2 && game.violations >= game.delivered
			? m.rareearth_cameo_message_forms()
			: game.round >= 6
				? m.rareearth_cameo_message_far()
				: m.rareearth_cameo_message_default()
	);
	const cameo = $derived({
		image: cameoAsset('rareearth-clerk.svg'),
		alt: m.rareearth_cameo_alt(),
		message: cameoMessage,
		label: m.rareearth_cameo_label()
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
			aria-label={m.rareearth_help_button()}
			onclick={openHelp}
		>
			<IconHelp class="size-4" aria-hidden="true" />
			<span class="hidden sm:inline">{m.rareearth_help_button()}</span>
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

	<section class="mx-auto flex w-full max-w-xl flex-col items-center gap-2">
		<div
			class="flex w-full items-center justify-between gap-3 rounded-[12px_6px_14px_8px] border-3 border-ink bg-paper px-3 py-2 shadow-[3px_3px_0_var(--color-ink)]"
		>
			<LivesBar lives={game.lives} max={STARTING_LIVES} class="shrink-0 text-xl" />
			<p dir="auto" class="font-display text-sm font-bold tabular-nums sm:text-base">
				{m.rareearth_hud_round({ round: game.round })}
			</p>
			<p dir="auto" class="font-display text-sm font-bold tabular-nums sm:text-base">
				{m.rareearth_hud_delivered({ count: game.delivered })}
			</p>
			<p
				dir="auto"
				class="font-display text-sm font-bold tabular-nums sm:text-base {game.multiplier > 1
					? 'text-tie-red'
					: ''}"
			>
				{m.rareearth_hud_combo({ multiplier: game.multiplier })}
			</p>
		</div>

		<RareEarthField {game} />
	</section>

	<TutorialModal
		open={showTutorial}
		title={m.rareearth_tutorial_title()}
		closeLabel={m.rareearth_tutorial_close()}
		onclose={() => (showTutorial = false)}
	>
		<p>{m.rareearth_tutorial_goal()}</p>
		<p>{m.rareearth_tutorial_route()}</p>
		<p>{m.rareearth_tutorial_rules()}</p>
		<p>{m.rareearth_tutorial_hearts()}</p>
		<p>{m.rareearth_tutorial_score()}</p>
		<p>{m.rareearth_tutorial_keys()}</p>
	</TutorialModal>

	<GameOverModal
		open={game.status === 'over'}
		score={game.score}
		mode="rareearth"
		{modeName}
		isNewBest={game.isNewBest}
		title={m.rareearth_gameover_title()}
		customCameo={cameo}
		drawBoard={game.drawBoard}
		onRetry={() => game.start()}
	>
		<dl class="grid grid-cols-2 gap-2 font-display text-sm sm:grid-cols-4">
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="font-bold">{m.rareearth_stat_round()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{game.round}</dd>
			</div>
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="font-bold">{m.rareearth_stat_delivered()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{game.delivered}</dd>
			</div>
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="font-bold">{m.rareearth_stat_violations()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{game.violations}</dd>
			</div>
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="font-bold">{m.rareearth_stat_combo()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{game.bestCombo}</dd>
			</div>
		</dl>
	</GameOverModal>
</GameShell>
