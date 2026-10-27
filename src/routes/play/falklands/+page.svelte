<!--
	Falklands (improvements 5.1): a task force races the other fleet across the South Atlantic.
	Each day the player picks a speed, the weather decides whether a sprint is allowed, and the
	fuel gauge decides how long the race can last. Seven days of talks open a deal that wins later
	and scores lower, which is the joke: the war is the fast path.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import FalklandsField from '#lib/components/FalklandsField.svelte';
	import GameOverModal from '#lib/components/GameOverModal.svelte';
	import GameShell from '#lib/components/GameShell.svelte';
	import TutorialModal from '#lib/components/TutorialModal.svelte';
	import { DIPLOMACY_TARGET } from '#lib/game/falklands/config.js';
	import { m } from '#lib/paraglide/messages.js';
	import { firstPlay } from '#lib/services/tutorial.js';
	import { FalklandsGame } from '#lib/stores/falklandsGame.svelte.js';
	import IconHelp from '~icons/lucide/circle-help';

	const game = new FalklandsGame();
	const modeName = m.mode_falklands_name();

	let showTutorial = $state(false);
	onMount(() => {
		game.loadBest();
		showTutorial = firstPlay('falklands');
	});

	const gameOverTitle = $derived(
		game.outcome === 'peace'
			? m.falklands_gameover_peace()
			: game.outcome === 'enemy'
				? m.falklands_gameover_enemy()
				: game.outcome === 'stranded'
					? m.falklands_gameover_stranded()
					: m.falklands_gameover_military()
	);
</script>

<GameShell
	title={modeName}
	score={game.score}
	best={game.best}
	confirmLeave={game.status === 'playing'}
>
	{#snippet actions()}
		<button
			type="button"
			class="btn-chunky px-2 py-1 text-sm sm:px-3"
			aria-label={m.falklands_help_button()}
			onclick={() => (showTutorial = true)}
		>
			<IconHelp class="size-4" aria-hidden="true" />
			<span class="hidden sm:inline">{m.falklands_help_button()}</span>
		</button>
	{/snippet}

	<section class="mx-auto flex w-full max-w-xl flex-1 flex-col items-center gap-2">
		<div
			class="flex w-full items-center justify-between gap-2 rounded-[12px_6px_14px_8px] border-3 border-ink bg-paper px-3 py-2 shadow-[3px_3px_0_var(--color-ink)]"
		>
			<p dir="auto" class="font-display text-sm font-bold tabular-nums sm:text-base">
				{m.falklands_hud_day({ day: game.day })}
			</p>
			<p dir="auto" class="font-display text-sm font-bold tabular-nums sm:text-base">
				{m.falklands_hud_talks({ count: game.talks, target: DIPLOMACY_TARGET })}
			</p>
		</div>

		<FalklandsField {game} />
	</section>

	<TutorialModal
		open={showTutorial}
		title={m.falklands_tutorial_title()}
		closeLabel={m.falklands_tutorial_close()}
		onclose={() => (showTutorial = false)}
	>
		<p>{m.falklands_tutorial_goal()}</p>
		<p>{m.falklands_tutorial_speeds()}</p>
		<p>{m.falklands_tutorial_weather()}</p>
		<p>{m.falklands_tutorial_enemy()}</p>
		<p>{m.falklands_tutorial_peace()}</p>
		<p>{m.falklands_tutorial_keys()}</p>
	</TutorialModal>

	<GameOverModal
		open={game.status === 'over'}
		score={game.score}
		mode="falklands"
		{modeName}
		isNewBest={game.isNewBest}
		title={gameOverTitle}
		drawBoard={game.drawBoard}
		onRetry={() => game.start()}
	>
		<dl class="grid grid-cols-3 gap-2 font-display text-sm">
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="font-bold">{m.falklands_stat_days()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{game.day}</dd>
			</div>
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="font-bold">{m.falklands_stat_fuel()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{game.fuel}</dd>
			</div>
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="font-bold">{m.falklands_stat_talks()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{game.talks}</dd>
			</div>
		</dl>
	</GameOverModal>
</GameShell>
