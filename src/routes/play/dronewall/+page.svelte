<script lang="ts">
	import { onMount } from 'svelte';
	import DroneWallCanvas from '#lib/components/DroneWallCanvas.svelte';
	import DroneWallDefense from '#lib/components/DroneWallDefense.svelte';
	import DroneWallMapPicker from '#lib/components/DroneWallMapPicker.svelte';
	import GameOverModal from '#lib/components/GameOverModal.svelte';
	import GameShell from '#lib/components/GameShell.svelte';
	import LivesBar from '#lib/components/LivesBar.svelte';
	import TutorialModal from '#lib/components/TutorialModal.svelte';
	import { STARTING_LIVES } from '#lib/game/dronewall/config.js';
	import { prefersReducedMotion } from '#lib/game/loop.js';
	import { m } from '#lib/paraglide/messages.js';
	import { firstPlay } from '#lib/services/tutorial.js';
	import { DroneWallGame } from '#lib/stores/dronewallGame.svelte.js';
	import IconFastForward from '~icons/lucide/fast-forward';
	import IconHelp from '~icons/lucide/circle-help';
	import IconPause from '~icons/lucide/pause';
	import IconPlay from '~icons/lucide/play';

	const game = new DroneWallGame({ reducedMotion: prefersReducedMotion() });
	const modeName = m.mode_dronewall_name();

	// The how-to-play screen opens on the first visit and whenever the help button is tapped
	let showTutorial = $state(false);
	onMount(() => {
		game.loadBest();
		showTutorial = firstPlay('dronewall');
	});

	const waveStatus = $derived(
		game.phase === 'prep'
			? game.wave === 0
				? m.dronewall_first_wave_in({ seconds: game.prepSeconds })
				: m.dronewall_next_wave_in({ wave: game.wave + 1, seconds: game.prepSeconds })
			: m.dronewall_wave({ wave: game.wave })
	);
</script>

<GameShell title={modeName} score={game.score} best={game.best}>
	{#snippet actions()}
		<button
			type="button"
			class="btn-chunky px-2 py-1 text-sm sm:px-3"
			aria-label={m.dronewall_help_button()}
			onclick={() => (showTutorial = true)}
		>
			<IconHelp class="size-4" aria-hidden="true" />
			<span class="hidden sm:inline">{m.dronewall_help_button()}</span>
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

	<!-- The HUD, the playfield and the build panel share one width, as wide as the height allows -->
	<section
		class="mx-auto flex w-full flex-col items-center gap-2"
		style:max-width="max(17rem, min(100%, calc((100dvh - 13.5rem) * 0.5625)))"
	>
		<div
			class="flex w-full items-center gap-3 rounded-[12px_6px_14px_8px] border-3 border-ink bg-paper px-3 py-1 shadow-[3px_3px_0_var(--color-ink)]"
		>
			<!-- One button, three speeds: x1, x2, x4 -->
			<button
				type="button"
				class="btn-chunky shrink-0 gap-1 px-2 py-0.5 text-base tabular-nums {game.speed > 1
					? 'bg-explosion-yellow'
					: ''}"
				aria-label={m.dronewall_speed_label({ speed: game.speed })}
				onclick={() => game.cycleSpeed()}
			>
				<IconFastForward class="size-4" aria-hidden="true" />
				<span aria-hidden="true">×{game.speed}</span>
			</button>

			<p
				dir="auto"
				class="min-h-8 flex-1 text-center font-display text-sm leading-tight font-bold sm:text-lg"
				aria-live="off"
			>
				{waveStatus}
			</p>

			<LivesBar lives={game.lives} max={STARTING_LIVES} class="shrink-0 text-xl" />
		</div>

		<DroneWallCanvas {game} />
	</section>

	<TutorialModal
		open={showTutorial}
		title={m.dronewall_tutorial_title()}
		closeLabel={m.dronewall_tutorial_close()}
		onclose={() => (showTutorial = false)}
	>
		<p>{m.dronewall_tutorial_goal()}</p>
		<p>{m.dronewall_tutorial_build()}</p>
		<p>{m.dronewall_tutorial_helmets()}</p>
		<p>{m.dronewall_tutorial_air()}</p>
		<p>{m.dronewall_tutorial_armor()}</p>
		<ul class="flex flex-col gap-2">
			<li class="flex items-center gap-2">
				<DroneWallDefense kind="squad" class="size-9 shrink-0" />
				<span>
					<strong>{m.dronewall_squad_name()}</strong>: {m.dronewall_squad_role()}
				</span>
			</li>
			<li class="flex items-center gap-2">
				<DroneWallDefense kind="mortar" class="size-9 shrink-0" />
				<span>
					<strong>{m.dronewall_mortar_name()}</strong>: {m.dronewall_mortar_role()}
				</span>
			</li>
			<li class="flex items-center gap-2">
				<DroneWallDefense kind="nest" class="size-9 shrink-0" />
				<span>
					<strong>{m.dronewall_nest_name()}</strong>: {m.dronewall_nest_role()}
				</span>
			</li>
			<li class="flex items-center gap-2">
				<DroneWallDefense kind="patriot" class="size-9 shrink-0" />
				<span>
					<strong>{m.dronewall_patriot_name()}</strong>: {m.dronewall_patriot_role()}
				</span>
			</li>
			<li class="flex items-center gap-2">
				<DroneWallDefense kind="azov" class="size-9 shrink-0" />
				<span>
					<strong>{m.dronewall_azov_name()}</strong>: {m.dronewall_azov_role()}
				</span>
			</li>
			<li class="flex items-center gap-2">
				<DroneWallDefense kind="leopard" class="size-9 shrink-0" />
				<span>
					<strong>{m.dronewall_leopard_name()}</strong>: {m.dronewall_leopard_role()}
				</span>
			</li>
			<li class="flex items-center gap-2">
				<DroneWallDefense kind="trench" class="size-9 shrink-0" />
				<span>
					<strong>{m.dronewall_trench_name()}</strong>: {m.dronewall_trench_role()}
				</span>
			</li>
		</ul>
		<p>{m.dronewall_tutorial_speed()}</p>
		<p class="hidden text-sm sm:block">{m.dronewall_keyboard_hint()}</p>
	</TutorialModal>

	<GameOverModal
		open={game.status === 'over'}
		score={game.score}
		{modeName}
		isNewBest={game.isNewBest}
		title={m.dronewall_gameover_title()}
		drawBoard={game.drawBoard}
		onRetry={() => game.start()}
	>
		<dl class="grid grid-cols-2 gap-2 font-display text-sm">
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="font-bold">{m.dronewall_wave_reached()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{game.wave}</dd>
			</div>
			{#if game.bestWave}
				<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
					<dt class="font-bold">{m.dronewall_best_wave()}</dt>
					<dd class="text-2xl font-bold tabular-nums">{game.bestWave}</dd>
				</div>
			{/if}
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="font-bold">{m.dronewall_stat_kills()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{game.kills}</dd>
			</div>
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="font-bold">{m.dronewall_stat_helmets()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{game.collected}</dd>
			</div>
		</dl>
		<DroneWallMapPicker {game} />
	</GameOverModal>
</GameShell>
