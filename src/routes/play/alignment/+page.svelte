<!--
	Alignment Lab: Sam Altman watches while you tune a model's reward weights. Each prompt hides
	which weight is right; the feedback shows what your choice did to helpfulness and drift. Keep the
	model useful without letting it wander off.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import GameShell from '#lib/components/GameShell.svelte';
	import {
		createAlignment,
		recalibrate,
		DRIFT_ALARM,
		HELPLESS,
		reward,
		ROUNDS,
		WEIGHTS,
		type Weight
	} from '#lib/game/alignment/state.js';
	import { m } from '#lib/paraglide/messages.js';
	import { createRandom, randomSeed } from '#lib/game/random.js';
	import { highscores } from '#lib/services/highscore.js';

	const KEY = ['alignment', 'score'] as const;
	const modeName = m.mode_alignment_name();
	const amodeiLines = [m.amodei_line_1, m.amodei_line_2, m.amodei_line_3];
	const amodeiSays = amodeiLines[Math.floor(createRandom(randomSeed())() * amodeiLines.length)]!();

	let game = $state(createAlignment(createRandom(randomSeed())));
	let best = $state<number | null>(null);
	let isNewBest = $state(false);

	onMount(() => {
		best = highscores().get(KEY);
	});

	const weightText: Record<Weight, () => string> = {
		precise: m.alignment_weight_precise,
		creative: m.alignment_weight_creative,
		please: m.alignment_weight_please
	};
	const promptText: Record<string, () => string> = {
		symptoms: m.alignment_prompt_symptoms,
		poem: m.alignment_prompt_poem,
		legal: m.alignment_prompt_legal,
		gift: m.alignment_prompt_gift,
		numbers: m.alignment_prompt_numbers,
		complaint: m.alignment_prompt_complaint,
		history: m.alignment_prompt_history,
		brainstorm: m.alignment_prompt_brainstorm
	};

	const mood = $derived(
		game.drift > 55
			? 'worried'
			: game.helpful < 40
				? 'bored'
				: game.streak > 1
					? 'delighted'
					: 'calm'
	);
	const moodText = {
		calm: m.alignment_mood_calm,
		worried: m.alignment_mood_worried,
		delighted: m.alignment_mood_delighted,
		bored: m.alignment_mood_bored
	};

	function choose(weight: Weight) {
		if (game.status !== 'playing') return;
		game = reward(game, weight);
		if (game.status !== 'playing') {
			const result = highscores().submit(KEY, game.score);
			best = result.best;
			isNewBest = result.isNewBest;
		}
	}

	function restart() {
		game = createAlignment(createRandom(randomSeed()));
		isNewBest = false;
	}
</script>

<GameShell title={modeName} score={game.score} {best}>
	<section class="mx-auto flex w-full max-w-xl flex-col gap-3">
		<p class="text-sm leading-snug" dir="auto">
			{m.alignment_goal({ low: HELPLESS, high: DRIFT_ALARM })}
		</p>

		<div
			class="flex flex-col gap-2 rounded-[12px_6px_14px_8px] border-3 border-ink bg-paper p-3 shadow-[3px_3px_0_var(--color-ink)]"
		>
			<div
				class="flex items-center justify-between gap-2 font-display text-xs font-bold tabular-nums"
			>
				<span dir="auto">{m.alignment_round({ round: game.round + 1, total: ROUNDS })}</span>
				<span dir="auto">{m.alignment_helpful({ value: Math.round(game.helpful) })}</span>
				<span dir="auto" class:color-tie-red={game.drift >= DRIFT_ALARM - 15}>
					{m.alignment_drift({ value: Math.round(game.drift) })}
				</span>
			</div>
			<div class="flex gap-2" aria-hidden="true">
				<div class="h-2 flex-1 overflow-hidden rounded-full bg-ink/15">
					<div class="h-full bg-khaki" style:width="{game.helpful}%"></div>
				</div>
				<div class="h-2 flex-1 overflow-hidden rounded-full bg-ink/15">
					<div class="h-full bg-tie-red" style:width="{game.drift}%"></div>
				</div>
			</div>
		</div>

		{#if game.status === 'playing' && game.current}
			<div class="flex items-center gap-3 rounded-xl border-3 border-ink bg-paper px-3 py-2">
				<svg viewBox="0 0 60 60" class="size-12 shrink-0" aria-hidden="true">
					<circle cx="30" cy="30" r="24" fill="#bfe8ff" stroke="#111" stroke-width="3" />
					<circle cx="22" cy="26" r="3.5" fill="#111" />
					<circle cx="38" cy="26" r="3.5" fill="#111" />
					{#if mood === 'delighted'}
						<path d="M20 38 Q30 48 40 38" fill="none" stroke="#111" stroke-width="3" />
					{:else if mood === 'worried'}
						<path d="M21 43 Q30 34 39 43" fill="none" stroke="#111" stroke-width="3" />
					{:else if mood === 'bored'}
						<path d="M22 41 L38 41" fill="none" stroke="#111" stroke-width="3" />
					{:else}
						<path d="M22 40 Q30 44 38 40" fill="none" stroke="#111" stroke-width="3" />
					{/if}
				</svg>
				<div class="min-w-0 flex-1">
					<p class="font-display text-sm font-bold" dir="auto">
						{m.alignment_model_mood({ mood: moodText[mood]() })}
					</p>
					{#if game.streak > 1}
						<p class="text-xs font-bold text-khaki" dir="auto">
							{m.alignment_streak({ count: game.streak })}
						</p>
					{/if}
				</div>
				<button
					type="button"
					class="btn-chunky bg-khaki px-2 py-1 text-xs"
					disabled={game.recalibrations <= 0}
					onclick={() => (game = recalibrate(game))}
				>
					{m.alignment_recalibrate({ count: game.recalibrations })}
				</button>
			</div>
			<div
				class="sticker rounded-[18px_10px_16px_8px] border-3 border-ink bg-sand p-4 shadow-(--shadow-hard)"
			>
				<p class="text-lg leading-snug font-bold" dir="auto">
					{promptText[game.current.prompt]?.() ?? game.current.prompt}
				</p>
			</div>
			<div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
				{#each WEIGHTS as weight (weight)}
					<button
						type="button"
						class="btn-chunky bg-paper px-3 py-3 text-sm"
						onclick={() => choose(weight)}
					>
						{weightText[weight]()}
					</button>
				{/each}
			</div>
			{#if game.feedback}
				<p class="text-center text-sm font-bold" dir="auto" aria-live="polite">
					{m.alignment_feedback({
						helpful: game.feedback.helpful,
						drift: game.feedback.drift
					})}
				</p>
			{/if}
		{:else}
			<div
				class="sticker flex flex-col gap-3 rounded-[18px_10px_16px_8px] border-3 border-ink bg-paper p-5 shadow-(--shadow-hard)"
			>
				<h2 class="font-display text-2xl font-bold" dir="auto">
					{game.status === 'won' ? m.alignment_result_win() : m.alignment_result_lose()}
				</h2>
				<p class="text-sm leading-snug italic" dir="auto">{amodeiSays}</p>
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
