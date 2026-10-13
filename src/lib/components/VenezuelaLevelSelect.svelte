<!--
	Level select for El Presidente: tilted level cards with stars, best score and locks. A level
	opens once the one before it has been finished.
-->
<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { totalStars } from '#lib/game/venezuela/progress.js';
	import { LEVEL_IDS, type VenezuelaGame } from '#lib/stores/venezuelaGame.svelte.js';
	import { levelName } from './venezuelaText';
	import VenezuelaIcon from './VenezuelaIcon.svelte';
	import VenezuelaStars from './VenezuelaStars.svelte';
	import IconLock from '~icons/lucide/lock';

	let { game }: { game: VenezuelaGame } = $props();

	const TILTS = [-1.6, 1.2, -0.8, 1.8, -1.3];
	const collected = $derived(totalStars(game.progress, LEVEL_IDS));
</script>

<section class="flex flex-col gap-4" aria-labelledby="venezuela-level-select">
	<div class="flex flex-wrap items-end justify-between gap-2">
		<div class="flex items-center gap-3">
			<VenezuelaIcon kind="hero" class="size-14 shrink-0" />
			<div>
				<h2 id="venezuela-level-select" class="text-2xl font-bold">
					{m.venezuela_level_select()}
				</h2>
				<p>{m.venezuela_intro()}</p>
			</div>
		</div>
		<p class="rounded-md border-2 border-ink bg-paper px-2 py-0.5 font-display font-bold">
			{m.venezuela_total_stars({ stars: collected, total: LEVEL_IDS.length * 3 })}
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
						? `${m.venezuela_level_label({ number: index + 1 })}, ${levelName(index)}, ${m.venezuela_level_stars({ stars: game.starsFor(levelId) })}`
						: m.venezuela_level_locked({ number: index + 1 })}
					onclick={() => game.openLevel(index)}
				>
					<span class="font-display text-3xl leading-none font-bold">{index + 1}</span>
					{#if unlocked}
						<span dir="auto" class="text-sm leading-tight font-bold">{levelName(index)}</span>
						<VenezuelaStars stars={game.starsFor(levelId)} class="size-4" />
						{#if best !== null}
							<span class="text-xs font-bold tabular-nums"
								>{m.venezuela_level_best({ score: best })}</span
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
