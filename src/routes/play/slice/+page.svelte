<script lang="ts">
	import { onMount } from 'svelte';
	import GameOverModal from '#lib/components/GameOverModal.svelte';
	import GameShell from '#lib/components/GameShell.svelte';
	import LivesBar from '#lib/components/LivesBar.svelte';
	import MazeStars from '#lib/components/MazeStars.svelte';
	import SliceCanvas from '#lib/components/SliceCanvas.svelte';
	import SliceIcon from '#lib/components/SliceIcon.svelte';
	import TutorialModal from '#lib/components/TutorialModal.svelte';
	import { prefersReducedMotion } from '#lib/game/loop.js';
	import { STARTING_LIVES, WAVE_COUNT } from '#lib/game/slice/config.js';
	import { m } from '#lib/paraglide/messages.js';
	import { firstPlay } from '#lib/services/tutorial.js';
	import { SliceGame } from '#lib/stores/sliceGame.svelte.js';
	import IconHelp from '~icons/lucide/circle-help';
	import IconPause from '~icons/lucide/pause';
	import IconPlay from '~icons/lucide/play';

	const game = new SliceGame({ reducedMotion: prefersReducedMotion() });
	const modeName = m.mode_slice_name();

	// The how-to-play screen opens on the first visit and whenever the help button is tapped
	let showTutorial = $state(false);
	onMount(() => {
		game.loadBest();
		if (import.meta.env.DEV) Object.assign(window, { sliceGame: game });
		showTutorial = firstPlay('slice');
	});
</script>

<GameShell
	title={modeName}
	score={game.score}
	best={game.best}
	confirmLeave={game.status === 'playing' || game.status === 'paused'}
	onQuit={() => game.forfeit()}
>
	{#snippet actions()}
		<button
			type="button"
			class="btn-chunky px-2 py-1 text-sm sm:px-3"
			aria-label={m.slice_help_button()}
			onclick={() => (showTutorial = true)}
		>
			<IconHelp class="size-4" aria-hidden="true" />
			<span class="hidden sm:inline">{m.slice_help_button()}</span>
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
		style:max-width="max(17rem, min(100%, calc(100dvh - 8rem)))"
	>
		<div
			class="flex w-full items-center justify-between gap-3 rounded-[12px_6px_14px_8px] border-3 border-ink bg-paper px-3 py-1 shadow-[3px_3px_0_var(--color-ink)]"
		>
			<p
				dir="auto"
				class="min-h-8 flex-1 font-display text-base leading-tight font-bold sm:text-lg"
				aria-live="off"
			>
				{m.slice_hud_wave({ wave: game.wave, total: WAVE_COUNT })}
			</p>
			{#if game.focus > 0}
				<span
					class="h-3 w-12 shrink-0 overflow-hidden rounded-full border-2 border-ink bg-paper"
					role="img"
					aria-label={m.slice_hud_focus()}
				>
					<span class="block h-full bg-sky-500" style:width="{Math.round(game.focus * 100)}%"
					></span>
				</span>
			{/if}
			<LivesBar lives={game.lives} max={STARTING_LIVES} class="shrink-0 text-xl" />
			<span
				class="min-w-12 shrink-0 text-end font-display text-sm font-bold tabular-nums"
				title={m.slice_hud_streak()}
			>
				{game.streak}{game.multiplier > 1 ? ` x${game.multiplier}` : ''}
			</span>
		</div>

		<SliceCanvas {game} />
	</section>

	<TutorialModal
		open={showTutorial}
		title={m.slice_tutorial_title()}
		closeLabel={m.slice_tutorial_close()}
		onclose={() => (showTutorial = false)}
	>
		<p>{m.slice_tutorial_goal()}</p>
		<ul class="flex flex-col gap-2">
			<li class="flex items-center gap-2">
				<SliceIcon kind="zircon" class="size-10 shrink-0" />
				<span><strong>{m.slice_zircon_name()}</strong></span>
			</li>
			<li class="flex items-center gap-2">
				<SliceIcon kind="kinzhal" class="size-10 shrink-0" />
				<span><strong>{m.slice_kinzhal_name()}</strong></span>
			</li>
			<li class="flex items-center gap-2">
				<SliceIcon kind="geran" class="size-10 shrink-0" />
				<span><strong>{m.slice_geran_name()}</strong></span>
			</li>
			<li class="flex items-center gap-2">
				<SliceIcon kind="kalibr" class="size-10 shrink-0" />
				<span><strong>{m.slice_kalibr_name()}</strong></span>
			</li>
		</ul>
		<p>{m.slice_tutorial_miss()}</p>
		<ul class="flex flex-col gap-2">
			<li class="flex items-center gap-2">
				<SliceIcon kind="iskander" class="size-10 shrink-0" />
				<span><strong>{m.slice_iskander_name()}</strong>: {m.slice_tutorial_armor()}</span>
			</li>
			<li class="flex items-center gap-2">
				<SliceIcon kind="cluster" class="size-10 shrink-0" />
				<span><strong>{m.slice_cluster_name()}</strong>: {m.slice_tutorial_split()}</span>
			</li>
		</ul>
		<p>{m.slice_tutorial_decoys()}</p>
		<ul class="flex items-center gap-3">
			<li><SliceIcon kind="tanker" class="size-10" /></li>
			<li><SliceIcon kind="balloon" class="size-10" /></li>
			<li><SliceIcon kind="gull" class="size-10" /></li>
			<li><SliceIcon kind="mine" class="size-10" /></li>
		</ul>
		<p>{m.slice_tutorial_mine()}</p>
		<ul class="flex flex-col gap-2">
			<li class="flex items-center gap-2">
				<SliceIcon kind="focus" class="size-10 shrink-0" />
				<span><strong>{m.slice_focus_name()}</strong>: {m.slice_tutorial_focus()}</span>
			</li>
			<li class="flex items-center gap-2">
				<SliceIcon kind="repair" class="size-10 shrink-0" />
				<span><strong>{m.slice_repair_name()}</strong>: {m.slice_tutorial_repair()}</span>
			</li>
		</ul>
		<p>{m.slice_tutorial_combo()}</p>
		<p>{m.slice_tutorial_waves({ total: WAVE_COUNT })}</p>
		<p class="hidden text-sm sm:block">{m.slice_keyboard_hint()}</p>
	</TutorialModal>

	<GameOverModal
		open={game.status === 'over'}
		score={game.score}
		mode="slice"
		{modeName}
		isNewBest={game.isNewBest}
		outcome={game.won ? 'won' : 'lost'}
		title={game.won ? m.slice_victory_title() : m.slice_gameover_title()}
		drawBoard={game.drawBoard}
		onRetry={() => game.start()}
		onRevive={game.won ? undefined : () => game.revive()}
	>
		{#if game.won}
			<div class="mb-2 flex justify-center"><MazeStars stars={game.stars} class="size-10" /></div>
		{/if}
		<dl class="grid grid-cols-2 gap-2 font-display text-sm">
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="font-bold">{m.slice_stat_wave()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{game.wave}/{WAVE_COUNT}</dd>
			</div>
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="font-bold">{m.slice_stat_streak()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{game.bestStreak}</dd>
			</div>
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="font-bold">{m.slice_stat_sliced()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{game.sliced}</dd>
			</div>
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="font-bold">{m.slice_stat_missed()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{game.missed}</dd>
			</div>
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="font-bold">{m.slice_stat_decoys()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{game.decoysHit}</dd>
			</div>
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="font-bold">{m.slice_stat_combo()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{game.bestCombo}</dd>
			</div>
		</dl>
	</GameOverModal>
</GameShell>
