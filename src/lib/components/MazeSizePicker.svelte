<!-- Building size choice before a run: three tilted cards with what each building is made of -->
<script lang="ts">
	import { SIZE_IDS, SIZES, type SizeId } from '#lib/game/maze/difficulty.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { MazeGame } from '#lib/stores/mazeGame.svelte.js';
	import IconCalendarX from '~icons/lucide/calendar-x';
	import IconFileText from '~icons/lucide/file-text';
	import IconGrid from '~icons/lucide/layout-grid';
	import IconTrophy from '~icons/lucide/trophy';

	let { game }: { game: MazeGame } = $props();

	const TILTS: Record<SizeId, number> = { small: -1.6, medium: 1.2, large: -0.8 };
	const NAMES: Record<SizeId, () => string> = {
		small: m.maze_size_small,
		medium: m.maze_size_medium,
		large: m.maze_size_large
	};
</script>

<section class="flex flex-col gap-4" aria-labelledby="maze-size-title">
	<p class="leading-snug">{m.maze_intro()}</p>
	<h2 id="maze-size-title" class="text-2xl font-bold">{m.maze_choose_size()}</h2>
	<ul class="grid gap-4 sm:grid-cols-3">
		{#each SIZE_IDS as id (id)}
			{@const config = SIZES[id]}
			{@const best = game.bestFor(id)}
			<li class="flex">
				<button
					type="button"
					class="sticker sticker-interactive flex w-full flex-col items-start gap-1 p-4 text-start active:scale-95"
					style:--tilt="{TILTS[id]}deg"
					onclick={() => game.start(id)}
				>
					<span class="font-display text-2xl leading-none font-bold">{NAMES[id]()}</span>
					<span class="flex items-center gap-1.5 text-sm">
						<IconGrid class="size-4" aria-hidden="true" />
						{m.maze_size_rooms({ rooms: config.width * config.height })}
					</span>
					<span class="flex items-center gap-1.5 text-sm">
						<IconFileText class="size-4" aria-hidden="true" />
						{m.maze_size_documents({ count: config.locks })}
					</span>
					<span class="flex items-center gap-1.5 text-sm">
						<IconCalendarX class="size-4" aria-hidden="true" />
						{m.maze_size_closed({ count: config.closed })}
					</span>
					{#if best !== null}
						<span class="mt-1 flex items-center gap-1.5 text-sm font-bold">
							<IconTrophy class="size-4" aria-hidden="true" />
							{m.maze_best_steps({ steps: best })}
						</span>
					{/if}
				</button>
			</li>
		{/each}
	</ul>
</section>
