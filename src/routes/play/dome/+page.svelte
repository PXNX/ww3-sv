<!--
	Iron Dome Juggler (roadmap 3.16): tap-to-intercept arcs with prioritization. Rockets arc toward a
	small cartoon city; a faint dotted line shows where each one will land. Tap a rocket to launch one
	of your few interceptors at it. Save the high-value buildings first and never waste a shot on a
	rocket that lands in the sea or a field. Hits on a building cost hearts, waves keep getting faster.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import DomeCanvas from '#lib/components/DomeCanvas.svelte';
	import GameOverModal from '#lib/components/GameOverModal.svelte';
	import GameShell from '#lib/components/GameShell.svelte';
	import LivesBar from '#lib/components/LivesBar.svelte';
	import TutorialModal from '#lib/components/TutorialModal.svelte';
	import { MAX_AMMO, STARTING_LIVES } from '#lib/game/dome/config.js';
	import { prefersReducedMotion } from '#lib/game/loop.js';
	import { m } from '#lib/paraglide/messages.js';
	import { firstPlay } from '#lib/services/tutorial.js';
	import { DomeGame } from '#lib/stores/domeGame.svelte.js';
	import { cameoAsset } from '#lib/theme/cameos.js';
	import IconHelp from '~icons/lucide/circle-help';
	import IconPause from '~icons/lucide/pause';
	import IconPlay from '~icons/lucide/play';

	const game = new DomeGame({ reducedMotion: prefersReducedMotion() });
	const modeName = m.mode_dome_name();

	// The how-to-play screen opens on the first visit and whenever the help button is tapped
	let showTutorial = $state(false);
	onMount(() => {
		game.loadBest();
		showTutorial = firstPlay('dome');
	});

	function openHelp() {
		game.pause();
		showTutorial = true;
	}

	// Game over: the operator on duty files a report, depending on how the shift went
	const cameoMessage = $derived(
		game.wasted >= 4 && game.wasted > game.intercepts / 2
			? m.dome_cameo_message_wasteful()
			: game.wave >= 6
				? m.dome_cameo_message_far()
				: m.dome_cameo_message_default()
	);
	const cameo = $derived({
		image: cameoAsset('dome-operator.svg'),
		alt: m.dome_cameo_alt(),
		message: cameoMessage,
		label: m.dome_cameo_label()
	});

	const pips = Array.from({ length: MAX_AMMO }, (_, index) => index);
</script>

<GameShell
	title={modeName}
	score={game.score}
	best={game.best}
	confirmLeave={game.status === 'playing' || game.status === 'paused'}
>
	{#snippet actions()}
		<button
			type="button"
			class="btn-chunky px-2 py-1 text-sm sm:px-3"
			aria-label={m.dome_help_button()}
			onclick={openHelp}
		>
			<IconHelp class="size-4" aria-hidden="true" />
			<span class="hidden sm:inline">{m.dome_help_button()}</span>
		</button>
		{#if game.status === 'playing' || game.status === 'paused'}
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

	<section class="mx-auto flex w-full max-w-3xl flex-col items-center gap-2">
		<div
			class="flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-[12px_6px_14px_8px] border-3 border-ink bg-paper px-3 py-2 shadow-[3px_3px_0_var(--color-ink)]"
		>
			<LivesBar lives={game.lives} max={STARTING_LIVES} class="shrink-0 text-xl" />
			<div class="flex items-center gap-2">
				<p dir="auto" class="font-display text-xs font-bold sm:text-sm" aria-hidden="true">
					{m.dome_hud_ammo()}
				</p>
				<div
					class="flex items-center gap-1"
					role="img"
					aria-label={m.dome_ammo_label({ loaded: game.loaded, max: MAX_AMMO })}
					dir="ltr"
				>
					{#each pips as pip (pip)}
						<span
							class="relative h-5 w-3 overflow-hidden rounded-[3px] border-2 border-ink {pip <
							game.loaded
								? 'bg-explosion-yellow'
								: 'bg-sand'}"
						>
							{#if pip === game.loaded}
								<span
									class="absolute inset-x-0 bottom-0 bg-explosion-yellow/70"
									style:height="{game.reloadPercent}%"
								></span>
							{/if}
						</span>
					{/each}
				</div>
			</div>
			<p dir="auto" class="font-display text-sm font-bold tabular-nums sm:text-base">
				{m.dome_hud_wave({ wave: Math.max(1, game.wave) })}
			</p>
			<p
				dir="auto"
				class="font-display text-sm font-bold tabular-nums sm:text-base"
				class:opacity-40={game.combo === 0}
			>
				{m.dome_hud_combo({ combo: game.combo, multiplier: game.multiplier })}
			</p>
			{#if game.blackout}
				<p
					dir="auto"
					class="w-full rounded-md border-2 border-ink bg-tie-red px-2 py-0.5 text-center font-display text-xs font-bold text-paper"
					role="status"
				>
					{m.dome_blackout_label()}
				</p>
			{/if}
		</div>

		<DomeCanvas {game} />
	</section>

	<TutorialModal
		open={showTutorial}
		title={m.dome_tutorial_title()}
		closeLabel={m.dome_tutorial_close()}
		onclose={() => (showTutorial = false)}
	>
		<p>{m.dome_tutorial_goal()}</p>
		<p>{m.dome_tutorial_tap()}</p>
		<p>{m.dome_tutorial_value()}</p>
		<p>{m.dome_tutorial_harmless()}</p>
		<p>{m.dome_tutorial_ammo()}</p>
		<p>{m.dome_tutorial_power()}</p>
		<p>{m.dome_tutorial_combo()}</p>
		<p>{m.dome_tutorial_keys()}</p>
	</TutorialModal>

	<GameOverModal
		open={game.status === 'over'}
		score={game.score}
		mode="dome"
		{modeName}
		isNewBest={game.isNewBest}
		title={m.dome_gameover_title()}
		customCameo={cameo}
		drawBoard={game.drawBoard}
		onRetry={() => game.start()}
	>
		<dl class="grid grid-cols-2 gap-2 font-display text-sm sm:grid-cols-4">
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="font-bold">{m.dome_stat_wave()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{game.wave}</dd>
			</div>
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="font-bold">{m.dome_stat_intercepts()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{game.intercepts}</dd>
			</div>
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="font-bold">{m.dome_stat_wasted()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{game.wasted}</dd>
			</div>
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="font-bold">{m.dome_stat_combo()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{game.bestCombo}</dd>
			</div>
		</dl>
	</GameOverModal>
</GameShell>
