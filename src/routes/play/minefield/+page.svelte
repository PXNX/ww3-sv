<script lang="ts">
	import { onMount } from 'svelte';
	import FlagModeToggle from '#lib/components/FlagModeToggle.svelte';
	import GameOverModal from '#lib/components/GameOverModal.svelte';
	import GameShell from '#lib/components/GameShell.svelte';
	import MineGrid, { convoyDurationMs } from '#lib/components/MineGrid.svelte';
	import MinefieldDifficultyPicker, {
		DIFFICULTY_NAMES
	} from '#lib/components/MinefieldDifficultyPicker.svelte';
	import MinefieldScoreBreakdown from '#lib/components/MinefieldScoreBreakdown.svelte';
	import MinefieldVictory from '#lib/components/MinefieldVictory.svelte';
	import SubmarineTool from '#lib/components/SubmarineTool.svelte';
	import TankerQueue from '#lib/components/TankerQueue.svelte';
	import { onAppHidden, prefersReducedMotion } from '#lib/game/loop.js';
	import { TANKER_COUNT, type DifficultyId } from '#lib/game/minefield/difficulty.js';
	import { drawMinefieldBoard } from '#lib/game/minefield/drawBoard.js';
	import { formatTime } from '#lib/game/minefield/scoring.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { ScoreCard } from '#lib/services/share.js';
	import { firstPlay } from '#lib/services/tutorial.js';
	import { MinefieldGame } from '#lib/stores/minefieldGame.svelte.js';
	import { spriteSrc } from '#lib/theme/sprites.js';
	import IconArrowRight from '~icons/lucide/arrow-right';
	import IconPause from '~icons/lucide/pause';
	import IconPlay from '~icons/lucide/play';
	import IconSliders from '~icons/lucide/sliders-horizontal';
	import IconTimer from '~icons/lucide/timer';

	const game = new MinefieldGame();
	const reducedMotion = prefersReducedMotion();

	let picking = $state(true);
	let victoryOpen = $state(false);
	let gameOverOpen = $state(false);
	let showTutorial = $state(false);

	onMount(() => {
		showTutorial = firstPlay('minefield');
	});

	const modeName = $derived(
		`${m.mode_minefield_name()} (${DIFFICULTY_NAMES[game.difficultyId]()})`
	);
	const drawBoard: ScoreCard['drawBoard'] = (context, x, y, size) =>
		drawMinefieldBoard(game.board, game.channel, context, x, y, size);

	const status = $derived.by(() => {
		const event = game.event;
		if (event?.kind === 'explosion') return m.minefield_status_explosion();
		if (event?.kind === 'defused') return m.minefield_status_defused({ count: event.count });
		if (event?.kind === 'needs-water') return m.minefield_status_needs_water();
		if (game.isOver) return '';
		if (game.tool === 'submarine') return m.minefield_submarine_armed();
		if (game.tool === 'flag') return m.minefield_status_flag_mode();
		return game.phase === 'ready' ? m.minefield_status_start() : '';
	});

	// The timer only needs a few updates per second; Minefield is not a real-time game
	$effect(() => {
		const timer = setInterval(() => game.tick(), 250);
		return () => clearInterval(timer);
	});

	// Leaving the tab or window pauses the clock and hides the board
	$effect(() => onAppHidden(() => game.pause()));

	// End screens appear once the explosion or the convoy has had its moment
	$effect(() => {
		const phase = game.phase;
		if (phase !== 'won' && phase !== 'lost') {
			victoryOpen = false;
			gameOverOpen = false;
			return;
		}
		const delay =
			phase === 'won'
				? reducedMotion
					? 500
					: convoyDurationMs(game.channel?.length ?? 0, game.tankersLeft) + 300
				: reducedMotion
					? 300
					: 1100;
		const timer = setTimeout(() => {
			if (phase === 'won') victoryOpen = true;
			else gameOverOpen = true;
		}, delay);
		return () => clearTimeout(timer);
	});

	function pick(id: DifficultyId) {
		game.newGame(id);
		picking = false;
	}

	function playAgain() {
		victoryOpen = false;
		gameOverOpen = false;
		game.newGame();
	}

	function changeDifficulty() {
		victoryOpen = false;
		gameOverOpen = false;
		game.pause();
		picking = true;
	}
</script>

<GameShell
	title={m.mode_minefield_name()}
	score={picking ? undefined : game.score}
	best={picking ? undefined : game.bestScore}
