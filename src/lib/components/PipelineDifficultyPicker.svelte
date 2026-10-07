<!-- Difficulty choice before a Pipeline Panic game; the last choice is highlighted and focused -->
<script lang="ts" module>
	import type { Difficulty } from '#lib/game/pipeline/pipelineStep.js';
	import { m } from '#lib/paraglide/messages.js';

	export const LEVEL_NAMES: Record<Difficulty, () => string> = {
		easy: m.pipeline_difficulty_easy,
		normal: m.pipeline_difficulty_normal,
		hard: m.pipeline_difficulty_hard
	};
</script>

<script lang="ts">
	import { DIFFICULTIES, DIFFICULTY_CONFIG } from '#lib/game/pipeline/pipelineStep.js';
	import { highscores } from '#lib/services/highscore.js';
	import IconGrid from '~icons/lucide/grid-3x3';
	import IconTrophy from '~icons/lucide/trophy';

	let { selected, onpick }: { selected: Difficulty; onpick: (level: Difficulty) => void } =
		$props();

	const TILTS: Record<Difficulty, number> = { easy: -1.6, normal: 1.2, hard: -0.8 };

	const focusSelected = (element: HTMLElement) => element.focus();
</script>

<section class="flex flex-col gap-4" aria-labelledby="pipeline-difficulty">
	<p class="leading-snug">{m.mode_pipeline_description()}</p>
	<h2 id="pipeline-difficulty" class="text-2xl font-bold">{m.pipeline_choose_difficulty()}</h2>
	<ul class="grid gap-4 sm:grid-cols-3">
		{#each DIFFICULTIES as level (level)}
			{@const config = DIFFICULTY_CONFIG[level]}
			{@const bestScore = highscores().get(['pipeline', level, 'score'])}
			<li class="flex">
				<button
					type="button"
					class="sticker sticker-interactive flex w-full flex-col items-start gap-1 p-4 text-start active:scale-95 {level ===
					selected
						? 'bg-explosion-yellow'
						: ''}"
					style:--tilt="{TILTS[level]}deg"
					aria-current={level === selected ? 'true' : undefined}
					onclick={() => onpick(level)}
					{@attach (element) => {
						if (level === selected) focusSelected(element);
					}}
				>
					<span class="font-display text-2xl leading-none font-bold">{LEVEL_NAMES[level]()}</span>
					<span class="flex items-center gap-1.5 text-sm" dir="ltr">
						<IconGrid class="size-4" aria-hidden="true" />
						{config.size}×{config.size}
					</span>
					{#if bestScore !== null}
						<span class="mt-1 flex items-center gap-1.5 text-sm font-bold">
							<IconTrophy class="size-4" aria-hidden="true" />
							{m.minefield_best_score({ score: bestScore })}
						</span>
					{/if}
				</button>
			</li>
		{/each}
	</ul>
</section>
