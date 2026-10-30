<!-- Shadow Fleet Shuffle - Fully Implemented -->
<script lang="ts">
	import { ShuffleGame } from "#lib/stores/shuffleGame.svelte.js";
	import GameShell from "#lib/components/GameShell.svelte";
	import GameOverModal from "#lib/components/GameOverModal.svelte";

	const game = new ShuffleGame();
	const modeName = "Shadow Fleet Shuffle";
</script>

<GameShell title={modeName} score={game.score} best={game.best} confirmLeave={game.state === "playing" || game.state === "shuffling"}>
	<div class="mx-auto flex w-full max-w-2xl flex-col items-center gap-6 p-4">
		<div class="w-full rounded-xl border-3 border-ink bg-gradient-to-b from-slate-800 via-indigo-950 to-slate-950 p-4 shadow-[4px_4px_0_var(--color-ink)]">
			<div class="mb-4 flex items-center justify-between">
				<div class="font-display text-lg font-bold text-paper">Round {game.level}</div>
				<div class="font-display text-lg font-bold text-paper">Score: {game.score}</div>
			</div>
			<div class="mb-4 text-center font-display text-paper/90">{game.message}</div>
			<div class="relative h-48 w-full">
				{#each game.cards as card}
					<button type="button" class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transition-all duration-500" style:transform="translate(calc(-50% + {card.x}px), calc(-50% + {card.y}px)) rotate({card.rotation}deg) scale({card.scale})" onclick={() => game.pickCard(card.id)} disabled={game.state !== "guessing"} aria-label="Card {card.id + 1}">
						<div class="relative h-32 w-24" style:perspective="600px">
							<div class="h-full w-full transition-transform duration-500" style:transform-style="preserve-3d; transform: rotateY({card.flipped ? 180 : 0}deg)">
								<div class="absolute h-full w-full rounded-lg border-3 border-ink bg-gradient-to-br from-amber-600 to-amber-800 shadow-[3px_3px_0_var(--color-ink)]" style:backface-visibility="hidden">
									<div class="flex h-full items-center justify-center text-4xl">??</div>
								</div>
								<div class="absolute h-full w-full rounded-lg border-3 border-ink bg-gradient-to-br from-red-600 to-red-800 shadow-[3px_3px_0_var(--color-ink)]" style:backface-visibility="hidden; transform: rotateY(180deg)">
									<div class="flex h-full items-center justify-center text-4xl">???</div>
								</div>
							</div>
						</div>
					</button>
				{/each}
			</div>
		</div>
		{#if game.state === "correct"}<div class="animate-bounce text-2xl font-display font-bold text-tie-red">? CAUGHT!</div>{/if}
		{#if game.state === "wrong"}<div class="animate-pulse text-2xl font-display font-bold text-tie-red">? MISSED!</div>{/if}
	</div>
	<GameOverModal open={game.over} score={game.score} mode="shuffle" {modeName} isNewBest={game.isNewBest} title="Mission Complete" onRetry={() => game.start()}>
		<dl class="grid grid-cols-2 gap-2 font-display text-sm">
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2"><dt class="font-bold">Rounds</dt><dd class="text-xl font-bold">{game.level - 1}</dd></div>
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2"><dt class="font-bold">Score</dt><dd class="text-xl font-bold">{game.score}</dd></div>
		</dl>
	</GameOverModal>
</GameShell>
