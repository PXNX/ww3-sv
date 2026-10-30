<!-- Gig Saboteur - Fully Implemented -->
<script lang="ts">
	import { SabotageGame } from "#lib/stores/sabotageGame.svelte.js";
	import GameShell from "#lib/components/GameShell.svelte";
	import GameOverModal from "#lib/components/GameOverModal.svelte";
	import IconArrowUp from "~icons/lucide/arrow-up";
	import IconArrowDown from "~icons/lucide/arrow-down";
	import IconArrowLeft from "~icons/lucide/arrow-left";
	import IconArrowRight from "~icons/lucide/arrow-right";

	const game = new SabotageGame();
	const modeName = "Gig Saboteur";
</script>

<GameShell title={modeName} score={game.score} best={game.best} confirmLeave={game.sbState === "playing"}>
	<div class="mx-auto flex w-full max-w-md flex-col items-center gap-4 p-4">
		<div class="flex w-full items-center justify-between rounded-xl border-3 border-ink bg-tie-red/90 px-4 py-2 shadow-[3px_3px_0_var(--color-ink)]">
			<div class="font-display text-sm font-bold text-paper">Level: {game.state.level}/{9}</div>
			<div class="font-display text-sm font-bold text-paper">Time: {Math.ceil(game.timeLeft)}s</div>
			<div class="font-display text-sm font-bold text-paper">Missions: {game.state.missions}/3</div>
		</div>
		<div class="relative h-[400px] w-full overflow-hidden rounded-xl border-3 border-ink bg-gradient-to-b from-green-900 to-green-950 shadow-[4px_4px_0_var(--color-ink)]">
			<div class="absolute inset-0 opacity-20" style="background-image: repeating-linear-gradient(0deg, transparent, transparent 20px, #000 20px, #000 22px), repeating-linear-gradient(90deg, transparent, transparent 20px, #000 20px, #000 22px);"></div>
			<div class="absolute left-[20%] top-[30%] h-8 w-8 rounded bg-yellow-600 shadow-[2px_2px_0_var(--color-ink)]">?</div>
			<div class="absolute left-[70%] top-[20%] h-10 w-10 rounded bg-gray-600 shadow-[2px_2px_0_var(--color-ink)]">??</div>
			<div class="absolute left-[50%] top-[60%] h-12 w-12 rounded bg-gray-700 shadow-[2px_2px_0_var(--color-ink)]">??</div>
			<div class="absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 transition-all duration-100" style:left="{game.playerX}%; top:{game.playerY}%"><div class="text-xl">???</div></div>
			<div class="absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 left-[60%] top-[35%] animate-pulse"><div class="text-lg">??</div></div>
		</div>
		<div class="grid grid-cols-3 gap-2">
			<div></div>
			<button type="button" class="btn-chunky p-3" onclick={() => game.move(0, -8)}><IconArrowUp class="size-5" /></button>
			<div></div>
			<button type="button" class="btn-chunky p-3" onclick={() => game.move(-8, 0)}><IconArrowLeft class="size-5" /></button>
			<button type="button" class="btn-chunky p-3" onclick={() => game.move(0, 8)}><IconArrowDown class="size-5" /></button>
			<button type="button" class="btn-chunky p-3" onclick={() => game.move(8, 0)}><IconArrowRight class="size-5" /></button>
		</div>
		<button type="button" class="btn-chunky px-6 py-2" onclick={() => game.sabotage()}>SABOTAGE</button>
		<div class="font-display text-xs text-ink/70">Sneak in, sabotage targets, escape!</div>
	</div>
	<GameOverModal open={game.over} score={game.score} mode="sabotage" {modeName} isNewBest={game.isNewBest} title={game.state.level >= 9 ? "Mission Success" : "BUSTED"} onRetry={() => game.start()}>
		<dl class="grid grid-cols-1 gap-2 font-display text-sm">
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2"><dt class="font-bold">Final Score</dt><dd class="text-2xl font-bold">{game.score}</dd></div>
		</dl>
	</GameOverModal>
</GameShell>
