<!--
	Maple Reserve Heist: the 2012 theft of the strategic maple syrup reserve of Quebec, as a
	top-down stealth puzzle. Ten levels: push a barrel cart through the warehouse aisles, collect
	barrels (the cart grows like a snake and gets heavy), and deliver them to the truck while moose
	guards with vision cones patrol. Every move is one tick and the moose step with you. A moose
	that spots the cart says "Sorry!", takes a heart and the barrels back. Turn based, so there is
	no pause.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import GameOverModal from '#lib/components/GameOverModal.svelte';
	import GameShell from '#lib/components/GameShell.svelte';
	import LivesBar from '#lib/components/LivesBar.svelte';
	import MapleField from '#lib/components/MapleField.svelte';
	import MapleLevelSelect from '#lib/components/MapleLevelSelect.svelte';
	import MapleWinPanel from '#lib/components/MapleWinPanel.svelte';
	import MazeDpad from '#lib/components/MazeDpad.svelte';
	import TutorialModal from '#lib/components/TutorialModal.svelte';
	import { prefersReducedMotion } from '#lib/game/loop.js';
	import { m } from '#lib/paraglide/messages.js';
	import { firstPlay } from '#lib/services/tutorial.js';
	import { cameoAsset } from '#lib/theme/cameos.js';
	import { MapleGame } from '#lib/stores/mapleGame.svelte.js';
	import IconHelp from '~icons/lucide/circle-help';
	import IconHourglass from '~icons/lucide/hourglass';
	import IconLeaf from '~icons/lucide/leaf';
	import IconList from '~icons/lucide/list';
	import IconRotate from '~icons/lucide/rotate-ccw';

	const game = new MapleGame({ reducedMotion: prefersReducedMotion() });
	const modeName = m.mode_maple_name();
	// The game-over cameo is always the apologetic moose, never the shared roster
	const sorryCameo = {
		image: cameoAsset('maple-moose.svg'),
		alt: m.maple_cameo_alt(),
		message: m.maple_cameo_message(),
		label: m.maple_cameo_label()
	};

	// The how-to-play screen opens on the first visit and whenever the help button is tapped
	let showTutorial = $state(false);
	onMount(() => {
		game.load();
		showTutorial = firstPlay('maple');
	});

	const playing = $derived(game.screen === 'play');
	const running = $derived(game.status === 'playing');
	const title = $derived(
		playing ? `${modeName} · ${m.maple_level_label({ number: game.levelIndex + 1 })}` : modeName
	);
	const level = $derived(game.state.level);
</script>

<GameShell
	{title}
	score={playing ? game.score : undefined}
	best={playing ? game.best : undefined}
	confirmLeave={playing && running && game.moves > 0}
