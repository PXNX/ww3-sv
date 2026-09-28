<script lang="ts">
	import { onMount } from 'svelte';
	import { m } from '$lib/paraglide/messages';
	import GameOverModal from '$lib/components/GameOverModal.svelte';
	import GameShell from '$lib/components/GameShell.svelte';
	import PipelineGrid from '$lib/components/PipelineGrid.svelte';
	import PipelineWrench from '$lib/components/PipelineWrench.svelte';
	import { prefersReducedMotion } from '$lib/game/loop';
	import {
		DIFFICULTIES,
		DIFFICULTY_CONFIG,
		TANKER_DEPART_MS,
		barrelsPerSecond,
		finalScore,
		shutdownSecondsLeft,
		streakMultiplier,
		type Difficulty
	} from '$lib/game/pipeline/pipelineStep';
	import { boardDrawer } from '$lib/game/pipeline/shareBoard';
	import { PipelineGame } from '$lib/stores/pipelineGame.svelte';
	import { spriteSrc } from '$lib/theme/sprites';
	import IconCheck from '~icons/lucide/check';
	import IconPause from '~icons/lucide/pause';
	import IconPlay from '~icons/lucide/play';
	import IconRefresh from '~icons/lucide/refresh-cw';
	import IconTimer from '~icons/lucide/timer';

	const game = new PipelineGame();
	let reducedMotion = $state(false);

	onMount(() => {
		reducedMotion = prefersReducedMotion();
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
	const rate = $derived(barrelsPerSecond(config, view.flow.pathLength));
	const multiplier = $derived(streakMultiplier(view.streak));
	const tankerPercent = $derived(Math.floor((view.tankerFill / config.tankerCapacity) * 100));
	const departing = $derived(view.tankerDepartMs > 0);
	const departProgress = $derived(1 - view.tankerDepartMs / TANKER_DEPART_MS);
	// Only needed for the share card; the board stops changing once the game is over
	const drawBoard = $derived(game.result ? boardDrawer(view.grid, view.flow) : undefined);

	const LEVEL_NAMES: Record<Difficulty, () => string> = {
		easy: m.pipeline_difficulty_easy,
		normal: m.pipeline_difficulty_normal,
		hard: m.pipeline_difficulty_hard
	};
	const TILTS = [-1.5, 1, -0.8, 1.4];
</script>

<GameShell title={m.mode_pipeline_name()} score={shownScore} best={game.best}>
	{#snippet actions()}
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
	{/snippet}

	<div class="flex flex-wrap items-center justify-between gap-2">
		<fieldset class="flex items-center gap-2" disabled={running && !game.paused}>
			<legend class="sr-only">{m.pipeline_difficulty_label()}</legend>
			<span class="text-sm font-bold" aria-hidden="true">{m.pipeline_difficulty_label()}</span>
			{#each DIFFICULTIES as level (level)}
				<button
					type="button"
					class="btn-chunky px-2.5 py-0.5 text-sm disabled:opacity-60 {game.difficulty === level
						? 'bg-mustard'
						: ''}"
					aria-pressed={game.difficulty === level}
					onclick={() => game.setDifficulty(level)}
				>
					{#if game.difficulty === level}
						<IconCheck class="size-4" aria-hidden="true" />
					{/if}
					{LEVEL_NAMES[level]()}
					<span class="text-xs opacity-80" dir="ltr"
						>{DIFFICULTY_CONFIG[level].size}×{DIFFICULTY_CONFIG[level].size}</span
					>
				</button>
			{/each}
		</fieldset>
		<button type="button" class="btn-chunky px-3 py-0.5 text-sm" onclick={() => game.newGame()}>
			<IconRefresh class="size-4" aria-hidden="true" />
			{m.pipeline_new_board()}
		</button>
	</div>

	<dl class="grid grid-cols-2 gap-2 sm:grid-cols-4">
		<div class="sticker flex flex-col px-3 py-1.5" style:--tilt="{TILTS[0]}deg">
			<dt class="text-xs font-bold uppercase">{m.pipeline_charges_label()}</dt>
			<dd class="flex items-center gap-1">
				{#each { length: config.maxCharges }, slot (slot)}
					<img
						src={spriteSrc('patriotLauncher')}
						alt=""
						class="w-8 {slot < view.charges ? '' : 'opacity-25 grayscale'}"
						draggable="false"
					/>
				{/each}
				<span class="ms-auto font-display text-lg font-bold tabular-nums"
					>{view.charges}/{config.maxCharges}</span
				>
			</dd>
		</div>
		<div class="sticker flex flex-col px-3 py-1.5" style:--tilt="{TILTS[1]}deg">
			<dt class="text-xs font-bold uppercase">{m.pipeline_rate_label()}</dt>
			<dd class="font-display text-2xl font-bold tabular-nums">{rate.toFixed(1)}</dd>
		</div>
		<div class="sticker flex flex-col px-3 py-1.5" style:--tilt="{TILTS[2]}deg">
			<dt class="text-xs font-bold uppercase">{m.pipeline_multiplier_label()}</dt>
			<dd
				class="font-display text-2xl font-bold tabular-nums {view.streak > 0 ? 'text-tie-red' : ''}"
			>
				×{multiplier}
			</dd>
		</div>
		<div class="sticker flex flex-col px-3 py-1.5" style:--tilt="{TILTS[3]}deg">
			<dt class="text-xs font-bold uppercase">{m.pipeline_stat_tankers()}</dt>
			<dd class="font-display text-2xl font-bold tabular-nums">{view.tankersFilled}</dd>
		</div>
	</dl>

	<div aria-live="polite" class="min-h-10">
		{#if view.phase === 'setup'}
			<p class="rounded-lg border-3 border-ink bg-paper px-3 py-1.5 text-sm font-semibold">
				{m.pipeline_setup_hint()}
			</p>
		{:else if cut}
			<div
				class="flex items-center gap-2 rounded-lg border-3 border-ink bg-tie-red px-3 py-1.5 font-bold"
			>
				<IconTimer class="size-5 shrink-0" aria-hidden="true" />
				<span>{m.pipeline_shutdown_warning({ seconds: shutdownSecondsLeft(view) })}</span>
				<span
					class="ms-auto h-3 w-20 shrink-0 overflow-hidden rounded-full border-2 border-ink bg-paper"
					aria-hidden="true"
				>
					<span
						class="block h-full bg-ink"
						style:width="{(1 - view.cutMs / config.shutdownMs) * 100}%"
					></span>
				</span>
			</div>
		{:else if departing}
			<p class="rounded-lg border-3 border-ink bg-flag-blue px-3 py-1.5 font-bold">
				{m.pipeline_tanker_departing({ bonus: Math.round(config.tankerBonus * multiplier) })}
			</p>
		{/if}
	</div>

	<div class="relative">
		<PipelineGrid
			{view}
			gameId={game.gameId}
			{reducedMotion}
			disabled={locked}
			onRotate={(cell) => game.rotate(cell)}
			onRepairStart={(cell) => game.pressRepair(cell)}
			onRepairEnd={() => game.releaseRepair()}
			onIntercept={(id) => game.intercept(id)}
		/>

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

	<section
		class="sticker mx-auto flex w-full max-w-[32rem] items-center gap-3 overflow-hidden px-3 py-2"
		style:--tilt="0.8deg"
		aria-label={m.pipeline_tanker_label()}
	>
		<div class="relative h-12 w-28 shrink-0">
			<img
				src={spriteSrc('tanker')}
				alt={m.pipeline_tanker_alt()}
				class="absolute inset-0 size-full object-contain"
				style:translate={departing && !reducedMotion ? `${departProgress * 160}% 0` : undefined}
				style:opacity={departing && !reducedMotion ? 1 - departProgress : undefined}
				draggable="false"
			/>
		</div>
		<div class="flex min-w-0 flex-1 flex-col gap-1">
			<span class="text-xs font-bold uppercase">{m.pipeline_tanker_label()}</span>
			<div
				class="h-4 overflow-hidden rounded-full border-2 border-ink bg-paper"
				role="progressbar"
				aria-label={m.pipeline_tanker_label()}
				aria-valuemin={0}
				aria-valuemax={100}
				aria-valuenow={tankerPercent}
			>
				<div class="h-full bg-flag-blue" style:width="{tankerPercent}%"></div>
			</div>
		</div>
		<span class="font-display text-lg font-bold tabular-nums">{tankerPercent}%</span>
	</section>

	<div class="flex flex-col gap-2 text-sm">
		<button
			type="button"
			class="btn-chunky self-start px-3 py-1 text-sm {game.handsFree ? 'bg-mustard' : ''}"
			aria-pressed={game.handsFree}
			onclick={() => (game.handsFree = !game.handsFree)}
		>
			<PipelineWrench standalone class="size-5" />
			{m.pipeline_repair_toggle()}
			{#if game.handsFree}
				<IconCheck class="size-4" aria-hidden="true" />
			{/if}
		</button>
		<p>{m.pipeline_repair_toggle_hint()}</p>
		<p class="font-semibold">{m.pipeline_controls_hint()}</p>
		<p class="opacity-80">{m.pipeline_keyboard_hint()}</p>
	</div>
</GameShell>

<GameOverModal
	open={game.result !== null}
	score={game.result?.score ?? 0}
	modeName={m.mode_pipeline_name()}
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
