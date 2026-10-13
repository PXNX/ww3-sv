<!--
	Sondage Surge (roadmap 3.11): a French election on a map of abstract départements. Hold rallies
	Othello-style, flip the rival's lines, and keep an eye on the poll bar. La Candidate answers with
	a greedy rally every round, scandals freeze rallies and strikes block départements. There are no
	lives: whoever crosses the majority wins the "Elections: Result" screen, or the larger map share
	after the last round.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import GameOverModal from '#lib/components/GameOverModal.svelte';
	import GameShell from '#lib/components/GameShell.svelte';
	import PauseOverlay from '#lib/components/PauseOverlay.svelte';
	import SondageBoard from '#lib/components/SondageBoard.svelte';
	import SondageCandidate from '#lib/components/SondageCandidate.svelte';
	import SondagePollBar from '#lib/components/SondagePollBar.svelte';
	import SondageResultMap from '#lib/components/SondageResultMap.svelte';
	import {
		actionText,
		candidateAlt,
		candidateName,
		candidateQuote,
		eventText,
		reasonText,
		SIDE_BACKGROUND
	} from '#lib/components/sondageText.js';
	import TutorialModal from '#lib/components/TutorialModal.svelte';
	import { swingOrder } from '#lib/game/sondage/board.js';
	import { candidateFile, candidatePose } from '#lib/game/sondage/candidate.js';
	import { majority } from '#lib/game/sondage/rules.js';
	import { createFixedLoop, onAppHidden, prefersReducedMotion } from '#lib/game/loop.js';
	import { m } from '#lib/paraglide/messages.js';
	import { firstPlay } from '#lib/services/tutorial.js';
	import { SondageGame } from '#lib/stores/sondageGame.svelte.js';
	import { cameoAsset } from '#lib/theme/cameos.js';
	import IconHelp from '~icons/lucide/circle-help';
	import IconBan from '~icons/lucide/ban';
	import IconPause from '~icons/lucide/pause';
	import IconPlay from '~icons/lucide/play';
	import IconSnowflake from '~icons/lucide/snowflake';

	const game = new SondageGame({ reducedMotion: prefersReducedMotion() });
	const modeName = m.mode_sondage_name();

	// The how-to-play screen opens on the first visit and whenever the help button is tapped
	let showTutorial = $state(false);
	onMount(() => {
		game.loadBest();
		showTutorial = firstPlay('sondage');
		return onAppHidden(() => game.pause());
	});

	// La Candidate answers after a short beat of real time; the loop runs only on her turn
	$effect(() => {
		if (game.status !== 'playing' || game.phase !== 'rival') return;
		const loop = createFixedLoop({ stepMs: 50, update: (dt) => game.update(dt), render: () => {} });
		loop.start();
		return () => loop.pause();
	});

	function openHelp() {
		game.pause();
		showTutorial = true;
	}

	const playing = $derived(game.status === 'playing' || game.status === 'paused');
	const yourMove = $derived(game.status === 'playing' && game.phase === 'you');
	const needed = $derived(majority(game.counts.total));
	const pose = $derived(candidatePose(game.mood));
	const outcome = $derived(game.outcome);
	const winnerYou = $derived(outcome?.winner === 'you');

	const statusLine = $derived(
		game.phase === 'rival' ? m.sondage_turn_rival() : m.sondage_turn_you()
	);

	const overCameo = $derived(
		outcome
			? {
					image: cameoAsset(candidateFile(candidatePose(game.mood))),
					alt: candidateAlt(candidatePose(game.mood)),
					message: winnerYou ? m.sondage_cameo_message_win() : m.sondage_cameo_message_lose(),
					label: m.sondage_cameo_label()
				}
			: null
	);
</script>

