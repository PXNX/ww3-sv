<script lang="ts">
	import { onMount } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import FlamingoCanvas from '#lib/components/FlamingoCanvas.svelte';
	import GameOverModal from '#lib/components/GameOverModal.svelte';
	import GameShell from '#lib/components/GameShell.svelte';
	import type { CrashCause } from '#lib/game/flamingo/flamingoStep.js';
	import { drawShareScene } from '#lib/game/flamingo/render.js';
	import { onAppHidden } from '#lib/game/loop.js';
	import { firstPlay } from '#lib/services/tutorial.js';
	import { FlamingoGame } from '#lib/stores/flamingoGame.svelte.js';
	import IconPause from '~icons/lucide/pause';
	import IconPlay from '~icons/lucide/play';

	const game = new FlamingoGame();
	let showTutorial = $state(false);

	const CRASH_LINES: Record<CrashCause, () => string> = {
		balloon: m.flamingo_crash_balloon,
		radar: m.flamingo_crash_radar,
		pylon: m.flamingo_crash_pylon,
		ground: m.flamingo_crash_ground,
		flare: m.flamingo_crash_flare,
		missed: m.flamingo_crash_missed,
		overshoot: m.flamingo_crash_overshoot
	};

	onMount(() => {
		game.loadBests();
		showTutorial = firstPlay('flamingo');
		return onAppHidden(() => game.pause());
	});

	const canPause = $derived(game.status === 'playing' || game.status === 'paused');
</script>

<GameShell
	title={m.mode_flamingo_name()}
	score={game.score}
	best={game.best}
	confirmLeave={canPause}
>
	{#snippet actions()}
		<button
			type="button"
			class="btn-chunky px-3 py-1 text-sm"
			disabled={!canPause}
			aria-pressed={game.status === 'paused'}
			onclick={() => (game.status === 'paused' ? game.resume() : game.pause())}
		>
			{#if game.status === 'paused'}
				<IconPlay class="size-4" aria-hidden="true" />
				{m.game_resume()}
			{:else}
				<IconPause class="size-4" aria-hidden="true" />
				{m.game_pause()}
			{/if}
		</button>
	{/snippet}

	<FlamingoCanvas {game} {showTutorial} />
</GameShell>

<GameOverModal
	open={game.status === 'over'}
	score={game.score}
	modeName={m.mode_flamingo_name()}
	isNewBest={game.isNewBest}
	title={m.flamingo_over_title()}
	drawBoard={drawShareScene}
	onRetry={() => game.newGame()}
>
	{#if game.crash}
		<p class="mb-2 italic">{CRASH_LINES[game.crash]()}</p>
	{/if}
	<dl class="grid grid-cols-2 gap-x-3 gap-y-1 text-start text-sm">
		<dt class="font-bold">{m.flamingo_stat_gaps()}</dt>
		<dd class="text-end tabular-nums">{game.gapsPassed}</dd>
		<dt class="font-bold">{m.flamingo_stat_refineries()}</dt>
		<dd class="text-end tabular-nums">{game.refineriesStruck}</dd>
		<dt class="font-bold">{m.flamingo_stat_tanks()}</dt>
		<dd class="text-end tabular-nums">{game.tanksDestroyed}</dd>
		<dt class="font-bold">{m.flamingo_stat_best_refineries()}</dt>
		<dd class="text-end tabular-nums">{game.bestRefineries ?? 0}</dd>
	</dl>
</GameOverModal>
