<!--
	Border Shift (improvements 5.1): one night on Poland's eastern border. Convoys wait at the
	barrier, the radio calls the queue an invasion, and not all of them are what they claim. The
	player checks the papers or takes a photo, then waves the convoy through or turns it back. The
	radio is not after a battle, it wants Europe to doubt itself: a psy-op waved through is its big
	win, a family turned away feeds the same story, and both empty the reputation and push the
	destabilisation meter up. The result sheet is the morning press conference.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import BorderShiftField from '#lib/components/BorderShiftField.svelte';
	import GameOverModal from '#lib/components/GameOverModal.svelte';
	import GameShell from '#lib/components/GameShell.svelte';
	import LivesBar from '#lib/components/LivesBar.svelte';
	import TutorialModal from '#lib/components/TutorialModal.svelte';
	import { STARTING_REPUTATION } from '#lib/game/bordershift/config.js';
	import { prefersReducedMotion } from '#lib/game/loop.js';
	import { m } from '#lib/paraglide/messages.js';
	import { firstPlay } from '#lib/services/tutorial.js';
	import { BorderShiftGame } from '#lib/stores/bordershiftGame.svelte.js';
	import IconHelp from '~icons/lucide/circle-help';
	import IconPause from '~icons/lucide/pause';
	import IconPlay from '~icons/lucide/play';

	const game = new BorderShiftGame({ reducedMotion: prefersReducedMotion() });
	const modeName = m.mode_bordershift_name();

	// The how-to-play screen opens on the first visit and whenever the help button is tapped
	let showTutorial = $state(false);
	onMount(() => {
		game.loadBest();
		showTutorial = firstPlay('bordershift');
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
			aria-label={m.bordershift_help_button()}
			onclick={openHelp}
		>
			<IconHelp class="size-4" aria-hidden="true" />
			<span class="hidden sm:inline">{m.bordershift_help_button()}</span>
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

	<section class="mx-auto flex w-full max-w-xl flex-1 flex-col items-center gap-2">
		<div
			class="flex w-full flex-col gap-2 rounded-[12px_6px_14px_8px] border-3 border-ink bg-paper px-3 py-2 shadow-[3px_3px_0_var(--color-ink)]"
		>
			<div class="flex w-full items-center justify-between gap-2">
				<LivesBar lives={game.reputation} max={STARTING_REPUTATION} class="shrink-0 text-xl" />
				<p dir="auto" class="font-display text-sm font-bold tabular-nums sm:text-base">
					{m.bordershift_hud_convoy({ count: game.convoyNumber })}
				</p>
				<p dir="auto" class="font-display text-sm font-bold tabular-nums sm:text-base">
					{m.bordershift_hud_wave({ wave: game.wave })}
				</p>
				<p dir="auto" class="font-display text-sm font-bold tabular-nums sm:text-base">
					{m.bordershift_hud_streak({ count: game.streak })}
				</p>
			</div>
			<div
				class="flex items-center gap-2"
				role="progressbar"
				aria-label={m.bordershift_aria_destabilisation()}
				aria-valuemin={0}
				aria-valuemax={100}
				aria-valuenow={Math.round(game.destabilisation * 100)}
			>
				<p dir="auto" class="shrink-0 font-display text-xs font-bold tabular-nums sm:text-sm">
					{m.bordershift_hud_destabilisation({ value: Math.round(game.destabilisation * 100) })}
				</p>
				<div class="h-2.5 w-full overflow-hidden rounded-full border-2 border-ink bg-sand">
					<div
						class="h-full bg-tie-red transition-[width] duration-300"
						style:width="{game.destabilisation * 100}%"
					></div>
				</div>
			</div>
		</div>

		<BorderShiftField {game} />
	</section>

	<TutorialModal
		open={showTutorial}
		title={m.bordershift_tutorial_title()}
		closeLabel={m.bordershift_tutorial_close()}
		onclose={() => (showTutorial = false)}
	>
		<p>{m.bordershift_tutorial_goal()}</p>
		<p>{m.bordershift_tutorial_destabilisation()}</p>
		<p>{m.bordershift_tutorial_tools()}</p>
		<p>{m.bordershift_tutorial_patience()}</p>
		<p>{m.bordershift_tutorial_waves()}</p>
		<p>{m.bordershift_tutorial_keys()}</p>
	</TutorialModal>

	<GameOverModal
		open={game.status === 'over'}
		score={game.score}
		mode="bordershift"
		{modeName}
		isNewBest={game.isNewBest}
		title={game.outcome === 'destabilised'
			? m.bordershift_gameover_destabilised()
			: m.bordershift_gameover_title()}
		drawBoard={game.drawBoard}
		onRetry={() => game.start()}
	>
		<dl class="grid grid-cols-2 gap-2 font-display text-sm">
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="font-bold">{m.bordershift_stat_admitted()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{game.stats.admitted}</dd>
			</div>
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="font-bold">{m.bordershift_stat_caught()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{game.stats.caught}</dd>
			</div>
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="font-bold">{m.bordershift_stat_turned_away()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{game.stats.turnedAway}</dd>
			</div>
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="font-bold">{m.bordershift_stat_slipped()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{game.stats.slipped}</dd>
			</div>
		</dl>
	</GameOverModal>
</GameShell>
