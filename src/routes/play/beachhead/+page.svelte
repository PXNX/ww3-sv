<script lang="ts">
	import { onMount } from 'svelte';
	import BeachheadBase from '#lib/components/BeachheadBase.svelte';
	import BeachheadCanvas from '#lib/components/BeachheadCanvas.svelte';
	import BeachheadMap from '#lib/components/BeachheadMap.svelte';
	import BeachheadWinPanel from '#lib/components/BeachheadWinPanel.svelte';
	import GameOverModal from '#lib/components/GameOverModal.svelte';
	import GameShell from '#lib/components/GameShell.svelte';
	import PauseOverlay from '#lib/components/PauseOverlay.svelte';
	import RotateHint from '#lib/components/RotateHint.svelte';
	import TutorialModal from '#lib/components/TutorialModal.svelte';
	import { buildingName, islandName } from '#lib/components/beachheadText.js';
	import { ISLAND_INCOME } from '#lib/game/beachhead/campaign.js';
	import { prefersReducedMotion } from '#lib/game/loop.js';
	import { m } from '#lib/paraglide/messages.js';
	import { firstPlay } from '#lib/services/tutorial.js';
	import { BeachheadGame } from '#lib/stores/beachheadGame.svelte.js';
	import IconFlag from '~icons/lucide/flag-triangle-right';
	import IconHelp from '~icons/lucide/circle-help';
	import IconList from '~icons/lucide/list';
	import IconMap from '~icons/lucide/map';
	import IconPause from '~icons/lucide/pause';
	import IconPlay from '~icons/lucide/play';
	import IconRotate from '~icons/lucide/rotate-ccw';

	const game = new BeachheadGame({ reducedMotion: prefersReducedMotion() });
	const modeName = m.mode_beachhead_name();

	let showTutorial = $state(false);
	onMount(() => {
		game.load();
		showTutorial = firstPlay('beachhead');
	});

	function openHelp() {
		game.pause();
		showTutorial = true;
	}

	const playing = $derived(game.screen === 'play');
	const running = $derived(game.status === 'playing' || game.status === 'paused');
	const title = $derived(playing ? `${modeName} · ${islandName(game.islandIndex)}` : modeName);
</script>

<GameShell
	{title}
	score={playing ? game.score : undefined}
	best={playing ? game.best : undefined}
	confirmLeave={playing && running}
	backTo={playing ? () => game.goMap() : undefined}
	immersive={playing}
	landscape
