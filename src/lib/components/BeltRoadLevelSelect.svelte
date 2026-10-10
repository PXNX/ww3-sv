<!--
	Level select for Belt & Road: eighteen tilted level cards in three tiers, with stars, the fewest
	moves so far and a lock on levels that are not open yet
-->
<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { TIERS, type Tier } from '#lib/game/beltroad/board.js';
	import { tierLevels } from '#lib/game/beltroad/levels.js';
	import type { BeltRoadGame } from '#lib/stores/beltroadGame.svelte.js';
	import BeltRoadStars from './BeltRoadStars.svelte';
	import IconLock from '~icons/lucide/lock';

	let { game }: { game: BeltRoadGame } = $props();

	const TILTS = [-1.6, 1.2, -0.8, 1.8, -1.3, 0.9];

	const tierName: Record<Tier, () => string> = {
		easy: m.beltroad_tier_easy,
		medium: m.beltroad_tier_medium,
		hard: m.beltroad_tier_hard
	};
</script>

<section class="flex flex-col gap-4" aria-labelledby="beltroad-level-select">
	<div class="flex flex-wrap items-end justify-between gap-2">
		<div>
			<h2 id="beltroad-level-select" class="text-2xl font-bold">{m.beltroad_level_select()}</h2>
			<p>{m.beltroad_intro()}</p>
		</div>
		<p class="rounded-md border-2 border-ink bg-paper px-2 py-0.5 font-display font-bold">
			{m.beltroad_total_stars({ stars: game.totalStars, total: game.maxStars })}
		</p>
	</div>

	{#each TIERS as tier (tier)}
		<div class="flex flex-col gap-2">
			<h3 class="text-xl font-bold">{tierName[tier]()}</h3>
			<ol class="grid grid-cols-3 gap-2 sm:grid-cols-6 sm:gap-3">
				{#each tierLevels(tier) as { level, index } (level.id)}
					{@const unlocked = game.isUnlocked(index)}
					{@const best = unlocked ? game.bestFor(level.id) : null}
					<li class="flex">
						<button
							type="button"
							class="sticker sticker-interactive flex min-h-20 w-full flex-col items-center justify-center gap-0.5 p-1 disabled:cursor-not-allowed disabled:bg-sand"
							style:--tilt="{TILTS[index % TILTS.length]}deg"
							disabled={!unlocked}
							aria-label={unlocked
								? `${m.beltroad_level_label({ number: index + 1 })}, ${m.beltroad_level_stars({ stars: game.starsFor(level.id) })}`
								: m.beltroad_level_locked({ number: index + 1 })}
							onclick={() => game.openLevel(index)}
						>
							<span class="font-display text-2xl leading-none font-bold">{index + 1}</span>
							<span class="text-xs font-bold tabular-nums">{level.width}x{level.height}</span>
							{#if unlocked}
								<BeltRoadStars stars={game.starsFor(level.id)} class="size-3.5 sm:size-4" />
								{#if best !== null}
									<span class="text-xs font-bold tabular-nums"
										>{m.beltroad_level_best({ moves: best })}</span
									>
								{/if}
							{:else}
								<IconLock class="size-5" aria-hidden="true" />
							{/if}
						</button>
					</li>
				{/each}
			</ol>
		</div>
	{/each}
</section>
