<!--
	GPS Liar: Baltic jamming puts ships on airport runways, and you still have to deliver herring
	and sauna stones. Twelve levels, top-down: sail a small cargo boat through fog, with a chart
	whose position dot lies. Check it against the compass, blinking lighthouses, numbered buoys and
	a gull flock that always flies to land, and use a limited cross-check to see the truth.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import GameOverModal from '#lib/components/GameOverModal.svelte';
	import GameShell from '#lib/components/GameShell.svelte';
	import GpsLiarCanvas from '#lib/components/GpsLiarCanvas.svelte';
	import GpsLiarLevelSelect from '#lib/components/GpsLiarLevelSelect.svelte';
	import GpsLiarWinPanel from '#lib/components/GpsLiarWinPanel.svelte';
	import LivesBar from '#lib/components/LivesBar.svelte';
	import RotateHint from '#lib/components/RotateHint.svelte';
	import TutorialModal from '#lib/components/TutorialModal.svelte';
	import { cargoName, levelName } from '#lib/components/gpsliarText.js';
	import { STARTING_HEARTS } from '#lib/game/gpsliar/config.js';
	import { prefersReducedMotion } from '#lib/game/loop.js';
	import { m } from '#lib/paraglide/messages.js';
	import { firstPlay } from '#lib/services/tutorial.js';
	import { cameoAsset } from '#lib/theme/cameos.js';
	import { GpsLiarGame } from '#lib/stores/gpsliarGame.svelte.js';
	import IconHelp from '~icons/lucide/circle-help';
	import IconList from '~icons/lucide/list';
	import IconPause from '~icons/lucide/pause';
	import IconPlay from '~icons/lucide/play';

	const game = new GpsLiarGame({ reducedMotion: prefersReducedMotion() });
	const modeName = m.mode_gpsliar_name();
	// The game-over cameo is always the lost little cargo boat, never the shared roster
	const lostCameo = {
		image: cameoAsset('gpsliar-boat.svg'),
		alt: m.gpsliar_cameo_alt(),
		message: m.gpsliar_cameo_message(),
		label: m.gpsliar_cameo_label()
	};

	// The how-to-play screen opens on the first visit and whenever the help button is tapped
	let showTutorial = $state(false);
	/** The HUD floats over the playfield; the canvas keeps the lighthouse lights below it */
	let hudHeight = $state(0);
	onMount(() => {
		game.load();
		showTutorial = firstPlay('gpsliar');
	});

	function openHelp() {
		game.pause();
		showTutorial = true;
	}

	const playing = $derived(game.screen === 'play');
	const running = $derived(game.status === 'playing' || game.status === 'paused');
	const title = $derived(
		playing ? `${modeName} · ${m.gpsliar_level_label({ number: game.levelIndex + 1 })}` : modeName
	);
</script>

<GameShell
	{title}
	score={playing ? game.score : undefined}
	best={playing ? game.best : undefined}
	confirmLeave={running}
	immersive={playing}
	landscape
