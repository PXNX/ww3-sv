<!--
	Iceberg Curling playfield: aim by dragging back from the stone, release to throw, hold to sweep.
	Eight ends of two stones at the realtor's "For Sale" sign; wind, a lost penguin, seals and
	drifting ice make every end harder. A gamble doubles a stone's points, or costs points.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { scale } from 'svelte/transition';
	import CurlingCanvas from '#lib/components/CurlingCanvas.svelte';
	import GameOverModal from '#lib/components/GameOverModal.svelte';
	import GameShell from '#lib/components/GameShell.svelte';
	import TutorialModal from '#lib/components/TutorialModal.svelte';
	import {
		CLEAN_ICE_BONUS,
		ENDS_TOTAL,
		GAMBLE_PENALTY,
		MAX_STARS,
		PENGUIN_PENALTY,
		STAR_THRESHOLDS,
		STONES_PER_END,
		WIN_STARS
	} from '#lib/game/curling/config.js';
	import { prefersReducedMotion } from '#lib/game/loop.js';
	import { m } from '#lib/paraglide/messages.js';
	import { firstPlay } from '#lib/services/tutorial.js';
	import { CurlingGame } from '#lib/stores/curlingGame.svelte.js';
	import IconHelp from '~icons/lucide/circle-help';
	import IconPause from '~icons/lucide/pause';
	import IconPlay from '~icons/lucide/play';
	import IconRotateCcw from '~icons/lucide/rotate-ccw';
	import IconRotateCw from '~icons/lucide/rotate-cw';
	import IconStar from '~icons/lucide/star';
	import IconWind from '~icons/lucide/wind';

	const reducedMotion = prefersReducedMotion();
	const game = new CurlingGame({ reducedMotion });
	const modeName = m.mode_curling_name();
	if (import.meta.env.DEV) Object.assign(window, { curlingGame: game }); // TEMP-HOOK

	// The how-to-play screen opens on the first visit and whenever the help button is tapped
	let showTutorial = $state(false);
	onMount(() => {
		game.loadBest();
		showTutorial = firstPlay('curling');
	});

	$effect(() => {
		if (showTutorial) game.pause();
	});

	function closeTutorial() {
		showTutorial = false;
		game.resume();
	}

	const windText = $derived(
		game.wind === 0
			? m.curling_wind_none()
			: game.wind < 0
				? m.curling_wind_left()
				: m.curling_wind_right()
	);

	const hazardText = $derived(
		game.newHazard === 'wind'
			? m.curling_hazard_wind()
			: game.newHazard === 'penguin'
				? m.curling_hazard_penguin({ penalty: PENGUIN_PENALTY })
				: game.newHazard === 'seals'
					? m.curling_hazard_seals()
					: game.newHazard === 'drift'
						? m.curling_hazard_drift()
						: ''
	);

	const hintText = $derived(
		game.phase === 'aiming'
			? game.gamble
				? m.curling_gamble_hint({ penalty: GAMBLE_PENALTY })
				: m.curling_hint_aim()
			: game.phase === 'sliding'
				? m.curling_hint_sliding()
				: m.curling_hint_wait()
	);

	const stoneNumber = $derived(Math.min(STONES_PER_END, game.stoneIndex + 1));

	const outcomeText = (outcome: 'house' | 'outside' | 'sunk', ring: number) =>
		outcome === 'house'
			? m.curling_outcome_house({ ring })
			: outcome === 'outside'
				? m.curling_outcome_outside()
				: m.curling_outcome_sunk();

	const signed = (value: number) => (value > 0 ? `+${value}` : `${value}`);
	const isLastEnd = $derived(game.endIndex + 1 >= ENDS_TOTAL);
</script>

<GameShell
	title={modeName}
	score={game.score}
	best={game.best}
	confirmLeave={game.phase !== 'over' &&
		(game.phase !== 'aiming' || game.endIndex > 0 || game.stoneIndex > 0)}
	onQuit={() => game.forfeit()}
