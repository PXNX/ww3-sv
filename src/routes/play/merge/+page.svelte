<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import CharacterMascot from '#lib/components/CharacterMascot.svelte';
	import Confetti from '#lib/components/Confetti.svelte';
	import GameOverModal from '#lib/components/GameOverModal.svelte';
	import GameShell from '#lib/components/GameShell.svelte';
	import MergeGrid from '#lib/components/MergeGrid.svelte';
	import MergeShip from '#lib/components/MergeShip.svelte';
	import TutorialModal from '#lib/components/TutorialModal.svelte';
	import { MAX_SUBMARINES, MAX_TIER, type Direction } from '#lib/game/merge/mergeBoard.js';
	import { drawMergeBoard } from '#lib/game/merge/tierStyle.js';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { firstPlay } from '#lib/services/tutorial.js';
	import { MergeGame, noticeText, shipName } from '#lib/stores/mergeGame.svelte.js';
	import { CHARACTER_NAME } from '#lib/theme/character.js';
	import { spriteSrc } from '#lib/theme/sprites.js';
	import IconHelp from '~icons/lucide/circle-help';
	import IconRotate from '~icons/lucide/rotate-ccw';

	const game = new MergeGame();
	onDestroy(() => game.destroy());

	// The how-to-play screen opens on the first visit and whenever the help button is tapped
	let showTutorial = $state(false);
	onMount(() => {
		showTutorial = firstPlay('merge');
	});

	const characterName = $derived(CHARACTER_NAME[getLocale()]);
	const drawBoard = $derived(drawMergeBoard(game.state.board));

	// "New game" asks once more before throwing away a running game
	const CONFIRM_MS = 3000;
	let confirmingRestart = $state(false);
	let confirmTimer: ReturnType<typeof setTimeout> | undefined;
	onDestroy(() => clearTimeout(confirmTimer));

	function newGame() {
		clearTimeout(confirmTimer);
		if (confirmingRestart || game.state.moves === 0) {
			confirmingRestart = false;
			game.restart();
			return;
		}
		confirmingRestart = true;
		confirmTimer = setTimeout(() => (confirmingRestart = false), CONFIRM_MS);
	}

	const KEY_DIRECTIONS: Record<string, Direction> = {
		ArrowUp: 'up',
		ArrowDown: 'down',
		ArrowLeft: 'left',
		ArrowRight: 'right'
	};

	function onKeyDown(event: KeyboardEvent) {
		if (game.over || showTutorial || event.altKey || event.ctrlKey || event.metaKey) return;
		if (event.key === 'Escape') {
			game.cancelSubmarine();
			return;
		}
		const direction = KEY_DIRECTIONS[event.key];
		if (!direction) return;
		event.preventDefault();
		game.move(direction);
	}
</script>

<svelte:window onkeydown={onKeyDown} />

