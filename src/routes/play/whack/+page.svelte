<script lang="ts">
	import { onMount } from 'svelte';
	import GameOverModal from '#lib/components/GameOverModal.svelte';
	import GameShell from '#lib/components/GameShell.svelte';
	import LivesBar from '#lib/components/LivesBar.svelte';
	import TutorialModal from '#lib/components/TutorialModal.svelte';
	import WhackCanvas from '#lib/components/WhackCanvas.svelte';
	import WhackIcon from '#lib/components/WhackIcon.svelte';
	import { prefersReducedMotion } from '#lib/game/loop.js';
	import { STARTING_LIVES } from '#lib/game/whack/config.js';
	import { m } from '#lib/paraglide/messages.js';
	import { firstPlay } from '#lib/services/tutorial.js';
	import { WhackGame } from '#lib/stores/whackGame.svelte.js';
	import IconHelp from '~icons/lucide/circle-help';
	import IconPause from '~icons/lucide/pause';
	import IconPlay from '~icons/lucide/play';
	import IconHome from '~icons/lucide/house';

	const game = new WhackGame({ reducedMotion: prefersReducedMotion() });
	const modeName = m.mode_whack_name();

	// The how-to-play screen opens on the first visit and whenever the help button is tapped
	let showTutorial = $state(false);
	onMount(() => {
		game.loadBest();
		showTutorial = firstPlay('whack');
	});
</script>

<GameShell title={modeName} score={game.score} best={game.best}>
	{#snippet actions()}
		<button
			type="button"
			class="btn-chunky px-2 py-1 text-sm sm:px-3"
			aria-label={m.whack_help_button()}
			onclick={() => (showTutorial = true)}
		>
			<IconHelp class="size-4" aria-hidden="true" />
			<span class="hidden sm:inline">{m.whack_help_button()}</span>
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
		style:max-width="max(17rem, min(100%, calc((100dvh - 14rem) * 0.706)))"
	>
		<div
			class="flex w-full items-center justify-between gap-3 rounded-[12px_6px_14px_8px] border-3 border-ink bg-paper px-3 py-1 shadow-[3px_3px_0_var(--color-ink)]"
		>
			<p
				dir="auto"
				class="min-h-8 flex-1 font-display text-base leading-tight font-bold sm:text-lg"
				aria-live="off"
			>
				{m.whack_hud_hint()}
			</p>
			<LivesBar lives={game.lives} max={STARTING_LIVES} class="shrink-0 text-xl" />
		</div>

		<WhackCanvas {game} />
	</section>

	<TutorialModal
		open={showTutorial}
		title={m.whack_tutorial_title()}
		closeLabel={m.whack_tutorial_close()}
		onclose={() => (showTutorial = false)}
	>
		<p>{m.whack_tutorial_goal()}</p>
		<ul class="flex flex-col gap-2">
			<li class="flex items-center gap-2">
				<WhackIcon kind="spokesperson" class="size-10 shrink-0" />
				<span><strong>{m.whack_spokesperson_name()}</strong></span>
			</li>
			<li class="flex items-center gap-2">
				<WhackIcon kind="official" class="size-10 shrink-0" />
				<span><strong>{m.whack_official_name()}</strong></span>
			</li>
			<li class="flex items-center gap-2">
				<WhackIcon kind="talkinghead" class="size-10 shrink-0" />
				<span><strong>{m.whack_talkinghead_name()}</strong></span>
			</li>
		</ul>
		<p>{m.whack_tutorial_statement()}</p>
		<p>{m.whack_tutorial_decoys()}</p>
		<ul class="flex flex-col gap-2">
			<li class="flex items-center gap-2">
				<WhackIcon kind="journalist" class="size-10 shrink-0" />
				<span><strong>{m.whack_journalist_name()}</strong></span>
			</li>
			<li class="flex items-center gap-2">
				<WhackIcon kind="aidworker" class="size-10 shrink-0" />
				<span><strong>{m.whack_aidworker_name()}</strong></span>
			</li>
		</ul>
		<p>{m.whack_tutorial_combo()}</p>
		<p>{m.whack_tutorial_boards()}</p>
		<p class="hidden text-sm sm:block">{m.whack_keyboard_hint()}</p>
	</TutorialModal>

	<GameOverModal
		open={game.status === 'over'}
		score={game.score}
		{modeName}
		isNewBest={game.isNewBest}
		title={m.whack_gameover_title()}
		drawBoard={game.drawBoard}
		onRetry={() => game.start()}
	>
		<dl class="grid grid-cols-2 gap-2 font-display text-sm">
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="font-bold">{m.whack_stat_hits()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{game.hits}</dd>
			</div>
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="font-bold">{m.whack_stat_escaped()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{game.escaped}</dd>
			</div>
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="font-bold">{m.whack_stat_decoys()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{game.decoysHit}</dd>
			</div>
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="font-bold">{m.whack_stat_streak()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{game.bestStreak}</dd>
			</div>
		</dl>
		<button
			type="button"
			class="btn-chunky mx-auto mt-2 px-3 py-1 text-sm"
			onclick={() => game.backToStart()}
		>
			<IconHome class="size-4" aria-hidden="true" />
			{m.whack_change_board()}
		</button>
	</GameOverModal>
</GameShell>
