<!-- Iceberg Curling - Fully Implemented -->
<script lang="ts">
	import { CurlingGame } from "#lib/stores/curlingGame.svelte.js";
	import GameShell from "#lib/components/GameShell.svelte";
	import GameOverModal from "#lib/components/GameOverModal.svelte";

	const game = new CurlingGame();
	const modeName = "Iceberg Curling";
</script>

<GameShell title={modeName} score={game.score} best={game.best} confirmLeave={game.cState === "sliding"}>
	<div class="mx-auto flex w-full max-w-2xl flex-col items-center gap-4 p-4">
		<div class="flex w-full items-center justify-between rounded-xl border-3 border-ink bg-cyan-100 px-4 py-2 shadow-[3px_3px_0_var(--color-ink)]">
			<div class="font-display text-sm font-bold text-ink">End: {game.state.ends + 1}/{8}</div>
			<div class="font-display text-sm font-bold text-ink">Sweeps: {game.state.sweeps}</div>
			<div class="font-display text-sm font-bold text-ink">Score: {game.score}</div>
		</div>
		<div class="relative h-[400px] w-full overflow-hidden rounded-xl border-3 border-ink bg-gradient-to-b from-cyan-50 to-blue-100 shadow-[4px_4px_0_var(--color-ink)]">
			<div class="absolute bottom-0 left-0 right-0 h-32 bg-blue-200"></div>
			<div class="absolute bottom-20 left-1/2 h-16 w-16 -translate-x-1/2 rounded-full border-4 border-red-500 bg-white/50"></div>
			<div class="absolute bottom-24 left-1/2 -translate-x-1/2 text-2xl">??</div>
			<div class="absolute h-8 w-8 -translate-x-1/2 -translate-y-1/2 transition-all duration-75" style:left="{game.state.stone.x * 100}%; bottom:{10 + game.state.stone.y * 60}%"><div class="text-2xl">??</div></div>
			<div class="absolute bottom-40 right-4 text-xl">??</div>
			<div class="absolute top-10 left-10 text-lg">??</div>
		</div>
		{#if game.cState === "aiming"}
			<div class="w-full max-w-xs space-y-3">
				<div><label class="font-display text-sm">Power: {game.power}%</label><input type="range" min="20" max="80" bind:value={game.power} class="w-full" /></div>
				<div><label class="font-display text-sm">Angle: {game.angle}°</label><input type="range" min="-60" max="-30" bind:value={game.angle} class="w-full" /></div>
				<button type="button" class="btn-chunky w-full py-3" onclick={() => game.throwStone()}>THROW</button>
			</div>
		{:else if game.cState === "sliding"}
			<button type="button" class="btn-chunky px-8 py-4 text-lg" onmousedown={() => game.sweep(true)} onmouseup={() => game.sweep(false)} ontouchstart={() => game.sweep(true)} ontouchend={() => game.sweep(false)}>SWEEP</button>
		{/if}
		<div class="font-display text-xs text-ink/70">Sweep to reduce friction and control curl</div>
	</div>
	<GameOverModal open={game.over} score={game.state.score} mode="curling" {modeName} isNewBest={game.isNewBest} title="Game Over" onRetry={() => game.start()}>
		<dl class="grid grid-cols-1 gap-2 font-display text-sm">
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2"><dt class="font-bold">Final Score</dt><dd class="text-2xl font-bold">{game.state.score}</dd></div>
		</dl>
	</GameOverModal>
</GameShell>