>
	{#snippet actions()}
		{#if !picking}
			{#if game.phase === 'playing'}
				<button
					type="button"
					class="btn-chunky px-3 py-1 text-sm"
					onclick={() => (game.paused ? game.resume() : game.pause())}
				>
					{#if game.paused}
						<IconPlay class="size-4" aria-hidden="true" />
						{m.game_resume()}
					{:else}
						<IconPause class="size-4" aria-hidden="true" />
						{m.game_pause()}
					{/if}
				</button>
			{/if}
			<button type="button" class="btn-chunky px-3 py-1 text-sm" onclick={changeDifficulty}>
				<IconSliders class="size-4" aria-hidden="true" />
				{m.minefield_change_difficulty()}
			</button>
		{/if}
	{/snippet}

	{#if picking}
		<MinefieldDifficultyPicker selected={game.difficultyId} onpick={pick} />
	{:else}
		<div class="flex flex-wrap items-center gap-2 font-display font-bold">
			<span class="-rotate-1 rounded-md border-2 border-ink bg-khaki px-2 py-0.5">
				{m.minefield_current_difficulty({ level: DIFFICULTY_NAMES[game.difficultyId]() })}
			</span>
			<span
				class="flex items-center gap-1 rounded-md border-2 border-ink bg-paper px-2 py-0.5 tabular-nums"
			>
				<IconTimer class="size-4" aria-hidden="true" />
				<span class="sr-only">{m.minefield_time_label()}:</span>
				{formatTime(game.result ? game.result.seconds : game.elapsedMs / 1000)}
			</span>
			<span
				class="flex rotate-1 items-center gap-1 rounded-md border-2 border-ink bg-paper px-2 py-0.5 tabular-nums"
			>
				<img src={spriteSrc('mine')} alt="" class="size-4" />
				<span class="sr-only">{m.minefield_mines_left_label()}:</span>
				{game.minesLeft}
			</span>
		</div>

		<TankerQueue total={TANKER_COUNT} afloat={game.tankersLeft} />

		<div class="flex flex-col gap-1">
			<div data-playfield class="flex items-center justify-between px-1 text-sm font-bold">
				<span class="flex items-center gap-1">
					<IconArrowRight class="size-4" aria-hidden="true" />
					{m.minefield_west_label()}
				</span>
				<span class="flex items-center gap-1">
					{m.minefield_east_label()}
					<IconArrowRight class="size-4" aria-hidden="true" />
				</span>
			</div>
			<div data-playfield class="relative">
				<MineGrid
					board={game.board}
					phase={game.phase}
					tool={game.tool}
					channel={game.channel}
					explosionId={game.event?.kind === 'explosion' ? game.event.id : null}
					convoyTankers={game.tankersLeft}
					onactivate={(index) => game.activate(index)}
					onflag={(index) => game.flag(index)}
				/>
				{#if game.paused}
					<div
						class="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-[10px_6px_12px_8px] border-3 border-ink bg-banner-slate p-4 text-center text-paper"
					>
						<p class="font-display text-2xl font-bold">{m.game_paused()}</p>
						<p>{m.minefield_paused_hint()}</p>
						<button type="button" class="btn-chunky" onclick={() => game.resume()}>
							<IconPlay class="size-5" aria-hidden="true" />
							{m.game_resume()}
						</button>
					</div>
				{/if}
			</div>
		</div>

		<div class="flex gap-3">
			<FlagModeToggle
				active={game.tool === 'flag'}
				disabled={!game.canAct}
				ontoggle={() => game.toggleFlagMode()}
			/>
			<SubmarineTool
				armed={game.tool === 'submarine'}
				left={game.submarinesLeft}
				disabled={!game.canAct}
				ontoggle={() => game.toggleSubmarine()}
			/>
		</div>

		<p class="min-h-6 text-center font-semibold" role="status" aria-live="polite">{status}</p>
		{#if showTutorial}
			<p class="text-sm leading-snug opacity-80">{m.minefield_help()}</p>
		{/if}
	{/if}
</GameShell>

<GameOverModal
	open={gameOverOpen}
	score={game.score}
	{modeName}
	isNewBest={game.result?.isNewBestScore ?? false}
	title={m.minefield_loss_title()}
	{drawBoard}
	onRetry={playAgain}
>
	{#if game.result}
		<MinefieldScoreBreakdown score={game.result.score} />
	{/if}
</GameOverModal>

<MinefieldVictory
	open={victoryOpen}
	result={game.result}
	tankers={game.tankersLeft}
	{modeName}
	{drawBoard}
	onPlayAgain={playAgain}
	onChangeDifficulty={changeDifficulty}
/>
