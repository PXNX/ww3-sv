<script lang="ts">
	import { onMount } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import GameOverModal from '#lib/components/GameOverModal.svelte';
	import GameShell from '#lib/components/GameShell.svelte';
	import PipelineDifficultyPicker, {
		LEVEL_NAMES
	} from '#lib/components/PipelineDifficultyPicker.svelte';
	import PipelineGrid from '#lib/components/PipelineGrid.svelte';
	import PipelineWrench from '#lib/components/PipelineWrench.svelte';
	import { prefersReducedMotion } from '#lib/game/loop.js';
	import {
		TANKER_DEPART_MS,
		finalScore,
		shutdownSecondsLeft,
		streakMultiplier,
		type Difficulty
	} from '#lib/game/pipeline/pipelineStep.js';
	import { boardDrawer } from '#lib/game/pipeline/shareBoard.js';
	import { firstPlay } from '#lib/services/tutorial.js';
	import { PipelineGame } from '#lib/stores/pipelineGame.svelte.js';
	import { spriteSrc } from '#lib/theme/sprites.js';
	import IconPause from '~icons/lucide/pause';
	import IconPlay from '~icons/lucide/play';
	import IconRefresh from '~icons/lucide/refresh-cw';
	import IconSliders from '~icons/lucide/sliders-horizontal';
	import IconTimer from '~icons/lucide/timer';

	const game = new PipelineGame();
	let reducedMotion = $state(false);
	let showTutorial = $state(false);
	let picking = $state(true);

	onMount(() => {
		reducedMotion = prefersReducedMotion();
		showTutorial = firstPlay('pipeline');
		return game.mount();
	});

	const view = $derived(game.view);
	const config = $derived(view.config);
	const running = $derived(view.phase === 'running');
	const cut = $derived(running && !view.flow.reachesTerminal);
	const locked = $derived(game.paused || game.result !== null);
	// Rounded to tens during play so the header pops now and then instead of every barrel
	const shownScore = $derived(
		game.result ? game.result.score : Math.floor(finalScore(view) / 10) * 10
	);
	const multiplier = $derived(streakMultiplier(view.streak));
	const tankerPercent = $derived(Math.floor((view.tankerFill / config.tankerCapacity) * 100));
	const departing = $derived(view.tankerDepartMs > 0);
	const departProgress = $derived(1 - view.tankerDepartMs / TANKER_DEPART_MS);
	// Only needed for the share card; the board stops changing once the game is over
	const drawBoard = $derived(game.result ? boardDrawer(view.grid, view.flow) : undefined);

	function pick(level: Difficulty) {
		game.setDifficulty(level);
		picking = false;
	}

	function changeDifficulty() {
		game.pause();
		picking = true;
	}
</script>

<GameShell
	title={m.mode_pipeline_name()}
	score={picking ? undefined : shownScore}
	best={picking ? undefined : game.best}
