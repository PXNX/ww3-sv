<!--
	Level select for Magyar's Birds: fifteen tilted level cards with stars, best score and locks,
	followed by the generated levels once the prepared ones are won
-->
<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { LEVEL_IDS, type FuryGame } from '#lib/stores/furyGame.svelte.js';
	import { levelIdAt } from '#lib/game/fury/levels/index.js';
	import { totalStars } from '#lib/game/fury/progress.js';
	import FuryStars from './FuryStars.svelte';
	import IconLock from '~icons/lucide/lock';

	let { game }: { game: FuryGame } = $props();

	const TILTS = [-1.6, 1.2, -0.8, 1.8, -1.3, 0.9, -1.9, 1.4];
	const collected = $derived(totalStars(game.progress, LEVEL_IDS));
</script>

<section class="flex flex-col gap-4" aria-labelledby="fury-level-select">
	<div class="flex flex-wrap items-end justify-between gap-2">
		<div>
			<h2 id="fury-level-select" class="text-2xl font-bold">{m.fury_level_select()}</h2>
			<p>{m.fury_intro()}</p>
		</div>
		<p class="rounded-md border-2 border-ink bg-paper px-2 py-0.5 font-display font-bold">
			{m.fury_total_stars({ stars: collected, total: LEVEL_IDS.length * 3 })}
		</p>
	</div>

	<ol class="grid grid-cols-3 gap-4 sm:grid-cols-5">
		{#each { length: game.visibleLevels }, index (index)}
			{@const levelId = levelIdAt(index)}
			{@const unlocked = game.isUnlocked(index)}
			{@const best = unlocked ? game.bestFor(levelId) : null}
			{#if index === LEVEL_IDS.length}
				<li class="col-span-full">
					<h3 class="text-xl font-bold">{m.fury_endless_title()}</h3>
					<p>{m.fury_endless_intro()}</p>
				</li>
			{/if}
			<li class="flex">
				<button
					type="button"
					class="sticker sticker-interactive flex min-h-24 w-full flex-col items-center justify-center gap-1 p-2 disabled:cursor-not-allowed disabled:bg-sand"
					style:--tilt="{TILTS[index % TILTS.length]}deg"
					disabled={!unlocked}
					aria-label={unlocked
						? `${m.fury_level_label({ number: index + 1 })}, ${m.fury_level_stars({ stars: game.starsFor(levelId) })}`
						: m.fury_level_locked({ number: index + 1 })}
					onclick={() => game.openLevel(index)}
				>
					<span class="font-display text-3xl leading-none font-bold">{index + 1}</span>
					{#if unlocked}
						<FuryStars stars={game.starsFor(levelId)} class="size-4" />
						{#if best !== null}
							<span class="text-xs font-bold tabular-nums"
								>{m.fury_level_best({ score: best })}</span
							>
						{/if}
					{:else}
						<IconLock class="size-5" aria-hidden="true" />
					{/if}
				</button>
			</li>
		{/each}
	</ol>

	<label class="flex min-h-11 items-center gap-2 self-start font-semibold">
		<input
			type="checkbox"
			class="checkbox border-3 border-ink"
			checked={game.settings.longPreview}
			onchange={(event) => game.setLongPreview(event.currentTarget.checked)}
		/>
		{m.fury_long_preview()}
	</label>
</section>