>
	{#snippet actions()}
		<button
			type="button"
			class="btn-chunky px-2 py-1 text-sm sm:px-3"
			aria-label={m.curling_help_button()}
			onclick={() => (showTutorial = true)}
		>
			<IconHelp class="size-4" aria-hidden="true" />
			<span class="hidden sm:inline">{m.curling_help_button()}</span>
		</button>
		{#if game.phase !== 'over'}
			<button type="button" class="btn-chunky px-3 py-1 text-sm" onclick={() => game.togglePause()}>
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

	<section
		class="mx-auto flex w-full flex-col gap-2"
		style:max-width="max(20rem, min(100%, calc((100dvh - 16rem) * 1.524)))"
	>
		<div
			class="flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-[12px_6px_14px_8px] border-3 border-ink bg-paper px-3 py-1 font-display text-sm font-bold shadow-[3px_3px_0_var(--color-ink)]"
		>
			<span>{m.curling_hud_end({ end: game.endIndex + 1, total: ENDS_TOTAL })}</span>
			<span>{m.curling_hud_stone({ stone: stoneNumber, total: STONES_PER_END })}</span>
			<span class="flex items-center gap-1" aria-label={`${game.totalStars} / ${MAX_STARS}`}>
				<IconStar class="size-4 fill-explosion-yellow" aria-hidden="true" />
				<span class="tabular-nums">{game.totalStars}/{MAX_STARS}</span>
			</span>
			<span class="flex items-center gap-1">
				<IconWind class="size-4" aria-hidden="true" />
				{windText}
			</span>
		</div>

		<CurlingCanvas {game}>
			{#if hazardText && game.phase === 'aiming' && game.stoneIndex === 0 && !game.paused}
				<p
					class="pointer-events-none absolute inset-x-2 top-2 mx-auto w-fit max-w-full rounded-md border-2 border-ink bg-explosion-yellow px-2 py-0.5 text-center font-display text-xs font-bold sm:text-sm"
					dir="auto"
				>
					{hazardText}
				</p>
			{/if}

			{#if game.paused && game.phase !== 'over'}
				<div
					class="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-[14px_8px_16px_10px] bg-black/45"
				>
					<button type="button" class="btn-chunky px-4 py-2" onclick={() => game.resume()}>
						<IconPlay class="size-5" aria-hidden="true" />
						{m.game_resume()}
					</button>
				</div>
			{/if}

			{#if game.phase === 'summary' && game.summary}
				{@const summary = game.summary}
				<div class="absolute inset-0 flex items-center justify-center p-2" aria-live="polite">
					<div
						class="flex max-h-full w-full max-w-sm flex-col gap-1.5 overflow-auto rounded-[12px_6px_14px_8px] border-3 border-ink bg-paper p-3 shadow-[4px_4px_0_var(--color-ink)]"
						in:scale={{ duration: reducedMotion ? 0 : 220, start: 0.85 }}
					>
						<h2 class="text-center font-display text-lg font-bold">
							{m.curling_summary_title({ end: summary.end + 1 })}
						</h2>
						<div
							class="flex justify-center gap-1"
							role="img"
							aria-label={m.curling_stars_label({ stars: summary.stars })}
						>
							{#each STAR_THRESHOLDS as threshold, index (threshold)}
								{#if index < summary.stars}
									<span
										data-threshold={threshold}
										in:scale={{
											delay: reducedMotion ? 0 : 250 + index * 260,
											duration: reducedMotion ? 0 : 320,
											start: 0.1
										}}
									>
										<IconStar class="size-9 fill-explosion-yellow stroke-ink" aria-hidden="true" />
									</span>
								{:else}
									<IconStar class="size-9 stroke-ink opacity-30" aria-hidden="true" />
								{/if}
							{/each}
						</div>
						<ul class="flex flex-col gap-1 text-sm">
							{#each summary.stones as stone, index (index)}
								<li
									class="flex items-center justify-between gap-2 rounded-md border-2 border-ink bg-sand px-2 py-0.5"
								>
									<span dir="auto">
										<strong>{m.curling_summary_stone({ stone: index + 1 })}</strong>
										- {outcomeText(stone.outcome, stone.ring)}{#if stone.gamble}
											, {stone.points > 0
												? m.curling_summary_gamble_won()
												: m.curling_summary_gamble_lost()}{/if}
									</span>
									<span class="font-bold tabular-nums">{signed(stone.points)}</span>
								</li>
							{/each}
							{#if summary.penguinHits > 0}
								<li
									class="flex items-center justify-between gap-2 rounded-md border-2 border-ink bg-sand px-2 py-0.5"
								>
									<span dir="auto">{m.curling_summary_penguin({ count: summary.penguinHits })}</span
									>
									<span class="font-bold tabular-nums">-{summary.penguinPenalty}</span>
								</li>
							{/if}
							{#if summary.sealBumps > 0}
								<li class="rounded-md border-2 border-ink bg-sand px-2 py-0.5" dir="auto">
									{m.curling_summary_seals({ count: summary.sealBumps })}
								</li>
							{/if}
						</ul>
						{#if summary.sold}
							<p class="text-center font-display text-sm font-bold text-tie-red" dir="auto">
								{m.curling_summary_sold()}
							</p>
						{/if}
						<p class="text-center font-display text-lg font-bold" dir="auto">
							{m.curling_summary_total({ points: summary.points })}
						</p>
						<button
							type="button"
							class="btn-chunky mx-auto px-4 py-1.5 text-sm"
							onclick={() => game.nextEnd()}
						>
							{isLastEnd ? m.curling_finish() : m.curling_next_end()}
						</button>
					</div>
				</div>
			{/if}
		</CurlingCanvas>

		<div class="flex w-full flex-wrap items-center gap-2">
			<button
				type="button"
				class="btn-chunky px-3 py-1 text-sm"
				disabled={game.phase !== 'aiming' || game.paused}
				aria-pressed={game.spin > 0}
				onclick={() => game.toggleSpin()}
			>
				{#if game.spin > 0}
					<IconRotateCw class="size-4" aria-hidden="true" />
					{m.curling_curl_right()}
				{:else}
					<IconRotateCcw class="size-4" aria-hidden="true" />
					{m.curling_curl_left()}
				{/if}
			</button>
			<button
				type="button"
				class="btn-chunky px-3 py-1 text-sm {game.gamble ? 'bg-explosion-yellow' : ''}"
				disabled={game.phase !== 'aiming' || game.paused}
				aria-pressed={game.gamble}
				onclick={() => game.toggleGamble()}
			>
				{m.curling_gamble()}
			</button>
			<span class="font-display text-sm font-bold tabular-nums" aria-live="off">
				{m.curling_power({ power: Math.round(game.power * 100) })}
			</span>
			<div class="ms-auto flex items-center gap-2">
				<div
					class="h-3 w-20 overflow-hidden rounded-full border-2 border-ink bg-paper sm:w-28"
					role="meter"
					aria-label={m.curling_sweep_energy()}
					aria-valuemin={0}
					aria-valuemax={100}
					aria-valuenow={Math.round(game.sweepEnergy * 100)}
				>
					<div
						class="h-full {game.sweepEnergy < 0.25 ? 'bg-tie-red' : 'bg-explosion-yellow'}"
						style:width="{game.sweepEnergy * 100}%"
					></div>
				</div>
				{#if game.phase === 'sliding'}
					<button
						type="button"
						class="btn-chunky touch-none px-4 py-1.5 text-sm {game.sweeping
							? 'bg-explosion-yellow'
							: ''}"
						onpointerdown={(event) => {
							event.currentTarget.setPointerCapture(event.pointerId);
							game.setSweeping(true);
						}}
						onpointerup={() => game.setSweeping(false)}
						onpointercancel={() => game.setSweeping(false)}
					>
						{m.curling_sweep()}
					</button>
				{:else}
					<button
						type="button"
						class="btn-chunky px-4 py-1.5 text-sm"
						disabled={game.phase !== 'aiming' || game.paused}
						onclick={() => game.throw()}
					>
						{m.curling_throw()}
					</button>
				{/if}
			</div>
		</div>
		<p class="min-h-8 font-display text-xs leading-tight sm:text-sm" dir="auto" aria-live="off">
			{hintText}
		</p>
	</section>

	<TutorialModal
		open={showTutorial}
		title={m.curling_tutorial_title()}
		closeLabel={m.curling_tutorial_close()}
		onclose={closeTutorial}
	>
		<p>{m.curling_tutorial_goal()}</p>
		<p>{m.curling_tutorial_aim()}</p>
		<p>{m.curling_tutorial_sweep()}</p>
		<p>{m.curling_tutorial_curl()}</p>
		<p>{m.curling_tutorial_scoring()}</p>
		<p>{m.curling_tutorial_gamble({ penalty: GAMBLE_PENALTY })}</p>
		<p>{m.curling_tutorial_hazards()}</p>
		<p class="hidden text-sm sm:block">{m.curling_keyboard_hint()}</p>
	</TutorialModal>

	<GameOverModal
		open={game.phase === 'over'}
		score={game.score}
		mode="curling"
		{modeName}
		outcome={(game.final?.stars ?? 0) >= WIN_STARS ? 'won' : 'lost'}
		isNewBest={game.isNewBest}
		title={m.curling_gameover_title()}
		onRetry={() => game.start()}
	>
		<dl class="grid grid-cols-2 gap-2 font-display text-sm">
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="font-bold">{m.curling_stat_stars()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{game.final?.stars ?? 0}/{MAX_STARS}</dd>
			</div>
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="font-bold">{m.curling_stat_points()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{game.final?.points ?? 0}</dd>
			</div>
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="font-bold">{m.curling_stat_penguin()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{game.penguinHits}</dd>
			</div>
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="font-bold">{m.curling_stat_seals()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{game.sealBumps}</dd>
			</div>
		</dl>
		{#if game.final?.cleanIce}
			<p class="mt-2 text-center font-display text-sm font-bold" dir="auto">
				{m.curling_clean_ice({ bonus: CLEAN_ICE_BONUS })}
			</p>
		{/if}
	</GameOverModal>
</GameShell>
