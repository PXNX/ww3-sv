<!--
	Gig Saboteur: a fifty-euro messenger-channel hire sneaks into Russian sites, top-down, to wreck
	a power line, an ammo depot and a shell factory. Nine gigs, each opened by a chat-style job card.
	Guards, dogs, cameras and floodlights fill a suspicion meter; hold the button at every target,
	then walk out. Three busts end the run, and the pay of the whole run is the score.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import GameOverModal from '#lib/components/GameOverModal.svelte';
	import GameShell from '#lib/components/GameShell.svelte';
	import LivesBar from '#lib/components/LivesBar.svelte';
	import PauseOverlay from '#lib/components/PauseOverlay.svelte';
	import SabotageCanvas from '#lib/components/SabotageCanvas.svelte';
	import SabotagePad from '#lib/components/SabotagePad.svelte';
	import SabotageSelect from '#lib/components/SabotageSelect.svelte';
	import TutorialModal from '#lib/components/TutorialModal.svelte';
	import { STRIKES } from '#lib/game/sabotage/config.js';
	import { STAR_NAMES, SABOTAGE_TEXT } from '#lib/game/sabotage/text.js';
	import { firstPlay } from '#lib/services/tutorial.js';
	import { SabotageGame } from '#lib/stores/sabotageGame.svelte.js';
	import IconHelp from '~icons/lucide/circle-help';
	import IconPause from '~icons/lucide/pause';
	import IconPlay from '~icons/lucide/play';
	import IconRotate from '~icons/lucide/rotate-ccw';
	import IconList from '~icons/lucide/list';
	import IconBomb from '~icons/lucide/bomb';
	import IconSend from '~icons/lucide/send';
	import IconStar from '~icons/lucide/star';
	import IconTimer from '~icons/lucide/timer';

	const game = new SabotageGame();
	const modeName = SABOTAGE_TEXT.title;

	let showTutorial = $state(false);
	onMount(() => {
		showTutorial = firstPlay('sabotage');
		if (import.meta.env.DEV) Object.assign(window, { sabotageGame: game }); // TEMP-HOOK
	});

	function openHelp() {
		game.pause();
		showTutorial = true;
	}

	const inJob = $derived(game.screen !== 'select');
	const running = $derived(game.run !== null && game.screen !== 'over');
	const barColour = $derived(
		game.suspicion > 0.66
			? 'bg-tie-red'
			: game.suspicion > 0.33
				? 'bg-explosion-yellow'
				: 'bg-khaki'
	);
	const STARS = ['unseen', 'quick', 'quiet'] as const;
</script>

<GameShell
	title={modeName}
	score={game.score}
	best={game.best}
	compact
	confirmLeave={running}
	onQuit={() => game.forfeit()}
