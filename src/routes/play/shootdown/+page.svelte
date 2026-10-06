<script lang="ts">
	import { onMount } from 'svelte';
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';
	import GameShell from '$lib/components/GameShell.svelte';
	import GameOverModal from '$lib/components/GameOverModal.svelte';
	import LivesBar from '$lib/components/LivesBar.svelte';
	import ShootdownCanvas from '$lib/components/ShootdownCanvas.svelte';
	import ShootdownCommander from '$lib/components/ShootdownCommander.svelte';
	import { STARTING_LIVES } from '$lib/game/shootdown/shootdownStep';
	import { firstPlay } from '$lib/services/tutorial';
	import { ShootdownGame } from '$lib/stores/shootdownGame.svelte';
	import { CHARACTER_NAME } from '$lib/theme/character';
	import IconPause from '~icons/lucide/pause';
	import IconPlay from '~icons/lucide/play';
	import IconRepeat from '~icons/lucide/repeat';

	const game = new ShootdownGame();
	const modeName = m.mode_shootdown_name();

	let showTutorial = $state(false);
	onMount(() => {
		showTutorial = firstPlay('shootdown');
	});

	// Short mascot reaction lines for shooting down the blimp (flagged for owner review)
	const BLIMP_REACTIONS = [m.shootdown_blimp_1, m.shootdown_blimp_2, m.shootdown_blimp_3];

	const reactionLine = $derived(
		game.reaction === null
			? null
			: BLIMP_REACTIONS[game.reaction - 1]?.({ characterName: CHARACTER_NAME[getLocale()] })
	);
</script>

<GameShell title={modeName} score={game.score} best={game.bestScore}>
	{#snippet actions()}
		<button
			type="button"
			class="btn-chunky px-3 py-1 text-sm {game.autoFire ? 'bg-explosion-yellow' : ''}"
			aria-pressed={game.autoFire}
			onclick={() => game.setAutoFire(!game.autoFire)}
		>
			<IconRepeat class="size-4" aria-hidden="true" />
			{m.shootdown_auto_fire()}
			<span
				class="rounded border-2 border-ink px-1 text-xs {game.autoFire ? 'bg-ink text-paper' : ''}"
				aria-hidden="true"
			>
				{game.autoFire ? '✓' : '–'}
			</span>
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

	<section class="flex flex-col items-center gap-3">
		<div
			class="flex w-full max-w-md items-center gap-3 rounded-[12px_6px_14px_8px] border-3 border-ink bg-paper px-3 py-2 shadow-[3px_3px_0_var(--color-ink)]"
		>
			<ShootdownCommander pose={game.commander} class="h-16 w-14 shrink-0" />

			<p class="min-h-10 flex-1 text-sm leading-snug font-semibold" aria-live="polite">
				{#if reactionLine}
					<span class="pop-in inline-block">{reactionLine}</span>
				{:else}
					<span class="font-display text-lg font-bold">{m.shootdown_wave({ wave: game.wave })}</span
					>
					{#if game.combo > 1}
						{#key game.combo}
							<span
								class="pop-in ms-2 inline-block rounded-md border-2 border-ink bg-explosion-yellow px-1.5 text-xs font-bold"
							>
								{m.shootdown_combo({ combo: game.combo })}
							</span>
						{/key}
					{/if}
				{/if}
			</p>

			<LivesBar lives={game.lives} max={STARTING_LIVES} class="shrink-0 text-xl" />
		</div>

		<ShootdownCanvas {game} {showTutorial} />
	</section>

	<GameOverModal
		open={game.status === 'over'}
		score={game.score}
		{modeName}
		isNewBest={game.isNewBest}
		drawBoard={game.drawBoard}
		onRetry={() => game.start()}
	>
		<dl class="flex justify-center gap-6 font-display">
			<div class="flex flex-col items-center">
				<dt class="text-xs font-bold uppercase">{m.shootdown_wave_reached()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{game.wave}</dd>
			</div>
			{#if game.bestWave}
				<div class="flex flex-col items-center">
					<dt class="text-xs font-bold uppercase">{m.shootdown_best_wave()}</dt>
					<dd class="text-2xl font-bold tabular-nums">{game.bestWave}</dd>
				</div>
			{/if}
		</dl>
	</GameOverModal>
</GameShell>
