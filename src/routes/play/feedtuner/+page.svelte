<!-- Meta's ranking console: promote the posts that pay without pushing the timeline into a flame war. -->
<script lang="ts">
	import { onMount } from 'svelte';
	import GameShell from '#lib/components/GameShell.svelte';
	import {
		ACTIONS,
		createFeed,
		factCheck,
		MAX_OUTRAGE,
		MIN_REACH,
		rank,
		TURNS
	} from '#lib/game/feedtuner/state.js';
	import { createRandom, randomSeed } from '#lib/game/random.js';
	import { m } from '#lib/paraglide/messages.js';
	import { highscores } from '#lib/services/highscore.js';

	const KEY = ['feedtuner', 'score'] as const;
	const modeName = m.mode_feedtuner_name();

	let game = $state(createFeed(createRandom(randomSeed())));
	let best = $state<number | null>(null);
	let isNewBest = $state(false);

	onMount(() => {
		best = highscores().get(KEY);
	});

	const kindText = {
		deal: m.feedtuner_deal,
		outrage: m.feedtuner_outrage,
		cat: m.feedtuner_cat,
		ad: m.feedtuner_ad
	};
	const actionText = {
		promote: m.feedtuner_promote,
		hold: m.feedtuner_hold,
		demote: m.feedtuner_demote
	};

	function choose(action: (typeof ACTIONS)[number]) {
		if (game.status !== 'playing') return;
		game = rank(game, action, createRandom(randomSeed()));
		if (game.status !== 'playing') {
			const result = highscores().submit(KEY, game.score);
			best = result.best;
			isNewBest = result.isNewBest;
		}
	}

	function restart() {
		game = createFeed(createRandom(randomSeed()));
		isNewBest = false;
	}
</script>

<GameShell title={modeName} score={game.score} {best}>
	<section class="mx-auto flex w-full max-w-xl flex-col gap-3">
		<p class="text-sm leading-snug" dir="auto">
			{m.feedtuner_goal({ low: MIN_REACH, high: MAX_OUTRAGE })}
		</p>

		<div
			class="flex flex-col gap-2 rounded-[12px_6px_14px_8px] border-3 border-ink bg-paper p-3 shadow-[3px_3px_0_var(--color-ink)]"
		>
			<div
				class="flex items-center justify-between gap-2 font-display text-xs font-bold tabular-nums"
			>
				<span dir="auto">{m.feedtuner_reach({ value: Math.round(game.reach) })}</span>
				<span dir="auto">{game.turn} / {TURNS}</span>
				<span dir="auto" class:color-tie-red={game.outrage >= MAX_OUTRAGE - 15}>
					{m.feedtuner_outrage_meter({ value: Math.round(game.outrage) })}
				</span>
			</div>
			<div class="flex gap-2" aria-hidden="true">
				<div class="h-2 flex-1 overflow-hidden rounded-full bg-ink/15">
					<div class="h-full bg-khaki" style:width="{game.reach}%"></div>
				</div>
				<div class="h-2 flex-1 overflow-hidden rounded-full bg-ink/15">
					<div class="h-full bg-tie-red" style:width="{game.outrage}%"></div>
				</div>
			</div>
		</div>

		{#if game.status === 'playing' && game.post}
			<div
				class="sticker rounded-[18px_10px_16px_8px] border-3 border-ink bg-sand p-4 shadow-(--shadow-hard)"
			>
				<p class="text-lg leading-snug font-bold" dir="auto">
					{m.feedtuner_post({
						kind: kindText[game.post.label](),
						engagement: game.post.engagement,
						risk: game.post.risk
					})}
				</p>
			</div>
			<div class="flex justify-end">
				<button
					type="button"
					class="btn-chunky bg-khaki px-2 py-1 text-xs"
					disabled={game.factChecks <= 0}
					onclick={() => (game = factCheck(game))}
				>
					{m.feedtuner_factcheck({ count: game.factChecks })}
				</button>
			</div>
			<div class="grid grid-cols-3 gap-2">
				{#each ACTIONS as action (action)}
					<button
						type="button"
						class="btn-chunky bg-paper px-2 py-3 text-sm"
						onclick={() => choose(action)}
					>
						{actionText[action]()}
					</button>
				{/each}
			</div>
			{#if game.last}
				<p class="text-center text-sm font-bold" dir="auto" aria-live="polite">
					{m.feedtuner_last({
						reach: Math.round(game.last.reach),
						outrage: Math.round(game.last.outrage)
					})}
				</p>
			{/if}
		{:else}
			<div
				class="sticker flex flex-col gap-3 rounded-[18px_10px_16px_8px] border-3 border-ink bg-paper p-5 shadow-(--shadow-hard)"
			>
				<h2 class="font-display text-2xl font-bold" dir="auto">
					{game.status === 'won' ? m.feedtuner_result_win() : m.feedtuner_result_lose()}
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
