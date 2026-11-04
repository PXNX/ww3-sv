<!--
	Starlink Kill Switch: you are Elon at the big red console. Drones fly in from the left towards
	the refinery, every one on a Starlink link. Tap a drone to cut it (that spends link energy), leave
	the civilians alone, charge the geofence with clean cuts and read Elon's posts, because some of
	them change the rules. Eight waves, three hearts, up to three stars.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import GameOverModal from '#lib/components/GameOverModal.svelte';
	import GameShell from '#lib/components/GameShell.svelte';
	import KillswitchCanvas from '#lib/components/KillswitchCanvas.svelte';
	import LivesBar from '#lib/components/LivesBar.svelte';
	import { STARTING_LIVES, WAVE_COUNT } from '#lib/game/killswitch/state.js';
	import MazeStars from '#lib/components/MazeStars.svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { KillswitchGame } from '#lib/stores/killswitchGame.svelte.js';
	import IconPause from '~icons/lucide/pause';
	import IconPlay from '~icons/lucide/play';
	import IconSatellite from '~icons/lucide/satellite-dish';
	import IconZap from '~icons/lucide/zap';

	const game = new KillswitchGame();
	const modeName = m.mode_killswitch_name();

	onMount(() => {
		game.loadBest();
	});
</script>

{#snippet hud()}
	<LivesBar lives={game.lives} max={STARTING_LIVES} class="shrink-0 text-xl" />

	<p
		class="flex min-w-0 flex-1 flex-wrap items-center gap-1 font-display text-sm font-bold whitespace-nowrap tabular-nums"
		aria-live="off"
	>
		<span class="rounded-md border-2 border-ink bg-paper px-1.5">
			{m.killswitch_wave({ wave: game.wave, total: WAVE_COUNT })}
		</span>
		{#key game.multiplier}
			<span
				class="pop-in inline-block rounded-md border-2 border-ink px-1.5 {game.multiplier > 1
					? 'bg-explosion-yellow'
					: 'bg-sand'}"
			>
				{m.killswitch_streak({ multiplier: game.multiplier })}
			</span>
		{/key}
		{#if game.rush}
			<span class="rounded-md border-2 border-ink bg-tie-red px-1.5 text-paper">
				{m.killswitch_chip_rush()}
			</span>
		{/if}
		{#if game.unlimited}
			<span class="rounded-md border-2 border-ink bg-cyan-300 px-1.5">
				{m.killswitch_chip_unlimited()}
			</span>
		{/if}
		{#if game.boost}
			<span class="rounded-md border-2 border-ink bg-mustard px-1.5">
				{m.killswitch_chip_boost()}
			</span>
		{/if}
	</p>

	<!-- Link energy: every cut spends some, it refills on its own -->
	<div
		class="relative h-5 w-16 shrink-0 overflow-hidden rounded-md border-2 border-ink bg-sand sm:w-24"
		role="meter"
		aria-label={m.killswitch_energy()}
		aria-valuemin={0}
		aria-valuemax={100}
		aria-valuenow={Math.round(game.energy * 100)}
	>
		<span
			class="absolute inset-y-0 start-0 {game.unlimited
				? 'bg-cyan-300'
				: game.energy < 0.2
					? 'bg-tie-red'
					: 'bg-mustard'}"
			style:width="{Math.round(game.energy * 100)}%"
		></span>
		<IconZap class="relative mx-auto size-4" aria-hidden="true" />
	</div>

	<button
		type="button"
		class="btn-chunky relative min-h-11 overflow-hidden px-3 py-1 text-sm {game.fenceArmed
			? 'bg-explosion-yellow'
			: ''}"
		disabled={game.status !== 'playing' || game.charge < 1}
		aria-pressed={game.fenceArmed}
		onclick={() => game.armFence()}
	>
		<span
			class="absolute inset-y-0 start-0 bg-cyan-300/60"
			style:width="{Math.round(game.charge * 100)}%"
			aria-hidden="true"
		></span>
		<span class="relative flex items-center gap-1">
			<IconSatellite class="size-4" aria-hidden="true" />
			{game.fenceStanding ? m.killswitch_fence_standing() : m.killswitch_fence()}
		</span>
	</button>
{/snippet}

<GameShell
	title={modeName}
	wide
	score={game.score}
	best={game.best}
	confirmLeave={game.status === 'playing' || game.status === 'paused'}
>
	{#snippet actions()}
		<!-- On short (sideways phone) screens the HUD moves up beside the buttons to save height -->
		<div
			class="hidden items-center gap-3 rounded-[10px_6px_12px_8px] border-3 border-ink bg-paper px-2 py-1 shadow-[3px_3px_0_var(--color-ink)] [@media(max-height:520px)]:flex"
		>
			{@render hud()}
		</div>
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

	<!-- The HUD and the canvas share one width: as wide as the screen allows, within the height -->
	<section
		class="mx-auto flex w-full flex-col items-center gap-2 [--chrome:11rem] [@media(max-height:520px)]:[--chrome:6.5rem]"
		style:max-width="min(100%, 48rem, calc((100dvh - var(--chrome)) * 1.52))"
	>
		<div
			class="flex w-full items-center gap-3 rounded-[12px_6px_14px_8px] border-3 border-ink bg-paper px-3 py-1.5 shadow-[3px_3px_0_var(--color-ink)] [@media(max-height:520px)]:hidden"
		>
			{@render hud()}
		</div>

		<KillswitchCanvas {game} />
	</section>

	<GameOverModal
		open={game.status === 'over'}
		score={game.score}
		mode="killswitch"
		{modeName}
		isNewBest={game.isNewBest}
		outcome={game.won ? 'won' : 'lost'}
		title={game.won ? m.killswitch_victory_title() : m.killswitch_gameover_title()}
		drawBoard={game.drawBoard}
		onRetry={() => game.start()}
	>
		{#if game.won}
			<div class="mb-2 flex justify-center"><MazeStars stars={game.stars} class="size-10" /></div>
		{/if}
		<dl class="flex flex-wrap justify-center gap-x-6 gap-y-2 font-display">
			<div class="flex flex-col items-center">
				<dt class="text-xs font-bold uppercase">{m.killswitch_stat_wave()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{game.wave}/{WAVE_COUNT}</dd>
			</div>
			<div class="flex flex-col items-center">
				<dt class="text-xs font-bold uppercase">{m.killswitch_stat_cuts()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{game.cuts}</dd>
			</div>
			<div class="flex flex-col items-center">
				<dt class="text-xs font-bold uppercase">{m.killswitch_stat_streak()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{game.bestStreak}</dd>
			</div>
			<div class="flex flex-col items-center">
				<dt class="text-xs font-bold uppercase">{m.killswitch_stat_perfects()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{game.perfects}</dd>
			</div>
			<div class="flex flex-col items-center">
				<dt class="text-xs font-bold uppercase">{m.killswitch_stat_accuracy()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{Math.round(game.accuracy * 100)}%</dd>
			</div>
		</dl>
	</GameOverModal>
</GameShell>
