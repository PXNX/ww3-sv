<!--
	Wandering Balloon (roadmap 3.16): the 2023 "weather balloon" drifts across America, and you are
	the balloon. One button: hold the burner to climb, let go to sink. Five stacked wind layers carry
	you at different speeds, crows, thunderclouds, kites and patrol jets cost hearts, and farms, silo
	fields and a very interesting lake earn weather photos. The run ends at the east coast, where a
	comically small missile pops the balloon.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import BalloonCanvas from '#lib/components/BalloonCanvas.svelte';
	import GameOverModal from '#lib/components/GameOverModal.svelte';
	import GameShell from '#lib/components/GameShell.svelte';
	import LivesBar from '#lib/components/LivesBar.svelte';
	import TutorialModal from '#lib/components/TutorialModal.svelte';
	import { STARTING_LIVES } from '#lib/game/balloon/config.js';
	import { prefersReducedMotion } from '#lib/game/loop.js';
	import { m } from '#lib/paraglide/messages.js';
	import { firstPlay } from '#lib/services/tutorial.js';
	import { BalloonGame } from '#lib/stores/balloonGame.svelte.js';
	import { cameoAsset } from '#lib/theme/cameos.js';
	import IconHelp from '~icons/lucide/circle-help';
	import IconPause from '~icons/lucide/pause';
	import IconPlay from '~icons/lucide/play';

	const game = new BalloonGame({ reducedMotion: prefersReducedMotion() });
	const modeName = m.mode_balloon_name();

	// The how-to-play screen opens on the first visit and whenever the help button is tapped
	let showTutorial = $state(false);
	onMount(() => {
		game.loadBest();
		showTutorial = firstPlay('balloon');
	});

	function openHelp() {
		game.pause();
		showTutorial = true;
	}

	// Game over: the balloon insists it was only ever a weather balloon, whichever way it ended
	const cameo = $derived({
		image: cameoAsset('balloon-weather.svg'),
		alt: m.balloon_cameo_alt(),
		message: game.finished ? m.balloon_cameo_message_finished() : m.balloon_cameo_message_lost(),
		label: m.balloon_cameo_label()
	});

	const lowFuel = $derived(game.fuelPercent <= 20);
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
			aria-label={m.balloon_help_button()}
			onclick={openHelp}
		>
			<IconHelp class="size-4" aria-hidden="true" />
			<span class="hidden sm:inline">{m.balloon_help_button()}</span>
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

	<section class="mx-auto flex w-full max-w-3xl flex-col items-center gap-2">
		<div
			class="flex w-full items-center justify-between gap-3 rounded-[12px_6px_14px_8px] border-3 border-ink bg-paper px-3 py-2 shadow-[3px_3px_0_var(--color-ink)]"
		>
			<LivesBar lives={game.lives} max={STARTING_LIVES} class="shrink-0 text-xl" />
			<div class="flex min-w-0 flex-1 items-center gap-2">
				<p dir="auto" class="font-display text-xs font-bold sm:text-sm" aria-hidden="true">
					{m.balloon_hud_fuel()}
				</p>
				<div
					class="h-3 min-w-12 flex-1 overflow-hidden rounded-full border-2 border-ink bg-sand"
					role="progressbar"
					aria-label={m.balloon_fuel_label()}
					aria-valuemin={0}
					aria-valuemax={100}
					aria-valuenow={game.fuelPercent}
				>
					<div
						class="h-full transition-[width]"
						class:bg-tie-red={lowFuel}
						class:bg-explosion-yellow={!lowFuel}
						style:width="{game.fuelPercent}%"
					></div>
				</div>
			</div>
			<p dir="auto" class="font-display text-sm font-bold tabular-nums sm:text-base">
				{m.balloon_hud_photos({ count: game.photos })}
			</p>
			<p dir="auto" class="font-display text-sm font-bold tabular-nums sm:text-base">
				{m.balloon_hud_progress({ percent: game.progressPercent })}
			</p>
		</div>

		<BalloonCanvas {game} />
	</section>

	<TutorialModal
		open={showTutorial}
		title={m.balloon_tutorial_title()}
		closeLabel={m.balloon_tutorial_close()}
		onclose={() => (showTutorial = false)}
	>
		<p>{m.balloon_tutorial_goal()}</p>
		<p>{m.balloon_tutorial_burner()}</p>
		<p>{m.balloon_tutorial_wind()}</p>
		<p>{m.balloon_tutorial_hazards()}</p>
		<p>{m.balloon_tutorial_photos()}</p>
		<p>{m.balloon_tutorial_coast()}</p>
		<p>{m.balloon_tutorial_keys()}</p>
	</TutorialModal>

	<GameOverModal
		open={game.status === 'over'}
		score={game.score}
		mode="balloon"
		{modeName}
		isNewBest={game.isNewBest}
		title={m.balloon_gameover_title()}
		customCameo={cameo}
		drawBoard={game.drawBoard}
		onRetry={() => game.start()}
	>
		<dl class="grid grid-cols-3 gap-2 font-display text-sm">
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="font-bold">{m.balloon_stat_distance()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{game.progressPercent}%</dd>
			</div>
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="font-bold">{m.balloon_stat_photos()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{game.photos}</dd>
			</div>
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="font-bold">{m.balloon_stat_hearts()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{game.lives}</dd>
			</div>
		</dl>
	</GameOverModal>
</GameShell>
