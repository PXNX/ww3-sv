<!-- Difficulty choice before a game; the last choice is highlighted and focused -->
<script lang="ts" module>
	import type { DifficultyId } from '$lib/game/minefield/difficulty';
	import { m } from '$lib/paraglide/messages';

	export const DIFFICULTY_NAMES: Record<DifficultyId, () => string> = {
		easy: m.minefield_difficulty_easy,
		normal: m.minefield_difficulty_normal,
		hard: m.minefield_difficulty_hard
	};
</script>

<script lang="ts">
	import { DIFFICULTIES, DIFFICULTY_IDS } from '$lib/game/minefield/difficulty';
	import { formatTime } from '$lib/game/minefield/scoring';
	import { highscores } from '$lib/services/highscore';
	import { bestParts } from '$lib/stores/minefieldGame.svelte';
	import { spriteSrc } from '$lib/theme/sprites';
	import IconBomb from '~icons/lucide/bomb';
	import IconGrid from '~icons/lucide/grid-3x3';
	import IconTimer from '~icons/lucide/timer';
	import IconTrophy from '~icons/lucide/trophy';

	let { selected, onpick }: { selected: DifficultyId; onpick: (id: DifficultyId) => void } =
		$props();

	const TILTS: Record<DifficultyId, number> = { easy: -1.6, normal: 1.2, hard: -0.8 };

	const focusSelected = (element: HTMLElement) => element.focus();
</script>

<section class="flex flex-col gap-4" aria-labelledby="minefield-difficulty">
	<p class="leading-snug">{m.minefield_intro()}</p>
	<h2 id="minefield-difficulty" class="text-2xl font-bold">{m.minefield_choose_difficulty()}</h2>
	<ul class="grid gap-4 sm:grid-cols-3">
		{#each DIFFICULTY_IDS as id (id)}
			{@const level = DIFFICULTIES[id]}
			{@const bestScore = highscores().get(bestParts(id, 'score'))}
			{@const bestTime = highscores().get(bestParts(id, 'time'))}
			<li class="flex">
				<button
					type="button"
					class="sticker sticker-interactive flex w-full flex-col items-start gap-1 p-4 text-start active:scale-95 {id ===
					selected
						? 'bg-explosion-yellow'
						: ''}"
					style:--tilt="{TILTS[id]}deg"
					aria-current={id === selected ? 'true' : undefined}
					onclick={() => onpick(id)}
					{@attach (element) => {
						if (id === selected) focusSelected(element);
					}}
				>
					<span class="font-display text-2xl leading-none font-bold">{DIFFICULTY_NAMES[id]()}</span>
					<span class="flex items-center gap-1.5 text-sm">
						<IconGrid class="size-4" aria-hidden="true" />
						{m.minefield_grid_size({ columns: level.columns, rows: level.rows })}
					</span>
					<span class="flex items-center gap-1.5 text-sm">
						<IconBomb class="size-4" aria-hidden="true" />
						{m.minefield_mine_density({ percent: Math.round(level.mineDensity * 100) })}
					</span>
					<span class="flex items-center gap-1.5 text-sm">
						<img src={spriteSrc('submarine')} alt="" class="w-5" />
						{m.minefield_submarine_count({ count: level.submarines })}
					</span>
					{#if bestScore !== null}
						<span class="mt-1 flex items-center gap-1.5 text-sm font-bold">
							<IconTrophy class="size-4" aria-hidden="true" />
							{m.minefield_best_score({ score: bestScore })}
						</span>
					{/if}
					{#if bestTime !== null}
						<span class="flex items-center gap-1.5 text-sm font-bold">
							<IconTimer class="size-4" aria-hidden="true" />
							{m.minefield_best_time({ time: formatTime(bestTime) })}
						</span>
					{/if}
				</button>
			</li>
		{/each}
	</ul>
</section>
