<!-- A Senate hearing: Amodei wants Chinese models banned, Huang wants them all. Keep the dial in the compromise band. -->
<script lang="ts">
	import { onMount } from 'svelte';
	import GameShell from '#lib/components/GameShell.svelte';
	import {
		answer,
		BAND_HIGH,
		BAND_LOW,
		BRIEFINGS,
		createHearing,
		ROUNDS
	} from '#lib/game/modelhearing/state.js';
	import { createRandom, randomSeed } from '#lib/game/random.js';
	import { m } from '#lib/paraglide/messages.js';
	import { highscores } from '#lib/services/highscore.js';

	const KEY = ['modelhearing', 'score'] as const;
	const modeName = m.mode_modelhearing_name();

	let game = $state(createHearing(createRandom(randomSeed())));
	let best = $state<number | null>(null);
	let isNewBest = $state(false);

	onMount(() => {
		best = highscores().get(KEY);
	});

	const witnessText = {
		safety: m.hearing_witness_safety,
		markets: m.hearing_witness_markets,
		partnership: m.hearing_witness_partnership,
		briefing: m.hearing_witness_briefing
	};
	const actionText = {
		ban: m.hearing_action_ban,
		access: m.hearing_action_access,
		investigate: m.hearing_action_investigate,
		hold: m.hearing_action_hold
	};

	function choose(action: keyof typeof actionText) {
		if (game.status !== 'playing') return;
		const before = game.briefings;
		game = answer(game, action, createRandom(randomSeed()));
		if (game.briefings === before && action !== 'hold') return;
		if (game.status !== 'playing') {
			const result = highscores().submit(KEY, game.score);
			best = result.best;
			isNewBest = result.isNewBest;
		}
	}

	function restart() {
		game = createHearing(createRandom(randomSeed()));
		isNewBest = false;
	}
</script>

<GameShell title={modeName} score={game.score} {best}>
	<section class="mx-auto flex w-full max-w-xl flex-col gap-3">
		<p class="text-sm leading-snug" dir="auto">
			{m.hearing_goal({ low: BAND_LOW, high: BAND_HIGH })}
		</p>

		<div
			class="flex flex-col gap-2 rounded-[12px_6px_14px_8px] border-3 border-ink bg-paper p-3 shadow-[3px_3px_0_var(--color-ink)]"
		>
			<div
				class="flex items-center justify-between gap-2 font-display text-xs font-bold tabular-nums"
			>
				<span dir="auto">{m.hearing_round({ round: game.round + 1, total: ROUNDS })}</span>
				<span dir="auto">{m.hearing_briefings({ count: game.briefings })}</span>
				<span dir="auto">{m.hearing_credibility({ value: Math.round(game.credibility) })}</span>
			</div>
			<div
				class="relative h-4 overflow-hidden rounded-md border-2 border-ink bg-sand"
				role="meter"
				aria-label={m.hearing_policy({ value: Math.round(game.policy) })}
				aria-valuemin={0}
				aria-valuemax={100}
				aria-valuenow={Math.round(game.policy)}
			>
				<div
					class="absolute inset-y-0 bg-khaki/50"
					style:left="{BAND_LOW}%"
					style:width="{BAND_HIGH - BAND_LOW}%"
				></div>
				<div class="absolute inset-y-0 w-1 bg-ink" style:left="{game.policy}%"></div>
			</div>
			<p class="text-center text-xs font-bold tabular-nums" dir="auto">
				{m.hearing_policy({ value: Math.round(game.policy) })} · {m.hearing_goal_band({
					low: BAND_LOW,
					high: BAND_HIGH
				})}
			</p>
		</div>

		{#if game.status === 'playing' && game.event}
			<div
				class="sticker rounded-[18px_10px_16px_8px] border-3 border-ink bg-sand p-4 shadow-(--shadow-hard)"
			>
				<p class="text-lg leading-snug font-bold" dir="auto">
					{witnessText[game.event.line as keyof typeof witnessText]?.() ?? game.event.line}
				</p>
			</div>
			<div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
				{#each Object.keys(actionText) as action (action)}
					<button
						type="button"
						class="btn-chunky bg-paper px-2 py-2 text-xs {action === 'hold' ? 'opacity-70' : ''}"
						disabled={action !== 'hold' && game.briefings <= 0}
						onclick={() => choose(action as keyof typeof actionText)}
					>
						{actionText[action as keyof typeof actionText]()}
					</button>
				{/each}
			</div>
			{#if game.spyRevealed}
				<p class="text-sm font-bold text-tie-red" dir="auto">{m.hearing_spy()}</p>
			{/if}
		{:else}
			<div
				class="sticker flex flex-col gap-3 rounded-[18px_10px_16px_8px] border-3 border-ink bg-paper p-5 shadow-(--shadow-hard)"
			>
				<h2 class="font-display text-2xl font-bold" dir="auto">
					{game.status === 'won' ? m.hearing_result_win() : m.hearing_result_lose()}
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