<GameShell title={modeName} score={game.score} best={game.best} confirmLeave={playing}>
	{#snippet actions()}
		<button
			type="button"
			class="btn-chunky px-2 py-1 text-sm sm:px-3"
			aria-label={m.sondage_help_button()}
			onclick={openHelp}
		>
			<IconHelp class="size-4" aria-hidden="true" />
			<span class="hidden sm:inline">{m.sondage_help_button()}</span>
		</button>
		{#if playing}
			<button type="button" class="btn-chunky px-3 py-1 text-sm" onclick={() => game.togglePause()}>
				{#if game.status === 'paused'}
					<IconPlay class="size-4" aria-hidden="true" />
					{m.game_resume()}
				{:else}
					<IconPause class="size-4" aria-hidden="true" />
					{m.game_pause()}
				{/if}
			</button>
		{/if}
	{/snippet}

	<section class="mx-auto flex w-full max-w-xl flex-col gap-2">
		<!-- The poll bar: map share of each side, with the majority marker -->
		<div
			class="flex flex-col gap-1.5 rounded-[12px_6px_14px_8px] border-3 border-ink bg-paper px-3 py-2 shadow-[3px_3px_0_var(--color-ink)]"
		>
			<p
				dir="auto"
				class="flex items-center justify-between font-display text-sm font-bold tabular-nums"
			>
				<span>{m.sondage_hud_round({ round: game.round, total: game.totalRounds })}</span>
				<span class="hidden text-xs font-semibold sm:inline">{m.sondage_poll_title()}</span>
			</p>
			<SondagePollBar
				you={game.counts.you}
				rival={game.counts.rival}
				total={game.counts.total}
				{needed}
			/>
		</div>

		<SondageCandidate
			{pose}
			name={candidateName()}
			alt={candidateAlt(pose)}
			quote={candidateQuote(game.mood, game.round)}
			thinking={game.status === 'playing' && game.phase === 'rival'}
		/>

		<!-- Whose move it is, the last rally and the round's event -->
		<div
			class="flex min-h-12 flex-col gap-1 rounded-[10px_6px_12px_7px] border-3 border-ink bg-sand px-2 py-1 text-sm font-semibold"
			role="status"
		>
			<p dir="auto" class="font-display font-bold">{statusLine}</p>
			{#if game.last && playing}
				<p dir="auto" class="flex items-center gap-1.5 text-xs">
					<span
						class="inline-block size-3 shrink-0 rounded-full border-2 border-ink {SIDE_BACKGROUND[
							game.last.side
						]}"
						aria-hidden="true"
					></span>
					<span>{actionText(game.last)}</span>
				</p>
			{/if}
			{#if game.event && playing}
				<p
					dir="auto"
					class="flex items-center gap-1.5 rounded-full border-2 border-ink px-2 py-0.5 text-xs font-bold {game
						.event.kind === 'strike'
						? 'bg-mustard'
						: 'bg-[#bfe6ff]'}"
				>
					{#if game.event.kind === 'strike'}
						<IconBan class="size-4 shrink-0" aria-hidden="true" />
					{:else}
						<IconSnowflake class="size-4 shrink-0" aria-hidden="true" />
					{/if}
					<span>{eventText(game.event)}</span>
				</p>
			{/if}
		</div>

		<!-- The map: stays left to right -->
		<div
			class="relative rounded-[14px_8px_16px_10px] border-3 border-ink bg-sand p-2 shadow-[3px_3px_0_var(--color-ink)]"
		>
			<SondageBoard
				cells={game.cells}
				cols={game.board.cols}
				hints={game.hints}
				stamps={game.stamps}
				active={yourMove}
				onrally={(index) => game.rally(index)}
				preview={(index) => game.preview(index)}
			/>

			{#if game.status === 'ready'}
				<div
					class="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 rounded-[inherit] bg-ink/35 p-4"
				>
					<div
						class="sticker pop-in flex w-full max-w-xs flex-col items-center gap-3 p-4 text-center"
						style:--tilt="-1.5deg"
					>
						<p dir="auto" class="text-sm leading-snug font-semibold">
							{m.sondage_ready_hint()}
						</p>
						{#if game.best !== null}
							<p dir="auto" class="text-sm font-semibold">
								{m.sondage_best({ score: game.best })}
							</p>
						{/if}
						<button
							type="button"
							class="btn-chunky bg-tie-red text-xl"
							onclick={() => game.start()}
						>
							<IconPlay class="size-5" aria-hidden="true" />
							{m.sondage_start()}
						</button>
					</div>
				</div>
			{:else if game.status === 'paused'}
				<PauseOverlay onResume={() => game.resume()} />
			{/if}
		</div>
	</section>

	<TutorialModal
		open={showTutorial}
		title={m.sondage_tutorial_title()}
		closeLabel={m.sondage_tutorial_close()}
		onclose={() => (showTutorial = false)}
	>
		<p>{m.sondage_tutorial_goal()}</p>
		<p>{m.sondage_tutorial_rally()}</p>
		<p>{m.sondage_tutorial_flip()}</p>
		<p>{m.sondage_tutorial_rival()}</p>
		<img
			src={cameoAsset(candidateFile('neutral'))}
			alt={candidateAlt('neutral')}
			class="mx-auto size-24 rounded-md border-2 border-ink bg-paper object-cover"
		/>
		<p>{m.sondage_tutorial_events()}</p>
		<ul class="flex flex-col gap-2">
			<li class="flex items-center gap-2">
				<span
					class="flex size-9 shrink-0 items-center justify-center rounded-md border-2 border-ink bg-[#bfe6ff]"
				>
					<IconSnowflake class="size-6" aria-hidden="true" />
				</span>
				<span>{m.sondage_legend_frozen()}</span>
			</li>
			<li class="flex items-center gap-2">
				<span
					class="flex size-9 shrink-0 items-center justify-center rounded-md border-2 border-ink bg-mustard"
				>
					<IconBan class="size-6" aria-hidden="true" />
				</span>
				<span>{m.sondage_legend_blocked()}</span>
			</li>
		</ul>
		<p>{m.sondage_tutorial_win()}</p>
		<p>{m.sondage_tutorial_score()}</p>
	</TutorialModal>

	<GameOverModal
		open={game.status === 'over'}
		score={game.score}
		{modeName}
		isNewBest={game.isNewBest}
		title={m.sondage_result_title()}
		customCameo={overCameo}
		drawBoard={game.drawBoard}
		onRetry={() => game.start()}
	>
		{#if outcome}
			<div class="flex flex-col items-center gap-2">
				<p
					dir="auto"
					class="font-display text-xl font-bold {winnerYou ? 'text-khaki' : 'text-[#1f3a6e]'}"
				>
					{winnerYou ? m.sondage_result_win() : m.sondage_result_lose()}
				</p>
				<p dir="auto" class="text-sm leading-snug font-semibold">
					{reasonText(outcome, game.round, game.counts.you, game.counts.rival)}
				</p>
				<SondageResultMap
					cells={game.finalCells}
					cols={game.board.cols}
					order={swingOrder(game.board)}
					winner={outcome.winner}
					active={game.status === 'over'}
					reducedMotion={game.reducedMotion}
					label={m.sondage_result_map_label({ you: game.counts.you, rival: game.counts.rival })}
				/>
				<p dir="auto" class="text-sm font-bold">
					{winnerYou ? m.sondage_result_swing_you() : m.sondage_result_swing_rival()}
				</p>
				<dl class="grid w-full grid-cols-3 gap-2 font-display text-sm">
					<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
						<dt class="font-bold">{m.sondage_stat_tiles()}</dt>
						<dd class="text-2xl font-bold tabular-nums">{game.counts.you}</dd>
					</div>
					<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
						<dt class="font-bold">{m.sondage_stat_flips()}</dt>
						<dd class="text-2xl font-bold tabular-nums">{game.flips}</dd>
					</div>
					<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
						<dt class="font-bold">{m.sondage_stat_rounds()}</dt>
						<dd class="text-2xl font-bold tabular-nums">{game.round}</dd>
					</div>
				</dl>
			</div>
		{/if}
	</GameOverModal>
</GameShell>