>
	{#snippet actions()}
		{#if !picking}
			<button
				type="button"
				class="btn-chunky px-3 py-1 text-sm {game.handsFree ? 'bg-mustard' : ''}"
				aria-pressed={game.handsFree}
				aria-label={m.pipeline_repair_toggle()}
				onclick={() => (game.handsFree = !game.handsFree)}
			>
				<PipelineWrench standalone class="size-4" />
				<span class="hidden sm:inline">{m.pipeline_repair_toggle()}</span>
				<span
					class="rounded border-2 border-ink px-1 text-xs {game.handsFree
						? 'bg-ink text-paper'
						: ''}"
					aria-hidden="true"
				>
					{game.handsFree ? '✓' : '–'}
				</span>
			</button>
			{#if game.paused}
				<button type="button" class="btn-chunky px-3 py-1 text-sm" onclick={() => game.resume()}>
					<IconPlay class="size-4" aria-hidden="true" />
					{m.game_resume()}
				</button>
			{:else}
				<button
					type="button"
					class="btn-chunky px-3 py-1 text-sm"
					disabled={game.result !== null}
					onclick={() => game.pause()}
				>
					<IconPause class="size-4" aria-hidden="true" />
					{m.game_pause()}
				</button>
			{/if}
			<button
				type="button"
				class="btn-chunky px-2.5 py-1 text-sm"
				aria-label={m.pipeline_new_board()}
				onclick={() => game.newGame()}
			>
				<IconRefresh class="size-4" aria-hidden="true" />
				<span class="hidden md:inline">{m.pipeline_new_board()}</span>
			</button>
			<button
				type="button"
				class="btn-chunky px-2.5 py-1 text-sm"
				aria-label={m.pipeline_difficulty_label()}
				onclick={changeDifficulty}
			>
				<IconSliders class="size-4" aria-hidden="true" />
				<span class="hidden md:inline">{m.pipeline_difficulty_label()}</span>
			</button>
		{/if}
	{/snippet}

	{#if picking}
		<PipelineDifficultyPicker selected={game.difficulty} onpick={pick} />
	{:else}
		<!-- One slim status bar: interceptor charges, the tanker filling up, and the streak bonus -->
		<div
			class="flex items-center gap-3 rounded-[12px_6px_14px_8px] border-3 border-ink bg-paper px-3 py-1 shadow-[3px_3px_0_var(--color-ink)]"
		>
			<div
				class="flex shrink-0 items-center gap-1"
				role="img"
				aria-label="{m.pipeline_charges_label()}: {view.charges}/{config.maxCharges}"
			>
				{#each { length: config.maxCharges }, slot (slot)}
					<img
						src={spriteSrc('patriotLauncher')}
						alt=""
						class="w-6 {slot < view.charges ? '' : 'opacity-25 grayscale'}"
						draggable="false"
					/>
				{/each}
			</div>

			<div class="flex min-w-0 flex-1 items-center gap-2" aria-label={m.pipeline_tanker_label()}>
				<div class="relative h-8 w-12 shrink-0">
					<img
						src={spriteSrc('tanker')}
						alt={m.pipeline_tanker_alt()}
						class="absolute inset-0 size-full object-contain"
						style:translate={departing && !reducedMotion ? `${departProgress * 200}% 0` : undefined}
						style:opacity={departing && !reducedMotion ? 1 - departProgress : undefined}
						draggable="false"
					/>
				</div>
				<div
					class="h-3.5 min-w-0 flex-1 overflow-hidden rounded-full border-2 border-ink bg-paper"
					role="progressbar"
					aria-label={m.pipeline_tanker_label()}
					aria-valuemin={0}
					aria-valuemax={100}
					aria-valuenow={tankerPercent}
				>
					<div class="h-full bg-flag-blue" style:width="{tankerPercent}%"></div>
				</div>
				<span class="font-display text-base font-bold tabular-nums" dir="ltr">{tankerPercent}%</span
				>
			</div>

			{#if multiplier > 1}
				{#key multiplier}
					<span
						class="pop-in shrink-0 rounded-md border-2 border-ink bg-explosion-yellow px-2 py-0.5 text-sm font-bold text-tie-red"
						dir="ltr"
						aria-label="{m.pipeline_multiplier_label()} ×{multiplier}"
					>
						×{multiplier}
					</span>
				{/key}
			{/if}
		</div>

		<div class="relative">
			<PipelineGrid
				{view}
				gameId={game.gameId}
				{reducedMotion}
				disabled={locked}
				tankerLevel={Math.min(tankerPercent, 100) / 100}
				onRotate={(cell) => game.rotate(cell)}
				onRepairStart={(cell) => game.pressRepair(cell)}
				onRepairEnd={() => game.releaseRepair()}
				onIntercept={(id) => game.intercept(id)}
			>
				{#snippet overlay()}
					<!-- Notices float over the board's top edge so the board keeps the whole height -->
					<div
						aria-live="polite"
						class="pointer-events-none absolute inset-x-2 top-1 z-20 flex flex-col gap-1"
					>
						{#if cut}
							<div
								class="flex items-center gap-2 rounded-lg border-3 border-ink bg-tie-red px-3 py-1 text-sm font-bold shadow-[2px_2px_0_var(--color-ink)]"
							>
								<IconTimer class="size-5 shrink-0" aria-hidden="true" />
								<span>{m.pipeline_shutdown_warning({ seconds: shutdownSecondsLeft(view) })}</span>
								<span
									class="ms-auto h-3 w-16 shrink-0 overflow-hidden rounded-full border-2 border-ink bg-paper"
									aria-hidden="true"
								>
									<span
										class="block h-full bg-ink"
										style:width="{(1 - view.cutMs / config.shutdownMs) * 100}%"
									></span>
								</span>
							</div>
						{:else if departing}
							<p
								class="rounded-lg border-3 border-ink bg-flag-blue px-3 py-1 text-sm font-bold shadow-[2px_2px_0_var(--color-ink)]"
							>
								{m.pipeline_tanker_departing({
									bonus: Math.round(config.tankerBonus * multiplier)
								})}
							</p>
						{/if}
					</div>
				{/snippet}
			</PipelineGrid>

			{#if game.paused}
				<div
					class="absolute inset-0 z-20 grid place-items-center rounded-2xl bg-sand/90"
					role="dialog"
					aria-label={m.game_paused()}
				>
					<div class="sticker flex flex-col items-center gap-3 p-5" style:--tilt="-2deg">
						<h2 class="text-3xl font-bold">{m.game_paused()}</h2>
						<button
							type="button"
							class="btn-chunky bg-flag-blue text-lg"
							onclick={() => game.resume()}
						>
							<IconPlay class="size-5" aria-hidden="true" />
							{m.game_resume()}
						</button>
					</div>
				</div>
			{/if}
		</div>

		{#if view.phase === 'setup'}
			<div class="rounded-lg border-3 border-ink bg-paper px-3 py-2 text-sm">
				<p class="font-semibold">{m.pipeline_setup_hint()}</p>
				{#if showTutorial}
					<p class="mt-1">{m.pipeline_controls_hint()}</p>
					<p class="mt-1 opacity-80">{m.pipeline_repair_toggle_hint()}</p>
					<p class="mt-1 hidden opacity-80 sm:block">{m.pipeline_keyboard_hint()}</p>
				{/if}
			</div>
		{/if}
	{/if}
</GameShell>

<GameOverModal
	open={game.result !== null}
	score={game.result?.score ?? 0}
	modeName={`${m.mode_pipeline_name()} (${LEVEL_NAMES[game.difficulty]()})`}
	isNewBest={game.result?.isNewBest ?? false}
	title={m.pipeline_gameover_title()}
	{drawBoard}
	onRetry={() => game.newGame()}
>
	{#if game.result}
		<p class="mb-2 text-sm italic">{m.pipeline_gameover_quip()}</p>
		<dl class="grid grid-cols-2 gap-x-3 gap-y-1 text-start text-sm">
			<dt>{m.pipeline_stat_barrels()}</dt>
			<dd class="text-end font-bold tabular-nums">{Math.floor(view.barrels)}</dd>
			<dt>{m.pipeline_stat_tankers()}</dt>
			<dd class="text-end font-bold tabular-nums">{game.result.tankers}</dd>
			<dt>{m.pipeline_stat_best_tankers()}</dt>
			<dd class="text-end font-bold tabular-nums">{game.result.bestTankers ?? 0}</dd>
			<dt>{m.pipeline_stat_intercepted()}</dt>
			<dd class="text-end font-bold tabular-nums">{view.intercepted}</dd>
			<dt>{m.pipeline_stat_best_streak()}</dt>
			<dd class="text-end font-bold tabular-nums">{view.bestStreak}</dd>
			<dt>{m.pipeline_stat_repairs()}</dt>
			<dd class="text-end font-bold tabular-nums">{view.repairs}</dd>
		</dl>
	{/if}
</GameOverModal>
