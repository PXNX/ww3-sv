<!--
	Leak Patrol: the West Wing pipes are leaking, and every leak is a leak. Hold fingers on the
	droplets to plug them (three count at once), pick up Sharpies, tape and CLASSIFIED folders, and
	say no to the group chat before a burst opens. A room that fills up costs a heart; every news
	cycle is wetter than the last. Score: seconds survived times leaks plugged.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import GameOverModal from '#lib/components/GameOverModal.svelte';
	import GameShell from '#lib/components/GameShell.svelte';
	import LeakPatrolField from '#lib/components/LeakPatrolField.svelte';
	import LivesBar from '#lib/components/LivesBar.svelte';
	import InteractiveTutorial from '#lib/components/InteractiveTutorial.svelte';
	import { STARTING_LIVES } from '#lib/game/leakpatrol/config.js';
	import { prefersReducedMotion } from '#lib/game/loop.js';
	import { m } from '#lib/paraglide/messages.js';
	import { firstPlay } from '#lib/services/tutorial.js';
	import { LeakPatrolGame } from '#lib/stores/leakpatrolGame.svelte.js';
	import IconHelp from '~icons/lucide/circle-help';
	import IconPause from '~icons/lucide/pause';
	import IconPlay from '~icons/lucide/play';
	import { tutorialSteps } from './tutorial.js';

	const game = new LeakPatrolGame({ reducedMotion: prefersReducedMotion() });
	const modeName = m.mode_leakpatrol_name();

	// The how-to-play screen opens on the first visit and whenever the help button is tapped
	let showTutorial = $state(false);
	onMount(() => {
		game.loadBest();
		showTutorial = firstPlay('leakpatrol');
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
			aria-label={m.leakpatrol_help_button()}
			onclick={openHelp}
		>
			<IconHelp class="size-4" aria-hidden="true" />
			<span class="hidden sm:inline">{m.leakpatrol_help_button()}</span>
		</button>
		{#if game.status === 'playing' || game.status === 'paused'}
			<button
				type="button"
				class="btn-chunky px-2 py-1 text-sm sm:px-3"
				aria-label={game.status === 'paused' ? m.game_resume() : m.game_pause()}
				title={game.status === 'paused' ? m.game_resume() : m.game_pause()}
				onclick={() => game.togglePause()}
			>
				{#if game.status === 'paused'}
					<IconPlay class="size-4" aria-hidden="true" />
					<span class="hidden sm:inline">{m.game_resume()}</span>
				{:else}
					<IconPause class="size-4" aria-hidden="true" />
					<span class="hidden sm:inline">{m.game_pause()}</span>
				{/if}
			</button>
		{/if}
	{/snippet}

	<section
		data-tutorial="playfield"
		class="mx-auto flex w-full max-w-xl flex-col items-center gap-2"
	>
		<div
			class="flex w-full items-center justify-between gap-3 rounded-[12px_6px_14px_8px] border-3 border-ink bg-paper px-3 py-2 shadow-[3px_3px_0_var(--color-ink)]"
		>
			<div data-tutorial="hud-lives" class="shrink-0">
				<LivesBar lives={game.lives} max={STARTING_LIVES} class="text-xl" />
			</div>
			<p
				data-tutorial="hud-wave"
				dir="auto"
				class="font-display text-sm font-bold tabular-nums sm:text-base"
			>
				{m.leakpatrol_hud_wave({ wave: game.wave })}
			</p>
			<p
				data-tutorial="hud-time"
				dir="auto"
				class="font-display text-sm font-bold tabular-nums sm:text-base"
			>
				{m.leakpatrol_hud_time({ seconds: game.seconds })}
			</p>
			<p
				data-tutorial="hud-plugged"
				dir="auto"
				class="font-display text-sm font-bold tabular-nums sm:text-base"
			>
				{m.leakpatrol_hud_plugged({ count: game.plugged })}
			</p>
		</div>

		<LeakPatrolField {game} />
	</section>

	<InteractiveTutorial
		open={showTutorial}
		title={m.leakpatrol_tutorial_title()}
		steps={tutorialSteps()}
		closeLabel={m.leakpatrol_tutorial_close()}
		onclose={() => (showTutorial = false)}
	/>

	<GameOverModal
		open={game.status === 'over'}
		score={game.score}
		mode="leakpatrol"
		{modeName}
		isNewBest={game.isNewBest}
		title={m.leakpatrol_gameover_title()}
		drawBoard={game.drawBoard}
		onRetry={() => game.start()}
	>
		<dl class="grid grid-cols-3 gap-2 font-display text-sm">
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="font-bold">{m.leakpatrol_stat_seconds()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{game.seconds}</dd>
			</div>
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="font-bold">{m.leakpatrol_stat_plugged()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{game.plugged}</dd>
			</div>
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="font-bold">{m.leakpatrol_stat_chats()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{game.dismissed}</dd>
			</div>
		</dl>
	</GameOverModal>
</GameShell>
