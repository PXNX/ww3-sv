<!-- Sondage Slider - Fully Implemented -->
<script lang="ts">
	import { SliderGame } from "#lib/stores/sliderGame.svelte.js";
	import GameShell from "#lib/components/GameShell.svelte";
	import GameOverModal from "#lib/components/GameOverModal.svelte";

	const game = new SliderGame();
	const modeName = "Sondage Slider";
</script>

<GameShell title={modeName} score={game.score} best={game.best} confirmLeave={game.state === "playing"}>
	<div class="mx-auto flex w-full max-w-2xl flex-col items-center gap-6 p-4">
		<div class="w-full rounded-xl border-3 border-ink bg-gradient-to-r from-amber-50 via-yellow-200 to-amber-400 p-6 shadow-[4px_4px_0_var(--color-ink)]">
			<div class="mb-4 flex items-center justify-between">
				<div class="font-display text-lg font-bold text-ink">Time: {game.time}s</div>
				<div class="font-display text-lg font-bold text-ink">Round: {game.round}</div>
				<div class="font-display text-lg font-bold text-ink">Score: {game.score}</div>
			</div>
			<div class="mb-6 text-center font-display text-ink">{game.message}</div>
			<div class="relative mb-8 h-20">
				<div class="absolute left-0 right-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-ink/30"></div>
				<div class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-display text-xs text-ink">0%</div>
				<div class="absolute top-1/2 h-8 w-4 -translate-x-1/2 -translate-y-1/2 rounded bg-tie-red shadow-[2px_2px_0_var(--color-ink)] transition-all duration-200" style:left="{50 + game.poll}% ; transform: translate(-50%, -50%) translateY({game.wobble}px)"></div>
				<div class="absolute -left-2 top-1/2 -translate-y-1/2 font-display text-xs text-tie-red">-60%</div>
				<div class="absolute -right-6 top-1/2 -translate-y-1/2 font-display text-xs text-ink">+10%</div>
			</div>
			<div class="grid grid-cols-4 gap-3">
				{#each game.icons as icon}
					<button type="button" class="btn-chunky h-16 text-3xl" onclick={() => game.pick(icon)}>{icon}</button>
				{/each}
			</div>
		</div>
	</div>
	<GameOverModal open={game.over} score={game.score} mode="slider" {modeName} isNewBest={game.isNewBest} title="Poll Results" onRetry={() => game.start()}>
		<dl class="grid grid-cols-1 gap-2 font-display text-sm">
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2"><dt class="font-bold">Final Score</dt><dd class="text-2xl font-bold">{game.score}</dd></div>
		</dl>
	</GameOverModal>
</GameShell>
