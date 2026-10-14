<!--
	Suez Stuck (roadmap 3.12): the invented container ship "Ever Stuck" is wedged across a canal.
	Drag the bow and the stern to wiggle it free, call the tiny excavator on the banks, and clear the
	queue of waiting ships before too many of them give up (a heart each). Every canal is narrower.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import GameOverModal from '#lib/components/GameOverModal.svelte';
	import GameShell from '#lib/components/GameShell.svelte';
	import LivesBar from '#lib/components/LivesBar.svelte';
	import SuezCanvas from '#lib/components/SuezCanvas.svelte';
	import TutorialModal from '#lib/components/TutorialModal.svelte';
	import { prefersReducedMotion } from '#lib/game/loop.js';
	import { QUEUE_CAPACITY, STARTING_LIVES } from '#lib/game/suez/config.js';
	import { m } from '#lib/paraglide/messages.js';
	import { firstPlay } from '#lib/services/tutorial.js';
	import { SuezGame } from '#lib/stores/suezGame.svelte.js';
	import { cameoAsset } from '#lib/theme/cameos.js';
	import IconHelp from '~icons/lucide/circle-help';
	import IconPause from '~icons/lucide/pause';
	import IconPlay from '~icons/lucide/play';

	const game = new SuezGame({ reducedMotion: prefersReducedMotion() });
	const modeName = m.mode_suez_name();

	// The how-to-play screen opens on the first visit and whenever the help button is tapped
	let showTutorial = $state(false);
	onMount(() => {
		game.loadBest();
		showTutorial = firstPlay('suez');
	});

	function openHelp() {
		game.pause();
		showTutorial = true;
	}

	const cameo = $derived({
		image: cameoAsset('suez-captain.svg'),
		alt: m.suez_cameo_alt(),
		message: m.suez_cameo_message(),
		label: m.suez_cameo_label()
	});

	const crowded = $derived(game.waiting >= QUEUE_CAPACITY - 1);
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
			aria-label={m.suez_help_button()}
			onclick={openHelp}
		>
			<IconHelp class="size-4" aria-hidden="true" />
			<span class="hidden sm:inline">{m.suez_help_button()}</span>
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
		style:max-width="max(17rem, min(100%, calc((100dvh - 15rem) * 0.643)))"
	>
		<div
			class="flex w-full flex-col gap-1 rounded-[12px_6px_14px_8px] border-3 border-ink bg-paper px-3 py-1 shadow-[3px_3px_0_var(--color-ink)]"
		>
			<div class="flex items-center justify-between gap-3">
				<p dir="auto" class="font-display text-base font-bold tabular-nums sm:text-lg">
					{m.suez_hud_canal({ level: game.level })}
				</p>
				<p
					dir="auto"
					class="font-display text-sm font-bold tabular-nums"
					class:text-tie-red={crowded}
				>
					{m.suez_hud_queue({ waiting: game.waiting, max: QUEUE_CAPACITY })}
				</p>
				<LivesBar lives={game.lives} max={STARTING_LIVES} class="shrink-0 text-xl" />
			</div>
			<div class="flex items-center gap-3">
				<div
					class="h-3 flex-1 overflow-hidden rounded-full border-2 border-ink bg-sand"
					role="progressbar"
					aria-label={m.suez_stuck_label()}
					aria-valuemin={0}
					aria-valuemax={100}
					aria-valuenow={game.stuckPercent}
				>
					<div
						class="h-full bg-tie-red transition-[width]"
						style:width="{game.stuckPercent}%"
					></div>
				</div>
				<p dir="auto" class="w-28 shrink-0 text-end font-display text-xs font-bold tabular-nums">
					{m.suez_hud_stuck({ percent: game.stuckPercent })}
				</p>
			</div>
			<p dir="auto" class="font-display text-xs font-bold" aria-live="off">
				{game.excavatorWait > 0
					? m.suez_hud_excavator_wait({ seconds: game.excavatorWait })
					: m.suez_hud_excavator_ready()}
			</p>
		</div>

		<SuezCanvas {game} />
	</section>

	<TutorialModal
		open={showTutorial}
		title={m.suez_tutorial_title()}
		closeLabel={m.suez_tutorial_close()}
		onclose={() => (showTutorial = false)}
	>
		<p>{m.suez_tutorial_goal()}</p>
		<p>{m.suez_tutorial_drag()}</p>
		<p>{m.suez_tutorial_banks()}</p>
		<p>{m.suez_tutorial_excavator()}</p>
		<p>{m.suez_tutorial_queue()}</p>
		<p>{m.suez_tutorial_score()}</p>
	</TutorialModal>

	<GameOverModal
		open={game.status === 'over'}
		score={game.score}
		mode="suez"
		{modeName}
		isNewBest={game.isNewBest}
		title={m.suez_gameover_title()}
		customCameo={cameo}
		drawBoard={game.drawBoard}
		onRetry={() => game.start()}
	>
		<dl class="grid grid-cols-2 gap-2 font-display text-sm">
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="font-bold">{m.suez_stat_canals()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{game.canalsCleared}</dd>
			</div>
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="font-bold">{m.suez_stat_ships()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{game.shipsReleased}</dd>
			</div>
		</dl>
	</GameOverModal>
</GameShell>