>
	{#snippet actions()}
		<button
			type="button"
			class="btn-chunky px-2 py-1 text-sm sm:px-3"
			aria-label={m.beachhead_help_button()}
			onclick={openHelp}
		>
			<IconHelp class="size-4" aria-hidden="true" />
			<span class="hidden sm:inline">{m.beachhead_help_button()}</span>
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
		{:else if !playing}
			<button
				type="button"
				class="btn-chunky px-2 py-1 text-sm sm:px-3"
				onclick={() => game.goBase()}
			>
				<IconFlag class="size-4" aria-hidden="true" />
				<span class="hidden sm:inline">{m.beachhead_base_button()}</span>
			</button>
			<button
				type="button"
				class="btn-chunky px-2 py-1 text-sm sm:px-3"
				onclick={() => game.goMap()}
			>
				<IconMap class="size-4" aria-hidden="true" />
				<span class="hidden sm:inline">{m.beachhead_map_button()}</span>
			</button>
		{:else}
			<button type="button" class="btn-chunky px-3 py-1 text-sm" onclick={() => game.goMap()}>
				<IconList class="size-4" aria-hidden="true" />
				<span class="hidden sm:inline">{m.beachhead_map_button()}</span>
			</button>
		{/if}
	{/snippet}

	{#if playing}
		<!-- Played sideways: the island fills the screen and the HUD floats over the top edge -->
		<div class="relative flex min-h-0 flex-1 flex-col">
			<BeachheadCanvas {game} />

			<div
				class="pointer-events-none absolute inset-x-0 top-[calc(var(--hud-top)+0.15rem)] z-30 flex flex-wrap items-start justify-center gap-1 px-2 font-display text-xs font-bold sm:text-sm"
			>
				{#if game.squadsLeft > 0}
					<span class="rounded-md border-2 border-ink bg-paper px-1.5 py-0.5">
						{m.beachhead_squads({ count: game.squadsLeft })}
					</span>
				{/if}
				<span class="rounded-md border-2 border-ink bg-paper px-1.5 py-0.5">
					{m.beachhead_troops({ count: game.troops })}
				</span>
				{#if game.focusKind}
					<span class="rounded-md border-2 border-ink bg-explosion-yellow px-1.5 py-0.5">
						{m.beachhead_focus({ building: buildingName(game.focusKind) })}
					</span>
				{/if}
				{#if game.squadsLeft === 0}
					<span class="rounded-md border-2 border-ink bg-tie-red px-1.5 py-0.5 text-paper">
						{m.beachhead_no_squads()}
					</span>
				{:else if game.troops === 0}
					<span class="rounded-md border-2 border-ink bg-explosion-yellow px-1.5 py-0.5">
						{m.beachhead_tap_beach()}
					</span>
				{/if}
			</div>

			<RotateHint />

			{#if game.status === 'paused'}
				<PauseOverlay onResume={() => game.resume()} cover>
					<button type="button" class="btn-chunky" onclick={() => game.retry()}>
						<IconRotate class="size-5" aria-hidden="true" />
						{m.beachhead_retry()}
					</button>
					<button type="button" class="btn-chunky" onclick={() => game.goMap()}>
						<IconList class="size-5" aria-hidden="true" />
						{m.beachhead_to_map()}
					</button>
				</PauseOverlay>
			{/if}
		</div>
	{:else if game.screen === 'base'}
		<BeachheadBase {game} />
	{:else}
		<BeachheadMap {game} />
	{/if}

	<TutorialModal
		open={showTutorial}
		title={m.beachhead_tutorial_title()}
		closeLabel={m.beachhead_tutorial_close()}
		onclose={() => (showTutorial = false)}
	>
		<p>{m.beachhead_tutorial_goal()}</p>
		<p>{m.beachhead_tutorial_deploy()}</p>
		<p>{m.beachhead_tutorial_focus()}</p>
		<p>{m.beachhead_tutorial_defences()}</p>
		<p>{m.beachhead_tutorial_stars()}</p>
		<p>{m.beachhead_tutorial_base()}</p>
		<p>{m.beachhead_tutorial_map()}</p>
	</TutorialModal>

	<BeachheadWinPanel
		open={game.status === 'won'}
		score={game.score}
		stars={game.stars}
		alive={game.troops}
		deployed={game.deployed}
		loot={game.loot}
		islandName={islandName(game.islandIndex)}
		taxRate={ISLAND_INCOME[game.islandIndex] ?? 0}
		isNewBest={game.isNewBest}
		hasNext={game.hasNextIsland}
		{modeName}
		drawBoard={game.drawBoard}
		onNext={() => game.openNextIsland()}
		onRetry={() => game.retry()}
		onIslands={() => game.goMap()}
	/>

	<GameOverModal
		open={game.status === 'over'}
		score={game.score}
		mode="beachhead"
		outcome="lost"
		{modeName}
		isNewBest={game.isNewBest}
		title={m.beachhead_lost_title()}
		drawBoard={game.drawBoard}
		onRetry={() => game.retry()}
	>
		<div class="flex flex-col items-center gap-2">
			<dl class="flex justify-center gap-6 font-display">
				<div class="flex flex-col items-center">
					<dt class="text-xs font-bold uppercase">{m.beachhead_lost_title()}</dt>
					<dd class="text-2xl font-bold tabular-nums">
						{m.beachhead_lost_buildings({
							destroyed: game.buildingsTotal - game.buildingsLeft,
							total: game.buildingsTotal
						})}
					</dd>
				</div>
			</dl>
			<p class="text-sm font-semibold">{m.beachhead_lost_hint()}</p>
			<button type="button" class="btn-chunky" onclick={() => game.goMap()}>
				<IconList class="size-5" aria-hidden="true" />
				{m.beachhead_to_map()}
			</button>
		</div>
	</GameOverModal>
</GameShell>
