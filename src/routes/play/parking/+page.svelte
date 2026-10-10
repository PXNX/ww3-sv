<!--
	Tanker Parking (roadmap 3.2): a sliding block puzzle. Drag ships along their axis to clear a
	lane and ease the tanker out of the harbor. There are no lives: the move counter and a star
	rating against the solver's par decide how well a level went.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import GameShell from '#lib/components/GameShell.svelte';
	import ParkingBoard from '#lib/components/ParkingBoard.svelte';
	import ParkingLevelSelect from '#lib/components/ParkingLevelSelect.svelte';
	import ParkingStars from '#lib/components/ParkingStars.svelte';
	import ParkingWinPanel from '#lib/components/ParkingWinPanel.svelte';
	import TutorialModal from '#lib/components/TutorialModal.svelte';
	import { TANKER_INDEX } from '#lib/game/parking/board.js';
	import { prefersReducedMotion } from '#lib/game/loop.js';
	import { m } from '#lib/paraglide/messages.js';
	import { firstPlay } from '#lib/services/tutorial.js';
	import { ParkingGame } from '#lib/stores/parkingGame.svelte.js';
	import IconHelp from '~icons/lucide/circle-help';
	import IconList from '~icons/lucide/list';
	import IconRotate from '~icons/lucide/rotate-ccw';
	import IconUndo from '~icons/lucide/undo-2';

	const game = new ParkingGame();
	const reducedMotion = prefersReducedMotion();
	const modeName = m.mode_parking_name();

	// The how-to-play screen opens on the first visit and whenever the help button is tapped
	let showTutorial = $state(false);
	onMount(() => {
		game.load();
		showTutorial = firstPlay('parking');
	});

	// The win panel waits until the tanker has sailed out
	let showWin = $state(false);
	$effect(() => {
		if (!game.won) {
			showWin = false;
			return;
		}
		const timer = setTimeout(() => (showWin = true), reducedMotion ? 200 : 800);
		return () => clearTimeout(timer);
	});

	const playing = $derived(game.screen === 'play');
	const title = $derived(
		playing ? `${modeName} · ${m.parking_level_label({ number: game.levelIndex + 1 })}` : modeName
	);
	const tierName = $derived(
		{
			easy: m.parking_tier_easy(),
			medium: m.parking_tier_medium(),
			hard: m.parking_tier_hard()
		}[game.level.tier]
	);

	/** Draws the solved harbor into the share card */
	function drawBoard(context: CanvasRenderingContext2D, x: number, y: number, size: number) {
		const { width, height, pieces, rocks } = game.puzzle;
		const cell = size / Math.max(width, height);
		const left = x + (size - cell * width) / 2;
		const top = y + (size - cell * height) / 2;
		context.fillStyle = '#4fa8d8';
		context.fillRect(left, top, cell * width, cell * height);
		context.lineWidth = 4;
		context.strokeStyle = '#111111';
		context.strokeRect(left, top, cell * width, cell * height);
		for (const [row, col] of rocks) {
			context.fillStyle = '#6a7c9b';
			context.fillRect(left + col * cell + 4, top + row * cell + 4, cell - 8, cell - 8);
		}
		const tones = ['#4a78c8', '#a8a45a', '#ddb93c', '#6a7c9b', '#d9a98a'];
		pieces.forEach((piece, index) => {
			const at = index === TANKER_INDEX ? width - piece.length : game.positions[index];
			const pieceX = left + (piece.axis === 'h' ? at : piece.line) * cell + 5;
			const pieceY = top + (piece.axis === 'h' ? piece.line : at) * cell + 5;
			const pieceW = (piece.axis === 'h' ? piece.length : 1) * cell - 10;
			const pieceH = (piece.axis === 'h' ? 1 : piece.length) * cell - 10;
			context.fillStyle = piece.isTanker ? '#e5484d' : tones[index % tones.length];
			context.fillRect(pieceX, pieceY, pieceW, pieceH);
			context.strokeRect(pieceX, pieceY, pieceW, pieceH);
		});
	}
</script>

<GameShell {title} confirmLeave={playing && !showWin}>
	{#snippet actions()}
		<button
			type="button"
			class="btn-chunky px-2 py-1 text-sm sm:px-3"
			aria-label={m.parking_help_button()}
			onclick={() => (showTutorial = true)}
		>
			<IconHelp class="size-4" aria-hidden="true" />
			<span class="hidden sm:inline">{m.parking_help_button()}</span>
		</button>
	{/snippet}

	{#if playing}
		<!-- The HUD, the harbor and the buttons share one width, as wide as the height allows -->
		<section
			class="mx-auto flex w-full flex-col items-center gap-2"
			style:max-width="max(16rem, min(100%, calc((100dvh - 17rem) * {game.puzzle.width /
				game.puzzle.height} + 1.75rem)))"
		>
			<div
				class="flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-[12px_6px_14px_8px] border-3 border-ink bg-paper px-3 py-1.5 shadow-[3px_3px_0_var(--color-ink)]"
			>
				<p class="text-sm font-bold">
					<span class="block text-xs tracking-wide uppercase">{tierName}</span>
					<span class="sr-only">{m.parking_level_label({ number: game.levelIndex + 1 })}</span>
				</p>
				<p role="status" class="flex items-baseline gap-3 font-display font-bold tabular-nums">
					<span class="text-2xl leading-none">{m.parking_moves_count({ moves: game.moves })}</span>
					<span class="text-sm">{m.parking_par_count({ par: game.par })}</span>
					{#if game.best !== null}
						<span class="text-sm">{m.parking_level_best({ moves: game.best })}</span>
					{/if}
				</p>
				<ParkingStars stars={game.won ? game.stars : game.currentStars} class="size-5" />
			</div>

			<ParkingBoard {game} {reducedMotion} />

			<div class="flex flex-wrap items-center justify-center gap-2">
				<button
					type="button"
					class="btn-chunky px-3 py-1 text-sm"
					disabled={game.moves === 0 || game.won}
					onclick={() => game.undo()}
				>
					<IconUndo class="size-4" aria-hidden="true" />
					{m.parking_undo()}
				</button>
				<button
					type="button"
					class="btn-chunky px-3 py-1 text-sm"
					disabled={game.isAtStart && game.moves === 0}
					onclick={() => game.retry()}
				>
					<IconRotate class="size-4" aria-hidden="true" />
					{m.parking_restart()}
				</button>
				<button
					type="button"
					class="btn-chunky px-3 py-1 text-sm"
					onclick={() => game.backToSelect()}
				>
					<IconList class="size-4" aria-hidden="true" />
					{m.parking_back_to_levels()}
				</button>
			</div>
		</section>
	{:else}
		<ParkingLevelSelect {game} />
	{/if}

	<TutorialModal
		open={showTutorial}
		title={m.parking_tutorial_title()}
		closeLabel={m.parking_tutorial_close()}
		onclose={() => (showTutorial = false)}
	>
		<p>{m.parking_tutorial_goal()}</p>
		<p>{m.parking_tutorial_drag()}</p>
		<p>{m.parking_tutorial_stars()}</p>
		<p class="hidden text-sm sm:block">{m.parking_keyboard_hint()}</p>
	</TutorialModal>
</GameShell>

<ParkingWinPanel
	open={showWin}
	stars={game.stars}
	moves={game.moves}
	par={game.par}
	best={game.best}
	isNewBest={game.isNewBest}
	hasNext={game.hasNext}
	totalStars={game.totalStars}
	{modeName}
	{drawBoard}
	onNext={() => game.nextLevel()}
	onRetry={() => game.retry()}
	onLevels={() => game.backToSelect()}
/>
