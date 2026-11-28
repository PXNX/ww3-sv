<!--
	Sondage Slider: your approval is the wobbling poll line. Tap rallies, counter scandals, ignore
	fake polls and survive eight weeks of rising pressure for up to three stars.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import GameOverModal from '#lib/components/GameOverModal.svelte';
	import GameShell from '#lib/components/GameShell.svelte';
	import SliderBoard from '#lib/components/SliderBoard.svelte';
	import InteractiveTutorial from '#lib/components/InteractiveTutorial.svelte';
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
	import { tutorialSteps } from './tutorial.js';

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

	const run = $derived(game.state);
</script>

<GameShell
	title={modeName}
	score={run.score}
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
			<button
				type="button"
				class="btn-chunky px-2 py-1 text-sm sm:px-3"
				aria-label={game.paused ? m.game_resume() : m.game_pause()}
				title={game.paused ? m.game_resume() : m.game_pause()}
				onclick={() => game.togglePause()}
			>
				{#if game.paused}
					<IconPlay class="size-4" aria-hidden="true" />
					<span class="hidden sm:inline">{m.game_resume()}</span>
				{:else}
					<IconPause class="size-4" aria-hidden="true" />
					<span class="hidden sm:inline">{m.game_pause()}</span>
				{/if}
			</button>
		{/if}
	{/snippet}

	<div data-tutorial="playfield" class="mx-auto flex w-full max-w-xl flex-col gap-3 p-3">
		<SliderBoard bind:this={board} {game} {reducedMotion} />
		{#if game.paused && !showTutorial && !game.over}
			<p class="text-center font-display text-sm font-bold" role="status">{m.game_paused()}</p>
		{/if}
	</div>

	<InteractiveTutorial
		open={showTutorial}
		title={m.slider_tutorial_title()}
		steps={tutorialSteps}
		closeLabel={m.slider_tutorial_close()}
		onclose={() => (showTutorial = false)}
	/>

	<GameOverModal
		open={game.over}
		score={run.score}
		mode="slider"
		{modeName}
		outcome={run.won ? 'won' : 'lost'}
		isNewBest={game.isNewBest}
		title={run.won ? m.slider_result_won() : m.slider_result_lost()}
		onRetry={() => game.start()}
	>
		<div
			class="mb-2 flex justify-center gap-1"
			role="img"
			aria-label={m.slider_stars_label({ stars: run.stars })}
		>
			{#each [1, 2, 3] as n (n)}
				<IconStar
					class="size-9 {n <= run.stars ? 'fill-explosion-yellow' : 'opacity-30'}"
					aria-hidden="true"
				/>
			{/each}
		</div>
		<dl class="grid grid-cols-3 gap-2 font-display text-sm">
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="text-center font-bold">{m.slider_stat_approval()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{Math.round(run.approval)}%</dd>
			</div>
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="text-center font-bold">{m.slider_stat_combo()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{run.bestCombo}</dd>
			</div>
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="text-center font-bold">{m.slider_stat_countered()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{run.countered}</dd>
			</div>
		</dl>
		{#if !run.won}
			<p class="mt-2 text-center font-display text-sm" dir="auto">
				{m.slider_lost_hint({ week: run.week })}
			</p>
		{/if}
	</GameOverModal>
</GameShell>
