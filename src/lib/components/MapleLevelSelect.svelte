<!--
	Level select for Maple Reserve Heist: tilted level cards with stars, best score and locks. A level
	opens once the one before it has been finished.
-->
<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { totalStars } from '#lib/game/maple/progress.js';
	import { LEVEL_IDS, type MapleGame } from '#lib/stores/mapleGame.svelte.js';
	import { levelName } from './mapleText';
	import IconLeaf from '~icons/lucide/leaf';
	import MapleStars from './MapleStars.svelte';
	import IconLock from '~icons/lucide/lock';

	let { game }: { game: MapleGame } = $props();

	const TILTS = [-1.6, 1.2, -0.8, 1.8, -1.3];
	const collected = $derived(totalStars(game.progress, LEVEL_IDS));
</script>

<section class="flex flex-col gap-4" aria-labelledby="maple-level-select">
	<div class="flex flex-wrap items-end justify-between gap-2">
		<div class="flex items-center gap-3">
			<IconLeaf class="size-14 shrink-0" aria-hidden="true" />
			<div>
				<h2 id="maple-level-select" class="text-2xl font-bold">
					{m.maple_level_select()}
				</h2>
				<p>{m.maple_intro()}</p>
			</div>
		</div>
		<p class="rounded-md border-2 border-ink bg-paper px-2 py-0.5 font-display font-bold">
			{m.maple_total_stars({ stars: collected, total: LEVEL_IDS.length * 3 })}
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
						? `${m.maple_level_label({ number: index + 1 })}, ${levelName(index)}, ${m.maple_level_stars({ stars: game.starsFor(levelId) })}`
						: m.maple_level_locked({ number: index + 1 })}
					onclick={() => game.openLevel(index)}
				>
					<span class="font-display text-3xl leading-none font-bold">{index + 1}</span>
					{#if unlocked}
						<span dir="auto" class="text-sm leading-tight font-bold">{levelName(index)}</span>
						<MapleStars stars={game.starsFor(levelId)} class="size-4" />
						{#if best !== null}
							<span class="text-xs font-bold tabular-nums"
								>{m.maple_level_best({ score: best })}</span
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
