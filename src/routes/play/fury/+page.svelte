<script lang="ts">
	import { onMount } from 'svelte';
	import { m } from '$lib/paraglide/messages';
	import FuryCanvas from '$lib/components/FuryCanvas.svelte';
	import FuryLevelSelect from '$lib/components/FuryLevelSelect.svelte';
	import FuryWinPanel from '$lib/components/FuryWinPanel.svelte';
	import GameOverModal from '$lib/components/GameOverModal.svelte';
	import GameShell from '$lib/components/GameShell.svelte';
	import { drawScene, fitCamera } from '$lib/game/fury/furyRender';
	import { firstPlay } from '$lib/services/tutorial';
	import { FuryGame } from '$lib/stores/furyGame.svelte';
	import IconList from '~icons/lucide/list';
	import IconPause from '~icons/lucide/pause';
	import IconPlay from '~icons/lucide/play';
	import IconRotate from '~icons/lucide/rotate-ccw';

	const game = new FuryGame();
	let showTutorial = $state(false);
	onMount(() => {
		game.load();
		showTutorial = firstPlay('fury');
	});

	const playing = $derived(game.screen === 'play');
	const title = $derived(
		playing
			? `${m.mode_fury_name()} · ${m.fury_level_label({ number: game.levelIndex + 1 })}`
			: m.mode_fury_name()
	);

	let resumeButton: HTMLButtonElement | undefined = $state();
	$effect(() => {
		if (game.paused) resumeButton?.focus();
	});

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

<GameShell {title} score={playing ? game.score : undefined} best={playing ? game.best : undefined}>
	{#snippet actions()}
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
		<div class="relative">
			<FuryCanvas {game} {showTutorial} />
			{#if game.paused}
				<div
					class="absolute inset-0 flex items-start justify-center bg-ink/30 pt-10"
					role="dialog"
					aria-modal="true"
					aria-labelledby="fury-paused-title"
				>
					<div class="sticker flex flex-col items-center gap-3 p-5" style:--tilt="-1.5deg">
						<h2 id="fury-paused-title" class="text-2xl font-bold">{m.game_paused()}</h2>
						<button
							bind:this={resumeButton}
							type="button"
							class="btn-chunky min-w-44 bg-khaki"
							onclick={() => game.setPaused(false)}
						>
							<IconPlay class="size-5" aria-hidden="true" />
							{m.game_resume()}
						</button>
						<button type="button" class="btn-chunky min-w-44" onclick={() => game.retry()}>
							<IconRotate class="size-5" aria-hidden="true" />
							{m.fury_restart()}
						</button>
						<button type="button" class="btn-chunky min-w-44" onclick={() => game.backToSelect()}>
							<IconList class="size-5" aria-hidden="true" />
							{m.fury_back_to_levels()}
						</button>
						<label class="flex min-h-11 items-center gap-2 font-semibold">
							<input
								type="checkbox"
								class="checkbox border-3 border-ink"
								checked={game.settings.longPreview}
								onchange={(event) => game.setLongPreview(event.currentTarget.checked)}
							/>
							{m.fury_long_preview()}
						</label>
					</div>
				</div>
			{/if}
		</div>
	{:else}
		<FuryLevelSelect {game} />
	{/if}
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
