<!--
	Petrobras (improvements 5.1): defend an oil giant from a hostile takeover on one screen and the
	society feed on the other. Both fronts start level and the score is the lower of the two, so a
	player who camps on the boardroom runs the feed into the ground and the other way round. Every
	fifth round the feed algorithm itself asks for an answer, and only a boring press release wins.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import GameOverModal from '#lib/components/GameOverModal.svelte';
	import GameShell from '#lib/components/GameShell.svelte';
	import PetrobrasField from '#lib/components/PetrobrasField.svelte';
	import TutorialModal from '#lib/components/TutorialModal.svelte';
	import { prefersReducedMotion } from '#lib/game/loop.js';
	import { m } from '#lib/paraglide/messages.js';
	import { firstPlay } from '#lib/services/tutorial.js';
	import { PetrobrasGame } from '#lib/stores/petrobrasGame.svelte.js';
	import IconHelp from '~icons/lucide/circle-help';
	import IconPause from '~icons/lucide/pause';
	import IconPlay from '~icons/lucide/play';

	const game = new PetrobrasGame({ reducedMotion: prefersReducedMotion() });
	const modeName = m.mode_petrobras_name();

	// The how-to-play screen opens on the first visit and whenever the help button is tapped
	let showTutorial = $state(false);
	onMount(() => {
		game.loadBest();
		showTutorial = firstPlay('petrobras');
	});

	function openHelp() {
		game.pause();
		showTutorial = true;
	}
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
			aria-label={m.petrobras_help_button()}
			onclick={openHelp}
		>
			<IconHelp class="size-4" aria-hidden="true" />
			<span class="hidden sm:inline">{m.petrobras_help_button()}</span>
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

	<section class="mx-auto flex w-full flex-col items-center gap-2">
		<div
			class="flex w-full items-center justify-center gap-6 rounded-[12px_6px_14px_8px] border-3 border-ink bg-paper px-3 py-2 shadow-[3px_3px_0_var(--color-ink)]"
		>
			<p dir="auto" class="font-display text-sm font-bold tabular-nums sm:text-base">
				{m.petrobras_hud_streak({ count: game.streak })}
			</p>
			<p dir="auto" class="font-display text-sm font-bold tabular-nums sm:text-base">
				{m.petrobras_hud_correct({ count: game.correct })}
			</p>
		</div>

		<PetrobrasField {game} />
	</section>

	<TutorialModal
		open={showTutorial}
		title={m.petrobras_tutorial_title()}
		closeLabel={m.petrobras_tutorial_close()}
		onclose={() => (showTutorial = false)}
	>
		<p>{m.petrobras_tutorial_goal()}</p>
		<p>{m.petrobras_tutorial_fronts()}</p>
		<p>{m.petrobras_tutorial_neglect()}</p>
		<p>{m.petrobras_tutorial_boss()}</p>
		<p>{m.petrobras_tutorial_keys()}</p>
	</TutorialModal>

	<GameOverModal
		open={game.status === 'over'}
		score={game.score}
		mode="petrobras"
		{modeName}
		isNewBest={game.isNewBest}
		title={m.petrobras_gameover_title()}
		drawBoard={game.drawBoard}
		onRetry={() => game.start()}
	>
		<dl class="grid grid-cols-3 gap-2 font-display text-sm">
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="font-bold">{m.petrobras_stat_rounds()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{game.round}</dd>
			</div>
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="font-bold">{m.petrobras_stat_streak()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{game.bestStreak}</dd>
			</div>
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="font-bold">{m.petrobras_stat_timeouts()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{game.timeouts}</dd>
			</div>
		</dl>
	</GameOverModal>
</GameShell>
