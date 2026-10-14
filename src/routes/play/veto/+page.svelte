<!--
	Security Council Veto (roadmap 3.15): a reaction game at a table of five permanent seats. A silly
	draft resolution flashes, every seat holds up an aye, nay or meh card, and the player taps vote
	yes, abstain or veto before the clock bar runs out. Three alike decide; no majority goes to the
	veto stamp. A wrong vote costs a heart, and streaks make every round shorter.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import GameOverModal from '#lib/components/GameOverModal.svelte';
	import GameShell from '#lib/components/GameShell.svelte';
	import LivesBar from '#lib/components/LivesBar.svelte';
	import TutorialModal from '#lib/components/TutorialModal.svelte';
	import VetoField from '#lib/components/VetoField.svelte';
	import { prefersReducedMotion } from '#lib/game/loop.js';
	import { STARTING_LIVES } from '#lib/game/veto/config.js';
	import { m } from '#lib/paraglide/messages.js';
	import { firstPlay } from '#lib/services/tutorial.js';
	import { VetoGame } from '#lib/stores/vetoGame.svelte.js';
	import IconHelp from '~icons/lucide/circle-help';
	import IconPause from '~icons/lucide/pause';
	import IconPlay from '~icons/lucide/play';

	const game = new VetoGame({ reducedMotion: prefersReducedMotion() });
	const modeName = m.mode_veto_name();

	// The how-to-play screen opens on the first visit and whenever the help button is tapped
	let showTutorial = $state(false);
	onMount(() => {
		game.loadBest();
		showTutorial = firstPlay('veto');
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
			aria-label={m.veto_help_button()}
			onclick={openHelp}
		>
			<IconHelp class="size-4" aria-hidden="true" />
			<span class="hidden sm:inline">{m.veto_help_button()}</span>
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
				{m.veto_hud_round({ round: game.round })}
			</p>
			<p dir="auto" class="font-display text-sm font-bold tabular-nums sm:text-base">
				{m.veto_hud_streak({ count: game.streak })}
				<span class="text-tie-red">{m.veto_hud_multiplier({ multiplier: game.multiplier })}</span>
			</p>
			<p dir="auto" class="font-display text-sm font-bold tabular-nums sm:text-base">
				{m.veto_hud_pace({ level: game.pace })}
			</p>
		</div>

		<VetoField {game} />
	</section>

	<TutorialModal
		open={showTutorial}
		title={m.veto_tutorial_title()}
		closeLabel={m.veto_tutorial_close()}
		onclose={() => (showTutorial = false)}
	>
		<p>{m.veto_tutorial_goal()}</p>
		<p>{m.veto_tutorial_rules()}</p>
		<p>{m.veto_tutorial_lives()}</p>
		<p>{m.veto_tutorial_speed()}</p>
		<p>{m.veto_tutorial_keys()}</p>
	</TutorialModal>

	<GameOverModal
		open={game.status === 'over'}
		score={game.score}
		mode="veto"
		{modeName}
		isNewBest={game.isNewBest}
		title={m.veto_gameover_title()}
		drawBoard={game.drawBoard}
		onRetry={() => game.start()}
	>
		<dl class="grid grid-cols-3 gap-2 font-display text-sm">
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="font-bold">{m.veto_stat_drafts()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{game.correct}</dd>
			</div>
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="font-bold">{m.veto_stat_streak()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{game.bestStreak}</dd>
			</div>
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="font-bold">{m.veto_stat_ties()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{game.tieBreaks}</dd>
			</div>
		</dl>
	</GameOverModal>
</GameShell>
