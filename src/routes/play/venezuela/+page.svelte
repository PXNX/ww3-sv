<script lang="ts">
	import { onMount } from 'svelte';
	import GameOverModal from '#lib/components/GameOverModal.svelte';
	import GameShell from '#lib/components/GameShell.svelte';
	import RotateHint from '#lib/components/RotateHint.svelte';
	import InteractiveTutorial from '#lib/components/InteractiveTutorial.svelte';
	import VenezuelaCanvas from '#lib/components/VenezuelaCanvas.svelte';
	import VenezuelaIcon from '#lib/components/VenezuelaIcon.svelte';
	import VenezuelaLevelSelect from '#lib/components/VenezuelaLevelSelect.svelte';
	import VenezuelaWinPanel from '#lib/components/VenezuelaWinPanel.svelte';
	import { levelName } from '#lib/components/venezuelaText.js';
	import { prefersReducedMotion } from '#lib/game/loop.js';
	import { m } from '#lib/paraglide/messages.js';
	import { firstPlay } from '#lib/services/tutorial.js';
	import { cameoAsset } from '#lib/theme/cameos.js';
	import { VenezuelaGame } from '#lib/stores/venezuelaGame.svelte.js';
	import IconHelp from '~icons/lucide/circle-help';
	import IconList from '~icons/lucide/list';
	import IconPause from '~icons/lucide/pause';
	import IconPlay from '~icons/lucide/play';
	import { tutorialSteps } from './tutorial.js';

	const game = new VenezuelaGame({ reducedMotion: prefersReducedMotion() });
	const modeName = m.mode_venezuela_name();
	// The game-over cameo is always the hero's own dizzy face, never the shared roster
	const dizzyCameo = {
		image: cameoAsset('venezuela-presidente.svg'),
		alt: m.venezuela_cameo_alt(),
		message: m.venezuela_cameo_message(),
		label: m.venezuela_cameo_label()
	};

	// The how-to-play screen opens on the first visit and whenever the help button is tapped
	let showTutorial = $state(false);
	onMount(() => {
		game.load();
		showTutorial = firstPlay('venezuela');
	});

	function openHelp() {
		game.pause();
		showTutorial = true;
	}

	const playing = $derived(game.screen === 'play');
	const running = $derived(game.status === 'playing' || game.status === 'paused');
	const title = $derived(
		playing ? `${modeName} · ${m.venezuela_level_label({ number: game.levelIndex + 1 })}` : modeName
	);
</script>

<GameShell
	{title}
	score={playing ? game.score : undefined}
	best={playing ? game.best : undefined}
	confirmLeave={running}
	backTo={playing ? () => game.backToSelect() : undefined}
	immersive={playing}
	landscape
>
	{#snippet actions()}
		<button
			type="button"
			class="btn-chunky px-2 py-1 text-sm sm:px-3"
			aria-label={m.venezuela_help_button()}
			onclick={openHelp}
		>
			<IconHelp class="size-4" aria-hidden="true" />
			<span class="hidden sm:inline">{m.venezuela_help_button()}</span>
		</button>
		{#if playing && running}
			<button
				type="button"
				class="btn-chunky px-2 py-1 text-sm sm:px-3"
				aria-label={game.status === 'paused' ? m.game_resume() : m.game_pause()}
				title={game.status === 'paused' ? m.game_resume() : m.game_pause()}
				onclick={() => game.togglePause()}
			>
				{#if game.status === 'paused'}
					<IconPlay class="size-4" aria-hidden="true" />
					<span class="hidden sm:inline">{m.game_resume()}</span>
				{:else}
					<IconPause class="size-4" aria-hidden="true" />
					<span class="hidden sm:inline">{m.game_pause()}</span>
				{/if}
			</button>
		{/if}
		{#if playing && !running}
			<button
				type="button"
				class="btn-chunky px-2 py-1 text-sm sm:px-3"
				aria-label={m.venezuela_back_to_levels()}
				title={m.venezuela_back_to_levels()}
				onclick={() => game.backToSelect()}
			>
				<IconList class="size-4" aria-hidden="true" />
				<span class="hidden sm:inline">{m.venezuela_back_to_levels()}</span>
			</button>
		{/if}
	{/snippet}

	{#if playing}
		<!-- Played sideways: the field fills the screen, the HUD and the controls float over it -->
		<div data-tutorial="playfield" class="relative flex min-h-0 flex-1 flex-col">
			<VenezuelaCanvas {game} levelName={levelName(game.levelIndex)} />
			<RotateHint />
		</div>
	{:else}
		<div data-tutorial="playfield" class="flex min-h-0 flex-1 flex-col">
			<VenezuelaLevelSelect {game} />
		</div>
	{/if}

	<InteractiveTutorial
		open={showTutorial}
		title={m.venezuela_tutorial_title()}
		steps={tutorialSteps}
		closeLabel={m.venezuela_tutorial_close()}
		onclose={() => (showTutorial = false)}
	/>

	<VenezuelaWinPanel
		open={game.status === 'won'}
		score={game.score}
		stars={game.stars}
		barrels={game.barrels}
		barrelsTotal={game.barrelsTotal}
		hearts={game.hearts}
		goons={game.goons}
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
		mode="venezuela"
		withCharacter={false}
		{modeName}
		isNewBest={game.isNewBest}
		title={m.venezuela_gameover_title()}
		customCameo={dizzyCameo}
		drawBoard={game.drawBoard}
		onRetry={() => game.retry()}
	>
		<div class="flex flex-col items-center gap-2">
			<dl class="grid w-full grid-cols-2 gap-2 font-display text-sm">
				<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
					<dt class="font-bold">{m.venezuela_stat_barrels()}</dt>
					<dd class="text-2xl font-bold tabular-nums">{game.barrels}/{game.barrelsTotal}</dd>
				</div>
				<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
					<dt class="font-bold">{m.venezuela_stat_goons()}</dt>
					<dd class="text-2xl font-bold tabular-nums">{game.goons}</dd>
				</div>
			</dl>
			<button type="button" class="btn-chunky" onclick={() => game.backToSelect()}>
				<IconList class="size-5" aria-hidden="true" />
				{m.venezuela_back_to_levels()}
			</button>
		</div>
	</GameOverModal>
</GameShell>