>
	{#snippet actions()}
		<button
			type="button"
			class="btn-chunky px-2 py-1 text-sm sm:px-3"
			aria-label={m.maple_help_button()}
			onclick={() => (showTutorial = true)}
		>
			<IconHelp class="size-4" aria-hidden="true" />
			<span class="hidden sm:inline">{m.maple_help_button()}</span>
		</button>
		{#if playing}
			<button
				type="button"
				class="btn-chunky px-3 py-1 text-sm"
				onclick={() => game.backToSelect()}
			>
				<IconList class="size-4" aria-hidden="true" />
				<span class="hidden sm:inline">{m.maple_back_to_levels()}</span>
			</button>
		{/if}
	{/snippet}

	{#if playing}
		<!-- The HUD, the banner, the warehouse and the buttons share one width, as wide as the height allows -->
		<section
			class="mx-auto flex w-full flex-col items-center gap-2"
			style:max-width="max(18rem, min(100%, calc((100dvh - 24rem) * {level.width / level.height})))"
		>
			<div
				class="flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-[12px_6px_14px_8px] border-3 border-ink bg-paper px-3 py-1 shadow-[3px_3px_0_var(--color-ink)]"
			>
				<LivesBar lives={game.hearts} max={game.maxHearts} class="shrink-0 text-xl" />
				<p dir="auto" class="font-display text-sm font-bold tabular-nums sm:text-base">
					{m.maple_hud_barrels({
						delivered: game.delivered,
						quota: game.quota,
						total: game.totalBarrels
					})}
				</p>
				<p dir="auto" class="text-sm font-semibold tabular-nums">
					{m.maple_hud_tow({ count: game.inTow })}
				</p>
				<p dir="auto" class="font-display text-sm font-bold tabular-nums sm:text-base">
					{m.maple_hud_moves({ moves: game.moves, par: game.par })}
				</p>
			</div>

			<!-- The sign on the warehouse wall -->
			<p
				dir="auto"
				class="flex -rotate-1 items-center gap-1.5 rounded-md border-3 border-ink bg-tie-red px-3 py-0.5 font-display text-sm font-bold text-paper shadow-[2px_2px_0_var(--color-ink)]"
			>
				<IconLeaf class="size-4 shrink-0" aria-hidden="true" />
				{m.maple_banner()}
			</p>

			<MapleField {game} active={!showTutorial} />

			<p role="status" dir="auto" class="min-h-6 text-center font-display text-base font-bold">
				{game.message}
			</p>

			<div class="flex flex-wrap items-center justify-center gap-3">
				<MazeDpad onmove={(direction) => game.step(direction)} disabled={!running} />
				<div class="flex flex-col gap-2">
					<button
						type="button"
						class="btn-chunky px-3 py-1 text-sm"
						disabled={!running}
						onclick={() => game.waitTick()}
					>
						<IconHourglass class="size-4" aria-hidden="true" />
						{m.maple_wait()}
					</button>
					<button
						type="button"
						class="btn-chunky px-3 py-1 text-sm"
						disabled={game.moves === 0}
						onclick={() => game.retry()}
					>
						<IconRotate class="size-4" aria-hidden="true" />
						{m.maple_restart()}
					</button>
				</div>
			</div>
			<p class="hidden text-center text-sm sm:block">{m.maple_controls_hint()}</p>
		</section>
	{:else}
		<MapleLevelSelect {game} />
	{/if}

	<TutorialModal
		open={showTutorial}
		title={m.maple_tutorial_title()}
		closeLabel={m.maple_tutorial_close()}
		onclose={() => (showTutorial = false)}
	>
		<p>{m.maple_tutorial_goal()}</p>
		<p>{m.maple_tutorial_steer()}</p>
		<p>{m.maple_tutorial_cart()}</p>
		<p>{m.maple_tutorial_guards()}</p>
		<p>{m.maple_tutorial_spotted()}</p>
		<p>{m.maple_tutorial_stars()}</p>
		<p class="hidden text-sm sm:block">{m.maple_tutorial_keys()}</p>
	</TutorialModal>

	<MapleWinPanel
		open={playing && game.status === 'won'}
		score={game.score}
		stars={game.stars}
		moves={game.moves}
		par={game.par}
		delivered={game.delivered}
		totalBarrels={game.totalBarrels}
		spotted={game.spotted}
		isNewBest={game.isNewBest}
		hasNext={game.hasNextLevel}
		{modeName}
		drawBoard={game.drawBoard}
		onNext={() => game.nextLevel()}
		onRetry={() => game.retry()}
		onLevels={() => game.backToSelect()}
	/>

	<GameOverModal
		open={playing && game.status === 'over'}
		score={game.score}
		mode="maple"
		withCharacter={false}
		{modeName}
		isNewBest={game.isNewBest}
		title={m.maple_gameover_title()}
		customCameo={sorryCameo}
		drawBoard={game.drawBoard}
		onRetry={() => game.retry()}
	>
		<div class="flex flex-col items-center gap-2">
			<dl class="grid w-full grid-cols-2 gap-2 font-display text-sm">
				<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
					<dt class="font-bold">{m.maple_stat_barrels()}</dt>
					<dd class="text-2xl font-bold tabular-nums">{game.delivered}/{game.totalBarrels}</dd>
				</div>
				<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
					<dt class="font-bold">{m.maple_stat_spotted()}</dt>
					<dd class="text-2xl font-bold tabular-nums">{game.spotted}</dd>
				</div>
			</dl>
			<button type="button" class="btn-chunky" onclick={() => game.backToSelect()}>
				<IconList class="size-5" aria-hidden="true" />
				{m.maple_back_to_levels()}
			</button>
		</div>
	</GameOverModal>
</GameShell>