>
	{#snippet actions()}
		{#if game.screen === 'playing'}
			<button
				type="button"
				class="btn-chunky px-2 py-1 text-sm sm:px-3"
				aria-label={SABOTAGE_TEXT.pause}
				onclick={() => game.pause()}
			>
				<IconPause class="size-4" aria-hidden="true" />
			</button>
		{/if}
		<button
			type="button"
			class="btn-chunky px-2 py-1 text-sm sm:px-3"
			aria-label={SABOTAGE_TEXT.help}
			onclick={openHelp}
		>
			<IconHelp class="size-4" aria-hidden="true" />
			<span class="hidden sm:inline">{SABOTAGE_TEXT.help}</span>
		</button>
	{/snippet}

	{#if !inJob}
		<SabotageSelect {game} onpick={(index) => game.startRun(index)} />
	{:else}
		<section class="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col gap-2">
			<!-- Suspicion, targets, time and strikes, above the site they apply to -->
			<div
				class="flex items-center gap-2 rounded-[12px_6px_14px_8px] border-3 border-ink bg-paper px-2 py-1 font-display text-xs font-bold shadow-[3px_3px_0_var(--color-ink)]"
			>
				<div class="flex min-w-0 flex-1 flex-col gap-0.5">
					<span class="leading-none">{SABOTAGE_TEXT.suspicion}</span>
					<div
						class="h-3 overflow-hidden rounded-full border-2 border-ink bg-sand"
						role="progressbar"
						aria-label={SABOTAGE_TEXT.suspicion}
						aria-valuemin="0"
						aria-valuemax="100"
						aria-valuenow={Math.round(game.suspicion * 100)}
					>
						<div class="h-full {barColour}" style:width="{game.suspicion * 100}%"></div>
					</div>
				</div>
				<span class="flex items-center gap-1 tabular-nums" aria-label={SABOTAGE_TEXT.targetsLabel}>
					<IconBomb class="size-4" aria-hidden="true" />
					{SABOTAGE_TEXT.targets(game.targetsDone, game.targetCount)}
				</span>
				<span class="flex items-center gap-1 tabular-nums">
					<IconTimer class="size-4" aria-hidden="true" />
					{SABOTAGE_TEXT.parTime(game.seconds, game.level.par)}
				</span>
				<LivesBar lives={game.run?.strikes ?? STRIKES} max={STRIKES} class="text-base" />
			</div>

			<SabotageCanvas {game}>
				{#if game.screen === 'card'}
					{@const card = game.level.card}
					<div class="absolute inset-0 z-20 flex items-center justify-center bg-ink/45 p-3">
						<div
							class="sticker pop-in flex w-full max-w-xs flex-col gap-2 p-3"
							style:--tilt="-1deg"
						>
							<div
								class="flex items-center gap-2 rounded-md border-2 border-ink bg-flag-blue px-2 py-1 font-display text-sm font-bold"
							>
								<IconSend class="size-4" aria-hidden="true" />
								<span dir="auto" class="min-w-0 flex-1 truncate">
									{SABOTAGE_TEXT.cardChannel(card.channel)}
								</span>
								<span class="text-xs">{SABOTAGE_TEXT.gigNumber(game.levelIndex + 1)}</span>
							</div>
							<div class="flex items-start gap-2">
								<span
									class="flex size-9 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-explosion-yellow font-display font-bold"
									aria-hidden="true">{card.poster[0]}</span
								>
								<div
									class="min-w-0 flex-1 rounded-[4px_12px_12px_12px] border-2 border-ink bg-sand px-2 py-1.5 text-sm leading-snug"
								>
									<p class="font-display text-xs font-bold opacity-70">{card.poster}</p>
									<p dir="auto">{card.message}</p>
								</div>
							</div>
							<p class="text-center font-display text-sm font-bold">{SABOTAGE_TEXT.cardPay}</p>
							<ul class="flex flex-wrap justify-center gap-1 text-xs">
								{#each STARS as star (star)}
									<li
										class="flex items-center gap-1 rounded-full border-2 border-ink bg-paper px-2 py-0.5"
										title={STAR_NAMES[star].hint}
									>
										<IconStar class="size-3 [&_path]:fill-explosion-yellow" aria-hidden="true" />
										{STAR_NAMES[star].name}
									</li>
								{/each}
							</ul>
							<!-- svelte-ignore a11y_autofocus -->
							<button
								type="button"
								class="btn-chunky justify-center bg-tie-red text-lg"
								autofocus
								onclick={() => game.startJob()}
							>
								<IconPlay class="size-5" aria-hidden="true" />
								{SABOTAGE_TEXT.cardTake}
							</button>
						</div>
					</div>
				{:else if game.screen === 'paused'}
					<PauseOverlay
						title={SABOTAGE_TEXT.paused}
						resumeLabel={SABOTAGE_TEXT.resume}
						onResume={() => game.resume()}
					>
						<button type="button" class="btn-chunky min-w-44" onclick={() => game.restartJob()}>
							<IconRotate class="size-5" aria-hidden="true" />
							{SABOTAGE_TEXT.restartJob}
						</button>
						<button type="button" class="btn-chunky min-w-44" onclick={() => game.backToSelect()}>
							<IconList class="size-5" aria-hidden="true" />
							{SABOTAGE_TEXT.quitRun}
						</button>
					</PauseOverlay>
				{:else if game.screen === 'busted'}
					<div class="absolute inset-0 z-20 flex items-center justify-center bg-ink/45 p-3">
						<div
							class="sticker pop-in flex w-full max-w-xs flex-col items-center gap-3 p-4 text-center"
							style:--tilt="1.5deg"
						>
							<h2 class="font-display text-3xl font-bold text-tie-red">
								{SABOTAGE_TEXT.bustedTitle}
							</h2>
							<p dir="auto">{SABOTAGE_TEXT.bustedBody(game.run?.strikes ?? 0)}</p>
							<!-- svelte-ignore a11y_autofocus -->
							<button
								type="button"
								class="btn-chunky bg-explosion-yellow text-lg"
								autofocus
								onclick={() => game.retryJob()}
							>
								<IconRotate class="size-5" aria-hidden="true" />
								{SABOTAGE_TEXT.tryAgain}
							</button>
						</div>
					</div>
				{:else if game.screen === 'cleared' && game.result}
					<div class="absolute inset-0 z-20 flex items-center justify-center bg-ink/45 p-3">
						<div
							class="sticker pop-in flex w-full max-w-xs flex-col items-center gap-3 p-4 text-center"
							style:--tilt="-1.5deg"
						>
							<h2 class="font-display text-3xl font-bold">{SABOTAGE_TEXT.clearedTitle}</h2>
							<ul class="flex w-full flex-col gap-1">
								{#each STARS as star (star)}
									{@const earned = game.result.stars[star]}
									<li
										class="flex items-center gap-2 rounded-md border-2 border-ink px-2 py-1 text-sm {earned
											? 'bg-explosion-yellow'
											: 'bg-sand opacity-70'}"
									>
										<IconStar
											class="size-5 shrink-0 {earned ? '[&_path]:fill-ink' : 'text-ink/40'}"
											aria-hidden="true"
										/>
										<span class="font-display font-bold">{STAR_NAMES[star].name}</span>
										<span dir="auto" class="min-w-0 flex-1 text-end text-xs"
											>{STAR_NAMES[star].hint}</span
										>
									</li>
								{/each}
							</ul>
							<p dir="auto" class="text-sm">{SABOTAGE_TEXT.clearedBody(game.result.payout)}</p>
							<!-- svelte-ignore a11y_autofocus -->
							<button
								type="button"
								class="btn-chunky bg-tie-red text-lg"
								autofocus
								onclick={() => game.nextJob()}
							>
								<IconPlay class="size-5" aria-hidden="true" />
								{game.hasNextJob ? SABOTAGE_TEXT.nextGig : SABOTAGE_TEXT.finishRun}
							</button>
						</div>
					</div>
				{/if}
			</SabotageCanvas>

			<SabotagePad {game} />
		</section>
	{/if}

	<GameOverModal
		open={game.screen === 'over'}
		score={game.score}
		mode="sabotage"
		{modeName}
		outcome={game.runWon ? 'won' : 'lost'}
		isNewBest={game.isNewBest}
		title={game.runWon ? SABOTAGE_TEXT.overWonTitle : SABOTAGE_TEXT.overLostTitle}
		onRetry={() => game.startRun(0)}
	>
		<dl class="grid grid-cols-3 gap-2 font-display text-sm">
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="font-bold">{SABOTAGE_TEXT.overJobs}</dt>
				<dd class="text-xl font-bold">{game.run?.jobs ?? 0}</dd>
			</div>
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="font-bold">{SABOTAGE_TEXT.overStars}</dt>
				<dd class="text-xl font-bold">{game.run?.stars ?? 0}</dd>
			</div>
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="font-bold">{SABOTAGE_TEXT.overPay}</dt>
				<dd class="text-xl font-bold">{game.score}</dd>
			</div>
		</dl>
	</GameOverModal>

	<TutorialModal
		open={showTutorial}
		title={SABOTAGE_TEXT.tutorialTitle}
		closeLabel={SABOTAGE_TEXT.helpClose}
		onclose={() => (showTutorial = false)}
	>
		<p>{SABOTAGE_TEXT.tutorialGoal}</p>
		<p>{SABOTAGE_TEXT.tutorialMove}</p>
		<p>{SABOTAGE_TEXT.tutorialWatch}</p>
		<p>{SABOTAGE_TEXT.tutorialNoise}</p>
		<p>{SABOTAGE_TEXT.tutorialSabotage}</p>
		<p>{SABOTAGE_TEXT.tutorialPhone}</p>
		<p>{SABOTAGE_TEXT.tutorialStars}</p>
	</TutorialModal>
</GameShell>
