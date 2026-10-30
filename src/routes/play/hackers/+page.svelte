<!-- Hermit Hackers - Fully Implemented -->
<script lang="ts">
	import { HackersGame } from "#lib/stores/hackersGame.svelte.js";
	import GameShell from "#lib/components/GameShell.svelte";
	import GameOverModal from "#lib/components/GameOverModal.svelte";

	const game = new HackersGame();
	const modeName = "Hermit Hackers";
</script>

<GameShell title={modeName} score={game.score} best={game.best} confirmLeave={game.uiState === "playing"}>
	<div class="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4">
		<div class="flex items-center justify-between rounded-xl border-3 border-ink bg-banner-slate px-4 py-2 shadow-[3px_3px_0_var(--color-ink)]">
			<div class="font-display text-sm font-bold text-paper">Quota: {game.state.totalHacked}/{game.state.quota}</div>
			<div class="font-display text-sm font-bold text-paper">Trace: {Math.floor(game.traceDisplay)}%</div>
			<div class="font-display text-sm font-bold text-paper">Time: {Math.floor(game.state.timer)}s</div>
		</div>
		<div class="grid gap-4 md:grid-cols-2">
			<div class="rounded-xl border-3 border-ink bg-[#001100] p-4 shadow-[4px_4px_0_var(--color-ink)]">
				<h3 class="mb-3 font-mono text-sm font-bold text-[#00ff00]">IP TARGETS</h3>
				<div class="space-y-2">
					{#each game.state.systems as sys, i}
						<button type="button" class="w-full rounded border border-[#00ff00]/50 p-2 text-left font-mono text-xs {i === game.state.selectedIndex ? "bg-[#00ff00]/20" : "hover:bg-[#00ff00]/10"} {sys.hacked ? "opacity-50" : ""}" onclick={() => game.selectSystem(i)}>
							<div class="text-[#00ff00]">{sys.ip} {sys.hacked ? "[PWNED]" : ""}</div>
							<div class="text-[#00ff00]/70">{sys.system}</div>
						</button>
					{/each}
				</div>
			</div>
			<div class="space-y-4">
				<div class="rounded-xl border-3 border-ink bg-[#001100] p-4 shadow-[4px_4px_0_var(--color-ink)]">
					<h3 class="mb-3 font-mono text-sm font-bold text-[#00ff00]">WALLET CRACK</h3>
					<div class="mb-3 flex gap-2">
						{#each game.guess as g, i}
							<button type="button" class="h-10 w-10 rounded border border-[#00ff00] bg-[#002200] font-mono text-lg text-[#00ff00]" onclick={() => { game.guess[i] = (game.guess[i] % 9) + 1; }}>{g}</button>
						{/each}
					</div>
					<button type="button" class="w-full rounded border border-[#00ff00] bg-[#003300] py-2 font-mono text-sm text-[#00ff00] hover:bg-[#004400]" onclick={() => game.submitGuess()}>CRACK</button>
				</div>
				<div class="rounded-xl border-3 border-ink bg-[#001100] p-4 shadow-[4px_4px_0_var(--color-ink)]">
					<h3 class="mb-3 font-mono text-sm font-bold text-[#00ff00]">BREAKER PANEL</h3>
					<div class="mx-auto grid w-fit grid-cols-3 gap-2">
						{#each game.state.breakers as b, i}
							<button type="button" class="h-12 w-12 rounded border border-[#00ff00] {b.on ? "bg-[#ff0000]/40" : "bg-[#00ff00]/20"}" onclick={() => game.toggleBreaker(i)}></button>
						{/each}
					</div>
				</div>
			</div>
		</div>
	</div>
	<GameOverModal open={game.over} score={game.score} mode="hackers" {modeName} isNewBest={game.isNewBest} title={game.state.won ? "Access Granted" : "TRACE DETECTED"} onRetry={() => game.start()}>
		<dl class="grid grid-cols-1 gap-2 font-display text-sm">
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2"><dt class="font-bold">Final Score</dt><dd class="text-2xl font-bold">{game.score}</dd></div>
		</dl>
	</GameOverModal>
</GameShell>
