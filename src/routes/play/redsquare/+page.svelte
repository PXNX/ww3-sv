<!--
	Red Square (improvements 5.1): keep the victory parade rolling while the air defence thins out.
	A column crosses the square, and the player cues it while the marker sits in the lit band in front
	of the tribune. A cue in the band scores by how clean it was, a missed slot only costs the
	general's mood, and every four hits the radio announces the next wave with fewer interceptors and
	a shorter band. The result sheet is the punchline: the square is empty and the firework was big.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import GameOverModal from '#lib/components/GameOverModal.svelte';
	import GameShell from '#lib/components/GameShell.svelte';
	import LivesBar from '#lib/components/LivesBar.svelte';
	import RedSquareField from '#lib/components/RedSquareField.svelte';
	import TutorialModal from '#lib/components/TutorialModal.svelte';
	import { prefersReducedMotion } from '#lib/game/loop.js';
	import { STARTING_MOOD } from '#lib/game/redsquare/config.js';
	import { m } from '#lib/paraglide/messages.js';
	import { firstPlay } from '#lib/services/tutorial.js';
	import { RedSquareGame } from '#lib/stores/redsquareGame.svelte.js';
	import IconHelp from '~icons/lucide/circle-help';
	import IconPause from '~icons/lucide/pause';
	import IconPlay from '~icons/lucide/play';

	const game = new RedSquareGame({ reducedMotion: prefersReducedMotion() });
	const modeName = m.mode_redsquare_name();

	// The how-to-play screen opens on the first visit and whenever the help button is tapped
	let showTutorial = $state(false);
	onMount(() => {
		game.loadBest();
		showTutorial = firstPlay('redsquare');
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
			aria-label={m.redsquare_help_button()}
			onclick={openHelp}
		>
			<IconHelp class="size-4" aria-hidden="true" />
			<span class="hidden sm:inline">{m.redsquare_help_button()}</span>
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

	<section class="mx-auto flex w-full flex-1 flex-col items-center gap-2">
		<div
			class="flex w-full items-center justify-between gap-2 rounded-[12px_6px_14px_8px] border-3 border-ink bg-paper px-3 py-2 shadow-[3px_3px_0_var(--color-ink)]"
		>
			<LivesBar lives={game.mood} max={STARTING_MOOD} class="shrink-0 text-xl" />
			<p dir="auto" class="font-display text-sm font-bold tabular-nums sm:text-base">
				{m.redsquare_hud_round({ round: game.round })}
			</p>
			<p dir="auto" class="font-display text-sm font-bold tabular-nums sm:text-base">
				{m.redsquare_hud_wave({ wave: game.wave })}
			</p>
			<p dir="auto" class="font-display text-sm font-bold tabular-nums sm:text-base">
				{m.redsquare_hud_streak({ count: game.streak })}
			</p>
		</div>

		<RedSquareField {game} />
	</section>

	<TutorialModal
		open={showTutorial}
		title={m.redsquare_tutorial_title()}
		closeLabel={m.redsquare_tutorial_close()}
		onclose={() => (showTutorial = false)}
	>
		<p>{m.redsquare_tutorial_goal()}</p>
		<p>{m.redsquare_tutorial_rules()}</p>
		<p>{m.redsquare_tutorial_mood()}</p>
		<p>{m.redsquare_tutorial_waves()}</p>
		<p>{m.redsquare_tutorial_keys()}</p>
	</TutorialModal>

	<GameOverModal
		open={game.status === 'over'}
		score={game.score}
		mode="redsquare"
		{modeName}
		isNewBest={game.isNewBest}
		title={m.redsquare_gameover_title()}
		drawBoard={game.drawBoard}
		onRetry={() => game.start()}
	>
		<dl class="grid grid-cols-3 gap-2 font-display text-sm">
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="font-bold">{m.redsquare_stat_columns()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{game.hits}</dd>
			</div>
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="font-bold">{m.redsquare_stat_streak()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{game.bestStreak}</dd>
			</div>
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="font-bold">{m.redsquare_stat_waves()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{game.wave}</dd>
			</div>
		</dl>
	</GameOverModal>
</GameShell>
