<!--
	Drone Works: Flamingo, Freyja and Pelikan are built tonight, if the plant can be raised in time.
	The player builds a small Factorio-style chain on twelve slots, keeps it fed while strikes damage
	and destroy buildings, and pays for repairs out of the procurement budget.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import DroneworksField from '#lib/components/DroneworksField.svelte';
	import GameOverModal from '#lib/components/GameOverModal.svelte';
	import GameShell from '#lib/components/GameShell.svelte';
	import TutorialModal from '#lib/components/TutorialModal.svelte';
	import { prefersReducedMotion } from '#lib/game/loop.js';
	import { m } from '#lib/paraglide/messages.js';
	import { firstPlay } from '#lib/services/tutorial.js';
	import { DroneworksGame } from '#lib/stores/droneworksGame.svelte.js';
	import IconHelp from '~icons/lucide/circle-help';
	import IconPause from '~icons/lucide/pause';
	import IconPlay from '~icons/lucide/play';

	const game = new DroneworksGame({ reducedMotion: prefersReducedMotion() });
	const modeName = m.mode_droneworks_name();

	// The how-to-play screen opens on the first visit and whenever the help button is tapped
	let showTutorial = $state(false);
	onMount(() => {
		game.loadBest();
		showTutorial = firstPlay('droneworks');
	});

	function openHelp() {
		game.pause();
		showTutorial = true;
	}

	const won = $derived(game.status === 'over' && game.delivered >= game.quota);
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
			aria-label={m.droneworks_help_button()}
			onclick={openHelp}
		>
			<IconHelp class="size-4" aria-hidden="true" />
			<span class="hidden sm:inline">{m.droneworks_help_button()}</span>
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

	<section class="mx-auto flex w-full max-w-xl flex-1 flex-col items-center gap-2">
		<DroneworksField {game} />
	</section>

	<TutorialModal
		open={showTutorial}
		title={m.droneworks_tutorial_title()}
		closeLabel={m.droneworks_tutorial_close()}
		onclose={() => (showTutorial = false)}
	>
		<p>{m.droneworks_tutorial_goal()}</p>
		<p>{m.droneworks_tutorial_chain()}</p>
		<p>{m.droneworks_tutorial_budget()}</p>
		<p>{m.droneworks_tutorial_strikes()}</p>
		<p>{m.droneworks_tutorial_flak()}</p>
		<p>{m.droneworks_tutorial_keys()}</p>
	</TutorialModal>

	<GameOverModal
		open={game.status === 'over'}
		score={game.score}
		mode="droneworks"
		{modeName}
		isNewBest={game.isNewBest}
		title={won ? m.droneworks_gameover_won() : m.droneworks_gameover_title()}
		drawBoard={game.drawBoard}
		onRetry={() => game.start()}
	>
		<dl class="grid grid-cols-2 gap-2 font-display text-sm">
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="text-center font-bold">{m.droneworks_stat_shipped()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{game.stats.shipped}</dd>
			</div>
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="text-center font-bold">{m.droneworks_stat_intercepted()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{game.stats.intercepted}</dd>
			</div>
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="text-center font-bold">{m.droneworks_stat_hits()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{game.stats.hits}</dd>
			</div>
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="text-center font-bold">{m.droneworks_stat_repaired()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{game.stats.repaired}</dd>
			</div>
		</dl>
	</GameOverModal>
</GameShell>
