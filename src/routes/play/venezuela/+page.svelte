<script lang="ts">
	import { onMount } from 'svelte';
	import GameOverModal from '#lib/components/GameOverModal.svelte';
	import GameShell from '#lib/components/GameShell.svelte';
	import RotateHint from '#lib/components/RotateHint.svelte';
	import TutorialModal from '#lib/components/TutorialModal.svelte';
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
				<span class="hidden sm:inline">{m.venezuela_back_to_levels()}</span>
			</button>
		{/if}
	{/snippet}

	{#if playing}
		<!-- Played sideways: the field fills the screen, the HUD and the controls float over it -->
		<div class="relative flex min-h-0 flex-1 flex-col">
			<VenezuelaCanvas {game} levelName={levelName(game.levelIndex)} />
			<RotateHint />
		</div>
	{:else}
		<VenezuelaLevelSelect {game} />
	{/if}

	<TutorialModal
		open={showTutorial}
		title={m.venezuela_tutorial_title()}
		closeLabel={m.venezuela_tutorial_close()}
		onclose={() => (showTutorial = false)}
	>
		<p>{m.venezuela_tutorial_goal()}</p>
		<p>{m.venezuela_tutorial_controls()}</p>
		<p>{m.venezuela_tutorial_jump()}</p>
		<p>{m.venezuela_tutorial_slam()}</p>
		<p>{m.venezuela_tutorial_boosters()}</p>
		<p>{m.venezuela_tutorial_legend()}</p>
		<ul class="flex flex-col gap-2">
			<li class="flex items-center gap-2">
				<VenezuelaIcon kind="barrel" class="size-10 shrink-0" />
				<span><strong>{m.venezuela_barrel_name()}</strong> {m.venezuela_barrel_hint()}</span>
			</li>
			<li class="flex items-center gap-2">
				<VenezuelaIcon kind="goon" class="size-10 shrink-0" />
				<span><strong>{m.venezuela_goon_name()}</strong> {m.venezuela_goon_hint()}</span>
			</li>
			<li class="flex items-center gap-2">
				<VenezuelaIcon kind="heli" class="size-10 shrink-0" />
				<span><strong>{m.venezuela_heli_name()}</strong> {m.venezuela_heli_hint()}</span>
			</li>
			<li class="flex items-center gap-2">
				<VenezuelaIcon kind="spikes" class="size-10 shrink-0" />
				<span><strong>{m.venezuela_spikes_name()}</strong> {m.venezuela_spikes_hint()}</span>
			</li>
			<li class="flex items-center gap-2">
				<VenezuelaIcon kind="block" class="size-10 shrink-0" />
				<span><strong>{m.venezuela_block_name()}</strong> {m.venezuela_block_hint()}</span>
			</li>
			<li class="flex items-center gap-2">
				<VenezuelaIcon kind="arepa" class="size-10 shrink-0" />
				<span><strong>{m.venezuela_arepa_name()}</strong> {m.venezuela_arepa_hint()}</span>
			</li>
			<li class="flex items-center gap-2">
				<VenezuelaIcon kind="turbo" class="size-10 shrink-0" />
				<span><strong>{m.venezuela_turbo_name()}</strong> {m.venezuela_turbo_hint()}</span>
			</li>
			<li class="flex items-center gap-2">
				<VenezuelaIcon kind="boots" class="size-10 shrink-0" />
				<span><strong>{m.venezuela_boots_name()}</strong> {m.venezuela_boots_hint()}</span>
			</li>
			<li class="flex items-center gap-2">
				<VenezuelaIcon kind="star" class="size-10 shrink-0" />
				<span><strong>{m.venezuela_star_name()}</strong> {m.venezuela_star_hint()}</span>
			</li>
			<li class="flex items-center gap-2">
				<VenezuelaIcon kind="spring" class="size-10 shrink-0" />
				<span><strong>{m.venezuela_spring_name()}</strong> {m.venezuela_spring_hint()}</span>
			</li>
			<li class="flex items-center gap-2">
				<VenezuelaIcon kind="barge" class="size-10 shrink-0" />
				<span><strong>{m.venezuela_barge_name()}</strong> {m.venezuela_barge_hint()}</span>
			</li>
			<li class="flex items-center gap-2">
				<VenezuelaIcon kind="flag" class="size-10 shrink-0" />
				<span><strong>{m.venezuela_flag_name()}</strong> {m.venezuela_flag_hint()}</span>
			</li>
		</ul>
		<p>{m.venezuela_tutorial_stars()}</p>
		<p class="hidden text-sm sm:block">{m.venezuela_keyboard_hint()}</p>
	</TutorialModal>

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
