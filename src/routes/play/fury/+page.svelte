<script lang="ts">
	import { onMount } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import FuryCanvas, { birdHint, birdName } from '#lib/components/FuryCanvas.svelte';
	import FuryLevelSelect from '#lib/components/FuryLevelSelect.svelte';
	import FuryWinPanel from '#lib/components/FuryWinPanel.svelte';
	import GameOverModal from '#lib/components/GameOverModal.svelte';
	import GameShell from '#lib/components/GameShell.svelte';
	import PauseOverlay from '#lib/components/PauseOverlay.svelte';
	import RotateHint from '#lib/components/RotateHint.svelte';
	import TutorialModal from '#lib/components/TutorialModal.svelte';
	import { furySpriteSrc } from '#lib/game/fury/assets.js';
	import { BIRD_KINDS } from '#lib/game/fury/birds.js';
	import { drawScene, fitCamera } from '#lib/game/fury/furyRender.js';
	import { firstPlay } from '#lib/services/tutorial.js';
	import { FuryGame } from '#lib/stores/furyGame.svelte.js';
	import IconHelp from '~icons/lucide/circle-help';
	import IconList from '~icons/lucide/list';
	import IconPause from '~icons/lucide/pause';
	import IconPlay from '~icons/lucide/play';
	import IconRotate from '~icons/lucide/rotate-ccw';

	const game = new FuryGame();
	// The how-to-play screen opens on the first visit and whenever the help button is tapped
	let showTutorial = $state(false);
	onMount(() => {
		game.load();
		showTutorial = firstPlay('fury');
	});

	function openHelp() {
		if (game.screen === 'play') game.setPaused(true);
		showTutorial = true;
	}

	const playing = $derived(game.screen === 'play');
	const title = $derived(
		playing
			? `${m.mode_fury_name()} · ${m.fury_level_label({ number: game.levelIndex + 1 })}`
			: m.mode_fury_name()
	);

	/** Draws the final field into the share card */
	function drawBoard(context: CanvasRenderingContext2D, x: number, y: number, size: number) {
		const match = game.match;
		if (!match) return;
		context.save();
		context.translate(x, y);
		drawScene(context, fitCamera(size, size, match.level.width), {
			world: match.world,
			birdOnSling: null,
			aim: null,
			preview: [],
			time: 0,
			reducedMotion: true,
			sprites: {},
			backdrop: game.backdrop
		});
		context.restore();
	}
</script>

<GameShell
	{title}
	score={playing ? game.score : undefined}
	best={playing ? game.best : undefined}
	confirmLeave={playing && !game.showWin && !game.showFail}
	immersive={playing}
	landscape
>
	{#snippet actions()}
		<button
			type="button"
			class="btn-chunky px-2 py-1 text-sm sm:px-3"
			aria-label={m.fury_help_button()}
			onclick={openHelp}
		>
			<IconHelp class="size-4" aria-hidden="true" />
			<span class="hidden sm:inline">{m.fury_help_button()}</span>
		</button>
		{#if playing}
			<button
				type="button"
				class="btn-chunky px-3 py-1 text-sm"
				onclick={() => game.setPaused(!game.paused)}
				aria-pressed={game.paused}
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
	{/snippet}

	{#if playing}
		<div class="relative flex min-h-0 flex-1 flex-col">
			<FuryCanvas {game} />
			<RotateHint onportrait={(upright) => upright && game.setPaused(true)} />
			{#if game.paused}
				<PauseOverlay hint="" onResume={() => game.setPaused(false)}>
					<button type="button" class="btn-chunky min-w-44" onclick={() => game.retry()}>
						<IconRotate class="size-5" aria-hidden="true" />
						{m.fury_restart()}
					</button>
					<button type="button" class="btn-chunky min-w-44" onclick={() => game.backToSelect()}>
						<IconList class="size-5" aria-hidden="true" />
						{m.fury_back_to_levels()}
					</button>
				</PauseOverlay>
			{/if}
		</div>
	{:else}
		<FuryLevelSelect {game} />
	{/if}

	<TutorialModal
		open={showTutorial}
		title={m.fury_tutorial_title()}
		closeLabel={m.fury_tutorial_close()}
		onclose={() => (showTutorial = false)}
	>
		<p>{m.fury_intro()}</p>
		<p>{m.fury_controls_hint()}</p>
		<p>{m.fury_tutorial_birds()}</p>
		<ul class="flex flex-col gap-2">
			{#each BIRD_KINDS as kind (kind)}
				{@const src = furySpriteSrc(kind)}
				<li class="flex items-center gap-3">
					{#if src}
						<img {src} alt="" class="size-12 shrink-0 object-contain" />
					{/if}
					<span><strong>{birdName(kind)}:</strong> {birdHint(kind)}</span>
				</li>
			{/each}
		</ul>
		<p class="hidden text-sm sm:block">{m.fury_keyboard_hint()}</p>
	</TutorialModal>
</GameShell>

<FuryWinPanel
	open={game.showWin}
	score={game.score}
	stars={game.stars}
	bonus={game.bonus}
	blocksDestroyed={game.blocksDestroyed}
	blocksTotal={game.blocksTotal}
	isNewBest={game.isNewBest}
	preparedCleared={game.preparedCleared}
	modeName={m.mode_fury_name()}
	{drawBoard}
	onNext={() => game.nextLevel()}
	onLevels={() => game.backToSelect()}
/>

<GameOverModal
	open={game.showFail}
	score={game.score}
	mode="fury"
	modeName={m.mode_fury_name()}
	isNewBest={false}
	title={m.fury_fail_title()}
	{drawBoard}
	onRetry={() => game.retry()}
>
	<div class="flex flex-col items-center gap-2">
		<p class="text-sm font-semibold">{m.fury_domes_left({ count: game.domesRemaining })}</p>
		<p class="text-sm font-semibold">
			{m.fury_blocks_destroyed({ count: game.blocksDestroyed, total: game.blocksTotal })}
		</p>
		<button type="button" class="btn-chunky" onclick={() => game.backToSelect()}>
			<IconList class="size-5" aria-hidden="true" />
			{m.fury_back_to_levels()}
		</button>
	</div>
</GameOverModal>
