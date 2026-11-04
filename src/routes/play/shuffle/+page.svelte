<!--
	Shadow Fleet Shuffle: a shell game with ships. The sanctioned tanker is marked, cargo covers drop
	over the fleet and shuffle (swaps, crossings, rotations, repainted flags, AIS blackouts), and you
	pick the cover that hides it. Streaks multiply the score, a satellite ping gives a hint for half
	pay, and three wrong picks end the run.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import GameOverModal from '#lib/components/GameOverModal.svelte';
	import GameShell from '#lib/components/GameShell.svelte';
	import LivesBar from '#lib/components/LivesBar.svelte';
	import MazeStars from '#lib/components/MazeStars.svelte';
	import ShuffleBoard from '#lib/components/ShuffleBoard.svelte';
	import TutorialModal from '#lib/components/TutorialModal.svelte';
	import { prefersReducedMotion } from '#lib/game/loop.js';
	import { MAX_PINGS, STARTING_LIVES, TOTAL_ROUNDS } from '#lib/game/shuffle/config.js';
	import { m } from '#lib/paraglide/messages.js';
	import { firstPlay } from '#lib/services/tutorial.js';
	import { ShuffleGame } from '#lib/stores/shuffleGame.svelte.js';
	import IconHelp from '~icons/lucide/circle-help';
	import IconSatellite from '~icons/lucide/satellite-dish';

	const game = new ShuffleGame();
	const modeName = m.mode_shuffle_name();
	const reducedMotion = prefersReducedMotion();

	let showTutorial = $state(false);
	onMount(() => {
		game.loadBest();
		showTutorial = firstPlay('shuffle');
		if (!showTutorial) game.start();
	});

	function closeTutorial() {
		showTutorial = false;
		if (game.phase === 'idle') game.start();
	}

	const message = $derived.by(() => {
		switch (game.phase) {
			case 'reveal':
				return m.shuffle_phase_reveal();
			case 'cover':
				return m.shuffle_phase_cover();
			case 'shuffling':
				return m.shuffle_phase_shuffling();
			case 'guessing':
				return game.pinged ? m.shuffle_phase_pinged() : m.shuffle_phase_guessing();
			case 'correct':
				return m.shuffle_phase_correct({ gain: game.lastGain });
			case 'wrong':
				return m.shuffle_phase_wrong();
			default:
				return m.shuffle_phase_idle();
		}
	});

	const accuracy = $derived(
		game.correctPicks + game.wrongPicks === 0
			? 0
			: Math.round((100 * game.correctPicks) / (game.correctPicks + game.wrongPicks))
	);
	const rank = $derived(
		[m.shuffle_rank_0(), m.shuffle_rank_1(), m.shuffle_rank_2(), m.shuffle_rank_3()][game.stars]
	);

	function onKey(event: KeyboardEvent) {
		if (event.ctrlKey || event.metaKey || event.altKey || showTutorial) return;
		if (event.key === 'p' || event.key === 'P') game.ping();
		else if (/^[1-6]$/.test(event.key)) game.pickSlot(Number(event.key) - 1);
	}
</script>

<svelte:window onkeydown={onKey} />

<GameShell
	title={modeName}
	score={game.score}
	best={game.best}
	confirmLeave={game.running}
	onQuit={() => game.forfeit()}
>
	{#snippet actions()}
		<button
			type="button"
			class="btn-chunky px-2 py-1 text-sm sm:px-3"
			aria-label={m.shuffle_help_button()}
			disabled={game.phase !== 'guessing' && game.phase !== 'idle'}
			onclick={() => (showTutorial = true)}
		>
			<IconHelp class="size-4" aria-hidden="true" />
			<span class="hidden sm:inline">{m.shuffle_help_button()}</span>
		</button>
	{/snippet}

	<section class="mx-auto flex w-full max-w-3xl flex-col gap-3 p-3">
		<div
			class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-[12px_6px_14px_8px] border-3 border-ink bg-paper px-3 py-2 shadow-[3px_3px_0_var(--color-ink)]"
		>
			<p dir="auto" class="font-display text-base font-bold tabular-nums sm:text-lg">
				{m.shuffle_hud_round({ round: game.round, total: TOTAL_ROUNDS })}
			</p>
			<p
				dir="auto"
				class="font-display text-sm font-bold tabular-nums"
				class:text-tie-red={game.streak >= 2}
			>
				{m.shuffle_hud_streak({ streak: game.streak, multiplier: game.multiplier })}
			</p>
			<LivesBar lives={game.lives} max={STARTING_LIVES} class="text-xl" />
		</div>

		<ShuffleBoard
			{game}
			{reducedMotion}
			sanctioned={m.shuffle_stamp_sanctioned()}
			escaped={m.shuffle_stamp_escaped()}
			combo={(streak) => m.shuffle_combo({ streak })}
			aisOff={m.shuffle_ais_off()}
			slotLabel={(slot, total) => m.shuffle_slot_label({ slot, total })}
		/>

		<div class="flex items-center justify-between gap-3">
			<p dir="auto" class="min-w-0 flex-1 font-display text-lg font-bold" aria-live="polite">
				{message}
			</p>
			<button
				type="button"
				class="btn-chunky shrink-0 bg-explosion-yellow text-sm"
				disabled={game.phase !== 'guessing' || game.pinged || game.pings <= 0}
				onclick={() => game.ping()}
			>
				<IconSatellite class="size-4" aria-hidden="true" />
				{m.shuffle_ping_button({ count: game.pings, max: MAX_PINGS })}
			</button>
		</div>
	</section>

	<TutorialModal
		open={showTutorial}
		title={m.shuffle_tutorial_title()}
		closeLabel={m.shuffle_tutorial_close()}
		onclose={closeTutorial}
	>
		<p>{m.shuffle_tutorial_goal()}</p>
		<p>{m.shuffle_tutorial_tricks()}</p>
		<p>{m.shuffle_tutorial_ping()}</p>
		<p>{m.shuffle_tutorial_lives()}</p>
		<p>{m.shuffle_tutorial_score()}</p>
	</TutorialModal>

	<GameOverModal
		open={game.phase === 'over'}
		score={game.score}
		mode="shuffle"
		{modeName}
		outcome={game.won ? 'won' : 'lost'}
		isNewBest={game.isNewBest}
		title={game.won ? m.shuffle_gameover_won() : m.shuffle_gameover_lost()}
		onRetry={() => game.start()}
	>
		<div class="flex flex-col items-center gap-1">
			<MazeStars stars={game.stars} class="size-9" />
			<p dir="auto" class="text-center font-display text-sm font-bold">{rank}</p>
		</div>
		<dl class="grid grid-cols-3 gap-2 font-display text-sm">
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="text-center font-bold">{m.shuffle_stat_rounds()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{game.roundsCleared}</dd>
			</div>
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="text-center font-bold">{m.shuffle_stat_streak()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{game.bestStreak}</dd>
			</div>
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="text-center font-bold">{m.shuffle_stat_accuracy()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{accuracy}%</dd>
			</div>
		</dl>
	</GameOverModal>
</GameShell>