<GameShell title={m.mode_merge_name()} score={game.state.score} best={game.best}>
	{#snippet actions()}
		<button
			type="button"
			class="btn-chunky px-2 py-1 text-sm sm:px-3"
			aria-label={m.merge_help_button()}
			onclick={() => (showTutorial = true)}
		>
			<IconHelp class="size-4" aria-hidden="true" />
			<span class="hidden sm:inline">{m.merge_help_button()}</span>
		</button>
		<button
			type="button"
			class="btn-chunky px-3 py-1 text-sm"
			class:bg-explosion-yellow={confirmingRestart}
			onclick={newGame}
		>
			<IconRotate class="size-4" aria-hidden="true" />
			{confirmingRestart ? m.merge_new_game_confirm() : m.merge_new_game()}
		</button>
	{/snippet}

	<div class="mx-auto flex w-full max-w-md flex-col gap-3">
		<!-- The mascot reacts to the board and announces mines, combos and clears -->
		<div class="flex min-h-14 items-center gap-3">
			<CharacterMascot pose={game.mood} class="w-16 shrink-0 -rotate-3" />
			<div class="flex-1" role="status" aria-live="polite">
				{#key game.noticeKey}
					{#if game.notices.length > 0}
						<p
							class="sticker pop-in px-3 py-1.5 text-sm leading-snug font-bold"
							style:--tilt="1deg"
						>
							{game.notices.map(noticeText).join(' ')}
						</p>
					{/if}
				{/key}
			</div>
		</div>

		<div class="flex flex-wrap items-center justify-between gap-2">
			<span class="font-display text-sm font-bold">
				{m.merge_next_mine({ count: game.movesUntilMine })}
			</span>
			{#if game.state.submarines === 0}
				<span
					class="inline-flex items-center gap-2 rounded-md border-2 border-ink bg-sand px-2 py-1 text-sm font-bold opacity-80"
				>
					<img src={spriteSrc('submarine')} alt="" class="h-5 grayscale" />
					{m.merge_submarine_used()}
				</span>
			{:else if game.targeting}
				<button
					type="button"
					class="btn-chunky bg-explosion-yellow px-3 py-1 text-sm"
					aria-pressed="true"
					onclick={() => game.cancelSubmarine()}
				>
					<img src={spriteSrc('submarine')} alt="" class="h-5" />
					{m.merge_submarine_cancel()}
				</button>
			{:else}
				<button
					type="button"
					class="btn-chunky px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-60"
					class:bg-explosion-yellow={game.stuck && game.submarineReady}
					class:urgent={game.stuck && game.submarineReady}
					aria-pressed="false"
					disabled={!game.submarineReady}
					onclick={() => game.toggleSubmarine()}
				>
					<img src={spriteSrc('submarine')} alt="" class="h-5" />
					{m.merge_submarine_button()} × {game.state.submarines}
				</button>
			{/if}
		</div>
		<p class="-mt-2 min-h-5 text-end text-xs">
			{#if game.targeting}
				{m.merge_submarine_hint()}
			{:else if game.state.submarines > 0 && !game.submarineReady}
				{m.merge_submarine_no_mines()}
			{/if}
		</p>

		<div class="relative">
			<MergeGrid {game} />

			{#if game.celebrating}
				<div
					class="absolute inset-0 z-10 flex items-center justify-center overflow-hidden p-4"
					role="status"
				>
					<Confetti />
					<div
						class="sticker pop-in flex flex-col items-center gap-2 p-4 text-center"
						style:--tilt="-2deg"
					>
						<MergeShip tier={MAX_TIER} class="w-28" />
						<h2 class="text-2xl font-bold">{m.merge_mega_title()}</h2>
						<p class="leading-snug">{m.merge_mega_message({ characterName })}</p>
						<button
							type="button"
							class="btn-chunky bg-explosion-yellow"
							onclick={() => game.dismissCelebration()}
						>
							{m.merge_mega_continue()}
						</button>
					</div>
				</div>
			{/if}
		</div>

		<div class="flex flex-col gap-1 text-sm leading-snug">
			{#if game.bestTier}
				<p class="font-bold">{m.merge_best_ship({ ship: shipName(game.bestTier) })}</p>
			{/if}
		</div>
	</div>
</GameShell>

<TutorialModal
	open={showTutorial}
	title={m.merge_tutorial_title()}
	closeLabel={m.merge_tutorial_close()}
	onclose={() => (showTutorial = false)}
>
	<p>{m.merge_instructions()}</p>
	<p>{m.merge_mine_rule({ characterName })}</p>
	<p>{m.merge_tutorial_submarine({ max: MAX_SUBMARINES })}</p>
</TutorialModal>

<GameOverModal
	open={game.over}
	score={game.state.score}
	modeName={m.mode_merge_name()}
	isNewBest={game.isNewBest}
	title={m.merge_gameover_title()}
	{drawBoard}
	onRetry={() => game.restart()}
>
	<dl class="grid grid-cols-3 gap-2 text-sm">
		<div class="flex flex-col items-center gap-1 rounded-md border-2 border-ink bg-sand p-2">
			<dt class="font-bold">{m.merge_stat_biggest_ship()}</dt>
			<dd class="flex flex-col items-center leading-tight">
				<MergeShip tier={Math.max(game.state.highestTier, 1)} class="w-10" />
				{shipName(game.state.highestTier)}
			</dd>
		</div>
		<div class="flex flex-col items-center gap-1 rounded-md border-2 border-ink bg-sand p-2">
			<dt class="font-bold">{m.merge_stat_moves()}</dt>
			<dd class="font-display text-2xl font-bold">{game.state.moves}</dd>
		</div>
		<div class="flex flex-col items-center gap-1 rounded-md border-2 border-ink bg-sand p-2">
			<dt class="font-bold">{m.merge_stat_mines_cleared()}</dt>
			<dd class="font-display text-2xl font-bold">{game.state.minesDestroyed}</dd>
		</div>
	</dl>
</GameOverModal>

<style>
	.urgent {
		animation: nudge 800ms ease-in-out infinite;
	}

	@keyframes nudge {
		50% {
			rotate: -4deg;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.urgent {
			animation: none;
		}
	}
</style>
