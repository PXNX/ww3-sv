<!--
	Level select for GPS Liar: tilted level cards with stars, best score and locks. A level
	opens once the one before it has been finished.
-->
<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { totalStars } from '#lib/game/gpsliar/progress.js';
	import { LEVEL_IDS, type GpsLiarGame } from '#lib/stores/gpsliarGame.svelte.js';
	import { levelName } from './gpsliarText';
	import IconCompass from '~icons/lucide/compass';
	import GpsLiarStars from './GpsLiarStars.svelte';
	import IconLock from '~icons/lucide/lock';

	let { game }: { game: GpsLiarGame } = $props();

	const TILTS = [-1.6, 1.2, -0.8, 1.8, -1.3];
	const collected = $derived(totalStars(game.progress, LEVEL_IDS));
</script>

<section class="flex flex-col gap-4" aria-labelledby="gpsliar-level-select">
	<div class="flex flex-wrap items-end justify-between gap-2">
		<div class="flex items-center gap-3">
			<IconCompass class="size-14 shrink-0" aria-hidden="true" />
			<div>
				<h2 id="gpsliar-level-select" class="text-2xl font-bold">
					{m.gpsliar_level_select()}
				</h2>
				<p>{m.gpsliar_intro()}</p>
			</div>
		</div>
		<p class="rounded-md border-2 border-ink bg-paper px-2 py-0.5 font-display font-bold">
			{m.gpsliar_total_stars({ stars: collected, total: LEVEL_IDS.length * 3 })}
		</p>
	</div>

	<ol class="grid grid-cols-2 gap-4 sm:grid-cols-3">
		{#each LEVEL_IDS as levelId, index (levelId)}
			{@const unlocked = game.isUnlocked(index)}
			{@const best = unlocked ? game.bestFor(levelId) : null}
			<li class="flex">
				<button
					type="button"
					class="sticker sticker-interactive flex min-h-28 w-full flex-col items-center justify-center gap-1 p-2 text-center disabled:cursor-not-allowed disabled:bg-sand"
					style:--tilt="{TILTS[index % TILTS.length]}deg"
					disabled={!unlocked}
					aria-label={unlocked
						? `${m.gpsliar_level_label({ number: index + 1 })}, ${levelName(index)}, ${m.gpsliar_level_stars({ stars: game.starsFor(levelId) })}`
						: m.gpsliar_level_locked({ number: index + 1 })}
					onclick={() => game.openLevel(index)}
				>
					<span class="font-display text-3xl leading-none font-bold">{index + 1}</span>
					{#if unlocked}
						<span dir="auto" class="text-sm leading-tight font-bold">{levelName(index)}</span>
						<GpsLiarStars stars={game.starsFor(levelId)} class="size-4" />
						{#if best !== null}
							<span class="text-xs font-bold tabular-nums"
								>{m.gpsliar_level_best({ score: best })}</span
							>
						{/if}
					{:else}
						<IconLock class="size-5" aria-hidden="true" />
					{/if}
				</button>
			</li>
		{/each}
	</ol>
</section>
