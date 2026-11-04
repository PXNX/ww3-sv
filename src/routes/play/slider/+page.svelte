<!--
	Sondage Slider: your approval is the wobbling poll line. Tap rallies, counter scandals, ignore
	fake polls and survive eight weeks of rising pressure for up to three stars.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import GameOverModal from '#lib/components/GameOverModal.svelte';
	import GameShell from '#lib/components/GameShell.svelte';
	import SliderBoard from '#lib/components/SliderBoard.svelte';
	import TutorialModal from '#lib/components/TutorialModal.svelte';
	import { prefersReducedMotion } from '#lib/game/loop.js';
	import {
		COUNTER_GAIN,
		DECOY_PENALTY,
		PRESS_COOLDOWN,
		RESIGN_LINE,
		STAR_LINES,
		WEEKS_TOTAL
	} from '#lib/game/slider/state.js';
	import { m } from '#lib/paraglide/messages.js';
	import { firstPlay } from '#lib/services/tutorial.js';
	import { SliderGame } from '#lib/stores/sliderGame.svelte.js';
	import IconHelp from '~icons/lucide/circle-help';
	import IconPause from '~icons/lucide/pause';
	import IconPlay from '~icons/lucide/play';
	import IconStar from '~icons/lucide/star';

	const reducedMotion = prefersReducedMotion();
	let board: SliderBoard | undefined = $state();
	const game = new SliderGame({ onEvent: (event) => board?.fx(event) });
	const modeName = m.mode_slider_name();

	let showTutorial = $state(false);
	onMount(() => {
		game.loadBest();
		showTutorial = firstPlay('slider');
	});

	$effect(() => {
		if (showTutorial) game.pause();
	});

	function closeTutorial() {
		showTutorial = false;
		game.resume();
	}

	const state = $derived(game.state);
</script>

<GameShell
	title={modeName}
	score={state.score}
	best={game.best}
	confirmLeave={!game.over}
	onQuit={() => game.forfeit()}
>
	{#snippet actions()}
		<button
			type="button"
			class="btn-chunky px-2 py-1 text-sm sm:px-3"
			aria-label={m.slider_help_button()}
			onclick={() => (showTutorial = true)}
		>
			<IconHelp class="size-4" aria-hidden="true" />
			<span class="hidden sm:inline">{m.slider_help_button()}</span>
		</button>
		{#if !game.over}
			<button type="button" class="btn-chunky px-3 py-1 text-sm" onclick={() => game.togglePause()}>
				{#if game.paused}
					<IconPlay class="size-4" aria-hidden="true" />
					{m.game_resume()}
				{:else}
					<IconPause class="size-4" aria-hidden="true" />
					{m.game_pause()}
				{/if}
			</button>
		{/if}
	{/snippet}

	<div class="mx-auto flex w-full max-w-xl flex-col gap-3 p-3">
		<SliderBoard bind:this={board} {game} {reducedMotion} />
		{#if game.paused && !showTutorial && !game.over}
			<p class="text-center font-display text-sm font-bold" role="status">{m.game_paused()}</p>
		{/if}
	</div>

	<TutorialModal
		open={showTutorial}
		title={m.slider_tutorial_title()}
		closeLabel={m.slider_tutorial_close()}
		onclose={closeTutorial}
	>
		<p>{m.slider_tutorial_goal({ weeks: WEEKS_TOTAL, resign: RESIGN_LINE })}</p>
		<p>{m.slider_tutorial_rally()}</p>
		<p>{m.slider_tutorial_scandal({ gain: COUNTER_GAIN })}</p>
		<p>{m.slider_tutorial_decoy({ penalty: DECOY_PENALTY })}</p>
		<p>{m.slider_tutorial_combo()}</p>
		<p>{m.slider_tutorial_press({ seconds: PRESS_COOLDOWN })}</p>
		<p>
			{m.slider_tutorial_stars({ one: STAR_LINES[0], two: STAR_LINES[1], three: STAR_LINES[2] })}
		</p>
	</TutorialModal>

	<GameOverModal
		open={game.over}
		score={state.score}
		mode="slider"
		{modeName}
		outcome={state.won ? 'won' : 'lost'}
		isNewBest={game.isNewBest}
		title={state.won ? m.slider_result_won() : m.slider_result_lost()}
		onRetry={() => game.start()}
	>
		<div
			class="mb-2 flex justify-center gap-1"
			role="img"
			aria-label={m.slider_stars_label({ stars: state.stars })}
		>
			{#each [1, 2, 3] as n (n)}
				<IconStar
					class="size-9 {n <= state.stars ? 'fill-explosion-yellow' : 'opacity-30'}"
					aria-hidden="true"
				/>
			{/each}
		</div>
		<dl class="grid grid-cols-3 gap-2 font-display text-sm">
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="text-center font-bold">{m.slider_stat_approval()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{Math.round(state.approval)}%</dd>
			</div>
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="text-center font-bold">{m.slider_stat_combo()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{state.bestCombo}</dd>
			</div>
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="text-center font-bold">{m.slider_stat_countered()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{state.countered}</dd>
			</div>
		</dl>
		{#if !state.won}
			<p class="mt-2 text-center font-display text-sm" dir="auto">
				{m.slider_lost_hint({ week: state.week })}
			</p>
		{/if}
	</GameOverModal>
</GameShell>
