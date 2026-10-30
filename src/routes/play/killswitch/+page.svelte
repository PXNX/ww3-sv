<!-- Starlink Kill Switch - Fully Implemented -->
<script lang="ts">
	import { KillswitchGame } from "#lib/stores/killswitchGame.svelte.js";
	import GameShell from "#lib/components/GameShell.svelte";
	import GameOverModal from "#lib/components/GameOverModal.svelte";

	const game = new KillswitchGame();
	const modeName = "Starlink Kill Switch";
</script>

<GameShell title={modeName} score={game.score} best={game.best} confirmLeave={game.ksState === "playing"}>
	<div class="mx-auto flex w-full max-w-2xl flex-col items-center gap-4 p-4">
		<div class="flex w-full items-center justify-between rounded-xl border-3 border-ink bg-slate-900 px-4 py-2 shadow-[3px_3px_0_var(--color-ink)]">
			<div class="font-display text-sm font-bold text-chartreuse">Time: {Math.ceil(game.timeLeft)}s</div>
			<div class="font-display text-sm font-bold text-paper">Hits: {game.state.hits}/3</div>
			<div class="font-display text-sm font-bold text-chartreuse">Score: {game.score}</div>
		</div>
		<div class="relative h-[400px] w-full overflow-hidden rounded-xl border-3 border-ink bg-gradient-to-b from-indigo-950 via-slate-900 to-black shadow-[4px_4px_0_var(--color-ink)]">
			<div class="absolute bottom-10 right-4 text-4xl">??</div>
			<div class="absolute top-4 left-4 text-3xl">??</div>
			{#each game.state.drones as drone, di}
				<div class="absolute transition-all duration-75" style:left="{drone.x * 100}%; top:{drone.y * 100}%">
					<div class="relative -translate-x-1/2 -translate-y-1/2">
						<div class="text-2xl">??</div>
						{#each drone.links as link}
							<button type="button" class="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full {link.cut ? "bg-gray-600" : "bg-cyan-400 animate-pulse"}" style:left="{link.x * 20}px; top:{(link.y - 0.5) * 40}px" onclick={() => game.cutLink(di, link.id)} disabled={link.cut} aria-label="Cut link"></button>
						{/each}
					</div>
				</div>
			{/each}
		</div>
		<div class="font-display text-xs text-ink/70">Tap cyan links to cut them before drones reach refinery</div>
	</div>
	<GameOverModal open={game.over} score={game.state.score} mode="killswitch" {modeName} isNewBest={game.isNewBest} title={game.state.won ? "Mission Complete" : "Refinery Hit!"} onRetry={() => game.start()}>
		<dl class="grid grid-cols-1 gap-2 font-display text-sm">
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2"><dt class="font-bold">Final Score</dt><dd class="text-2xl font-bold">{game.state.score}</dd></div>
		</dl>
	</GameOverModal>
</GameShell>