>
	{#snippet actions()}
		<button
			type="button"
			class="btn-chunky px-2 py-1 text-sm sm:px-3"
			aria-label={m.gpsliar_help_button()}
			onclick={openHelp}
		>
			<IconHelp class="size-4" aria-hidden="true" />
			<span class="hidden sm:inline">{m.gpsliar_help_button()}</span>
		</button>
		{#if playing && running}
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
		{#if playing && !running}
			<button
				type="button"
				class="btn-chunky px-3 py-1 text-sm"
				onclick={() => game.backToSelect()}
			>
				<IconList class="size-4" aria-hidden="true" />
				<span class="hidden sm:inline">{m.gpsliar_back_to_levels()}</span>
			</button>
		{/if}
	{/snippet}

	{#if playing}
		<!-- The playfield fills the screen; the HUD floats over its top under the page controls -->
		<section class="relative flex min-h-0 flex-1 flex-col">
			<div
				bind:offsetHeight={hudHeight}
				class="pointer-events-none absolute top-(--hud-top) right-(--hud-right) left-(--hud-left) z-10 mx-auto flex max-w-xl flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-[12px_6px_14px_8px] border-3 border-ink bg-paper px-3 py-1 shadow-[3px_3px_0_var(--color-ink)]"
			>
				<LivesBar lives={game.hearts} max={STARTING_HEARTS} class="shrink-0 text-xl" />
				<p dir="auto" class="font-display text-sm font-bold tabular-nums sm:text-base">
					{m.gpsliar_hud_stops({ done: game.delivered, total: game.stopsTotal })}
				</p>
				{#if game.nextCargo}
					<p dir="auto" class="min-w-0 truncate text-sm font-semibold">
						{m.gpsliar_hud_next({ cargo: cargoName(game.nextCargo) })}
					</p>
				{/if}
				<p dir="auto" class="font-display text-sm font-bold tabular-nums sm:text-base">
					{m.gpsliar_hud_time({ seconds: game.seconds, par: game.par })}
				</p>
			</div>

			<GpsLiarCanvas {game} levelName={levelName(game.levelIndex)} {hudHeight} />
			<RotateHint onportrait={(upright) => upright && game.pause()} />
		</section>
	{:else}
		<GpsLiarLevelSelect {game} />
	{/if}

	<TutorialModal
		open={showTutorial}
		title={m.gpsliar_tutorial_title()}
		closeLabel={m.gpsliar_tutorial_close()}
		onclose={() => (showTutorial = false)}
	>
		<p>{m.gpsliar_tutorial_goal()}</p>
		<p>{m.gpsliar_tutorial_steer()}</p>
		<p>{m.gpsliar_tutorial_chart()}</p>
		<p>{m.gpsliar_tutorial_truth()}</p>
		<p>{m.gpsliar_tutorial_cross_check()}</p>
		<p>{m.gpsliar_tutorial_hazards()}</p>
		<p>{m.gpsliar_tutorial_stars()}</p>
		<p class="hidden text-sm sm:block">{m.gpsliar_tutorial_keys()}</p>
	</TutorialModal>

	<GpsLiarWinPanel
		open={game.status === 'won'}
		score={game.score}
		stars={game.stars}
		seconds={game.seconds}
		par={game.par}
		hearts={game.hearts}
		crossChecksUsed={game.crossChecksUsed}
		isNewBest={game.isNewBest}
		hasNext={game.hasNextLevel}
		{modeName}
		drawBoard={game.drawBoard}
		onNext={() => game.nextLevel()}
		onRetry={() => game.retry()}
		onLevels={() => game.backToSelect()}
	/>

	<GameOverModal
		open={game.status === 'over'}
		score={game.score}
		mode="gpsliar"
		withCharacter={false}
		{modeName}
		isNewBest={game.isNewBest}
		title={m.gpsliar_gameover_title()}
		customCameo={lostCameo}
		drawBoard={game.drawBoard}
		onRetry={() => game.retry()}
	>
		<div class="flex flex-col items-center gap-2">
			<dl class="grid w-full grid-cols-2 gap-2 font-display text-sm">
				<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
					<dt class="font-bold">{m.gpsliar_stat_stops()}</dt>
					<dd class="text-2xl font-bold tabular-nums">{game.delivered}/{game.stopsTotal}</dd>
				</div>
				<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
					<dt class="font-bold">{m.gpsliar_stat_checks()}</dt>
					<dd class="text-2xl font-bold tabular-nums">{game.crossChecksUsed}</dd>
				</div>
			</dl>
			<button type="button" class="btn-chunky" onclick={() => game.backToSelect()}>
				<IconList class="size-5" aria-hidden="true" />
				{m.gpsliar_back_to_levels()}
			</button>
		</div>
	</GameOverModal>
</GameShell>
