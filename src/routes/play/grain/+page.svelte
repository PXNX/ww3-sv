<!-- Grain Corridor - Fully Implemented -->
<script lang="ts">
	import { GrainGame } from "#lib/stores/grainGame.svelte.js";
	import GameShell from "#lib/components/GameShell.svelte";
	import GameOverModal from "#lib/components/GameOverModal.svelte";
	import IconArrowLeft from "~icons/lucide/arrow-left";
	import IconArrowRight from "~icons/lucide/arrow-right";

	const game = new GrainGame();
	const modeName = "Grain Corridor";
</script>

<GameShell title={modeName} score={game.score} best={game.best} confirmLeave={game.state === "playing"}>
	<div class="mx-auto flex w-full max-w-md flex-col items-center gap-4 p-4">
		<div class="flex w-full items-center justify-between rounded-xl border-3 border-ink bg-blue-950 px-4 py-2 shadow-[3px_3px_0_var(--color-ink)]">
			<div class="font-display text-sm font-bold text-paper">Distance: {Math.floor(game.distance/10)}m</div>
			<div class="font-display text-sm font-bold text-paper">?? {game.hearts}</div>
			<div class="font-display text-sm font-bold text-paper">Score: {game.score}</div>
		</div>
		<div class="relative h-[400px] w-full overflow-hidden rounded-xl border-3 border-ink bg-gradient-to-b from-blue-900 to-cyan-950 shadow-[4px_4px_0_var(--color-ink)]">
			<div class="absolute inset-0 flex">
				<div class="w-1/3 border-r-2 border-dashed border-paper/30"></div>
				<div class="w-1/3 border-r-2 border-dashed border-paper/30"></div>
				<div class="w-1/3"></div>
			</div>
			{#each game.mines as mine}
				<div class="absolute h-4 w-4 -translate-x-1/2 rounded-full bg-tie-red shadow-[0_0_8px_red]" style:left="{mine.x}%; top:{mine.y}%"></div>
			{/each}
			<div class="absolute h-10 w-14 -translate-x-1/2 transition-all duration-150" style:left="{20 + game.lane * 30}%; bottom:10%">
				<div class="flex h-full w-full items-center justify-center rounded bg-amber-600 text-lg shadow-[2px_2px_0_var(--color-ink)]">??</div>
			</div>
		</div>
		<div class="flex gap-4">
			<button type="button" class="btn-chunky px-6 py-3" onclick={() => game.move(-1)} disabled={game.lane === 0}><IconArrowLeft class="size-6" /></button>
			<button type="button" class="btn-chunky px-6 py-3" onclick={() => game.move(1)} disabled={game.lane === 2}><IconArrowRight class="size-6" /></button>
		</div>
		<div class="font-display text-xs text-ink/70">Avoid mines in the Black Sea lanes</div>
	</div>
	<GameOverModal open={game.over} score={game.score} mode="grain" {modeName} isNewBest={game.isNewBest} title="Mission End" onRetry={() => game.start()}>
		<dl class="grid grid-cols-1 gap-2 font-display text-sm">
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2"><dt class="font-bold">Final Score</dt><dd class="text-2xl font-bold">{game.score}</dd></div>
		</dl>
	</GameOverModal>
</GameShell>
