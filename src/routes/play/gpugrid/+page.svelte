<!-- Novideo's scheduler: send compute jobs to the coolest rack you can, before three heat alarms shut the cluster down. -->
<script lang="ts">
	import { onMount } from 'svelte';
	import GameShell from '#lib/components/GameShell.svelte';
	import {
	ALARM_HEAT,
	assign,
	createGpuGrid,
	flushCoolant,
	JOBS,
	MAX_ALARMS
} from '#lib/game/gpugrid/state.js';
	import { createRandom, randomSeed } from '#lib/game/random.js';
	import { m } from '#lib/paraglide/messages.js';
	import { highscores } from '#lib/services/highscore.js';

	const KEY = ['gpugrid', 'score'] as const;
	const modeName = m.mode_gpugrid_name();

	let game = $state(createGpuGrid(createRandom(randomSeed())));
	let best = $state<number | null>(null);
	let isNewBest = $state(false);

	onMount(() => {
		best = highscores().get(KEY);
	});

	const kindText = {
		inference: m.gpugrid_inference,
		training: m.gpugrid_training,
		render: m.gpugrid_render
	};

	function send(rack: number) {
		if (game.status !== 'playing') return;
		game = assign(game, rack, createRandom(randomSeed()));
		if (game.status !== 'playing') {
			const result = highscores().submit(KEY, game.score);
			best = result.best;
			isNewBest = result.isNewBest;
		}
	}

	function restart() {
		game = createGpuGrid(createRandom(randomSeed()));
		isNewBest = false;
	}
</script>

<GameShell title={modeName} score={game.score} {best}>
	<section class="mx-auto flex w-full max-w-xl flex-col gap-3">
		<p class="text-sm leading-snug" dir="auto">
			{m.gpugrid_goal({ alarm: ALARM_HEAT })}
		</p>

		<div
			class="flex items-center justify-between gap-2 rounded-lg border-3 border-ink bg-paper px-3 py-2 font-display text-sm font-bold tabular-nums"
		>
			<span dir="auto">{m.gpugrid_alarms({ count: game.alarms, max: MAX_ALARMS })}</span>
			<button
				type="button"
				class="btn-chunky bg-khaki px-2 py-0.5 text-xs"
				disabled={game.coolant <= 0 || game.status !== 'playing'}
				onclick={() => (game = flushCoolant(game))}
			>
				{m.gpugrid_coolant({ count: game.coolant })}
			</button>
			<span dir="auto">{game.turn} / {JOBS}</span>
		</div>

		{#if game.status === 'playing' && game.job}
			<div
				class="sticker rounded-[18px_10px_16px_8px] border-3 border-ink bg-sand p-4 shadow-(--shadow-hard)"
			>
				<p class="text-lg leading-snug font-bold" dir="auto">
					{m.gpugrid_job({ kind: kindText[game.job.label](), size: game.job.size })}
				</p>
			</div>
			<div class="grid grid-cols-3 gap-2">
				{#each game.heat as heat, rack (rack)}
					<button
						type="button"
						class="btn-chunky flex flex-col items-center gap-1 px-1 py-3 text-sm {heat >=
						ALARM_HEAT - 15
							? 'bg-tie-red text-paper'
							: 'bg-paper'}"
						onclick={() => send(rack)}
					>
						<span>{m.gpugrid_rack({ number: rack + 1 })}</span>
						<span class="text-xs">{m.gpugrid_heat({ value: Math.round(heat) })}</span>
						<span class="h-1.5 w-full overflow-hidden rounded-full bg-ink/15" aria-hidden="true">
							<span class="block h-full bg-current" style:width="{heat}%"></span>
						</span>
					</button>
				{/each}
			</div>
			{#if game.last}
				<p class="text-center text-sm font-bold" dir="auto" aria-live="polite">
					{m.gpugrid_last({ rack: game.last.rack + 1, points: game.last.points })}
				</p>
			{/if}
		{:else}
			<div
				class="sticker flex flex-col gap-3 rounded-[18px_10px_16px_8px] border-3 border-ink bg-paper p-5 shadow-(--shadow-hard)"
			>
				<h2 class="font-display text-2xl font-bold" dir="auto">
					{game.status === 'won' ? m.gpugrid_result_win() : m.gpugrid_result_lose()}
				</h2>
				{#if isNewBest}
					<p class="text-sm font-bold text-khaki" dir="auto">{m.game_best()}: {best}</p>
				{/if}
				<button type="button" class="btn-chunky bg-explosion-yellow px-4 py-2" onclick={restart}>
					{m.alignment_restart()}
				</button>
			</div>
		{/if}
	</section>
</GameShell>
