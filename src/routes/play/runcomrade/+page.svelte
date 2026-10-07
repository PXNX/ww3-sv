<script lang="ts">
	import { onMount } from 'svelte';
	import GameOverModal from '#lib/components/GameOverModal.svelte';
	import GameShell from '#lib/components/GameShell.svelte';
	import LivesBar from '#lib/components/LivesBar.svelte';
	import RunComradeCanvas from '#lib/components/RunComradeCanvas.svelte';
	import RunComradeIcon from '#lib/components/RunComradeIcon.svelte';
	import TutorialModal from '#lib/components/TutorialModal.svelte';
	import { prefersReducedMotion } from '#lib/game/loop.js';
	import { STARTING_LIVES } from '#lib/game/runcomrade/config.js';
	import { m } from '#lib/paraglide/messages.js';
	import { firstPlay } from '#lib/services/tutorial.js';
	import { RunComradeGame } from '#lib/stores/runcomradeGame.svelte.js';
	import IconHelp from '~icons/lucide/circle-help';
	import IconPause from '~icons/lucide/pause';
	import IconPlay from '~icons/lucide/play';

	const game = new RunComradeGame({ reducedMotion: prefersReducedMotion() });
	const modeName = m.mode_runcomrade_name();

	// The how-to-play screen opens on the first visit and whenever the help button is tapped
	let showTutorial = $state(false);
	onMount(() => {
		game.loadBest();
		showTutorial = firstPlay('runcomrade');
	});

	function openHelp() {
		game.pause();
		showTutorial = true;
	}
</script>

<GameShell title={modeName} score={game.score} best={game.best}>
	{#snippet actions()}
		<button
			type="button"
			class="btn-chunky px-2 py-1 text-sm sm:px-3"
			aria-label={m.runcomrade_help_button()}
			onclick={openHelp}
		>
			<IconHelp class="size-4" aria-hidden="true" />
			<span class="hidden sm:inline">{m.runcomrade_help_button()}</span>
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
		style:max-width="max(17rem, min(100%, calc((100dvh - 14rem) * 0.643)))"
	>
		<div
			class="flex w-full items-center justify-between gap-3 rounded-[12px_6px_14px_8px] border-3 border-ink bg-paper px-3 py-1 shadow-[3px_3px_0_var(--color-ink)]"
		>
			<div class="flex min-h-8 flex-1 items-center gap-2">
				{#if game.boostLeft > 0}
					<span
						class="flex items-center gap-1 rounded-full border-2 border-ink bg-explosion-yellow px-1.5 py-0.5 font-display text-xs font-bold"
						title={m.runcomrade_status_boost()}
					>
						<RunComradeIcon kind="helmet" class="size-6" />
						<span class="sr-only">{m.runcomrade_status_boost()}</span>
						<span
							class="block h-2 w-10 overflow-hidden rounded-full border border-ink bg-paper"
							aria-hidden="true"
						>
							<span class="block h-full bg-tie-red" style:width="{game.boostLeft * 100}%"></span>
						</span>
					</span>
				{/if}
				{#if game.shield}
					<span
						class="flex items-center gap-1 rounded-full border-2 border-ink bg-paper px-1.5 py-0.5 font-display text-xs font-bold"
						title={m.runcomrade_status_shield()}
					>
						<RunComradeIcon kind="rice" class="size-6" />
						<span class="sr-only">{m.runcomrade_status_shield()}</span>
					</span>
				{/if}
				{#if game.boostLeft === 0 && !game.shield}
					<p dir="auto" class="font-display text-base leading-tight font-bold sm:text-lg">
						{m.runcomrade_hud_hint()}
					</p>
				{/if}
			</div>
			<LivesBar lives={game.lives} max={STARTING_LIVES} class="shrink-0 text-xl" />
		</div>

		<RunComradeCanvas {game} />
	</section>

	<TutorialModal
		open={showTutorial}
		title={m.runcomrade_tutorial_title()}
		closeLabel={m.runcomrade_tutorial_close()}
		onclose={() => (showTutorial = false)}
	>
		<p>{m.runcomrade_tutorial_goal()}</p>
		<p>{m.runcomrade_tutorial_controls()}</p>
		<p>{m.runcomrade_tutorial_obstacles()}</p>
		<ul class="flex flex-col gap-2">
			<li class="flex items-center gap-2">
				<RunComradeIcon kind="ditch" class="size-10 shrink-0" />
				<span><strong>{m.runcomrade_ditch_name()}</strong> {m.runcomrade_ditch_hint()}</span>
			</li>
			<li class="flex items-center gap-2">
				<RunComradeIcon kind="arm" class="size-10 shrink-0" />
				<span><strong>{m.runcomrade_arm_name()}</strong> {m.runcomrade_arm_hint()}</span>
			</li>
			<li class="flex items-center gap-2">
				<RunComradeIcon kind="mine" class="size-10 shrink-0" />
				<span><strong>{m.runcomrade_mine_name()}</strong> {m.runcomrade_mine_hint()}</span>
			</li>
		</ul>
		<p>{m.runcomrade_tutorial_drone()}</p>
		<ul class="flex flex-col gap-2">
			<li class="flex items-center gap-2">
				<RunComradeIcon kind="drone" class="size-10 shrink-0" />
				<span><strong>{m.runcomrade_drone_name()}</strong> {m.runcomrade_drone_hint()}</span>
			</li>
			<li class="flex items-center gap-2">
				<RunComradeIcon kind="sunflower" class="size-10 shrink-0" />
				<span><strong>{m.runcomrade_tall_name()}</strong> {m.runcomrade_tall_hint()}</span>
			</li>
		</ul>
		<p>{m.runcomrade_tutorial_pickups()}</p>
		<ul class="flex flex-col gap-2">
			<li class="flex items-center gap-2">
				<RunComradeIcon kind="helmet" class="size-10 shrink-0" />
				<span><strong>{m.runcomrade_helmet_name()}</strong> {m.runcomrade_helmet_hint()}</span>
			</li>
			<li class="flex items-center gap-2">
				<RunComradeIcon kind="rice" class="size-10 shrink-0" />
				<span><strong>{m.runcomrade_rice_name()}</strong> {m.runcomrade_rice_hint()}</span>
			</li>
		</ul>
		<p>{m.runcomrade_tutorial_field()}</p>
		<p class="hidden text-sm sm:block">{m.runcomrade_keyboard_hint()}</p>
	</TutorialModal>

	<GameOverModal
		open={game.status === 'over'}
		score={game.score}
		{modeName}
		isNewBest={game.isNewBest}
		title={m.runcomrade_gameover_title()}
		drawBoard={game.drawBoard}
		onRetry={() => game.start()}
	>
		<dl class="grid grid-cols-2 gap-2 font-display text-sm">
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="font-bold">{m.runcomrade_stat_distance()}</dt>
				<dd class="text-2xl font-bold tabular-nums">
					{m.runcomrade_distance_value({ distance: game.distance })}
				</dd>
			</div>
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="font-bold">{m.runcomrade_stat_stumbles()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{game.stumbles}</dd>
			</div>
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="font-bold">{m.runcomrade_stat_helmets()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{game.helmets}</dd>
			</div>
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="font-bold">{m.runcomrade_stat_bowls()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{game.bowls}</dd>
			</div>
		</dl>
	</GameOverModal>
</GameShell>
