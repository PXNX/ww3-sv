<!--
	Island map for Beachhead: the home shore and the six islands, what is controlled and what each
	one adds to the tax income. An island opens once the one before it is controlled; tapping an
	open island starts an attack.
-->
<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { ISLAND_IDS } from '#lib/game/beachhead/config.js';
	import { ISLAND_INCOME } from '#lib/game/beachhead/campaign.js';
	import type { BeachheadGame } from '#lib/stores/beachheadGame.svelte.js';
	import { islandName } from './beachheadText';
	import BeachheadStars from './BeachheadStars.svelte';
	import IconAnchor from '~icons/lucide/anchor';
	import IconLock from '~icons/lucide/lock';
	import IconTreePalm from '~icons/lucide/tree-palm';

	let { game }: { game: BeachheadGame } = $props();

	const TILTS = [-1.4, 1.1, -0.7, 1.6, -1.2, 0.9];
</script>

<section class="flex flex-col gap-4" aria-labelledby="beachhead-map-title">
	<div class="flex flex-wrap items-end justify-between gap-2">
		<div class="flex items-center gap-3">
			<span
				class="flex size-14 shrink-0 items-center justify-center rounded-[14px_8px_16px_10px] border-3 border-ink bg-flag-blue text-paper shadow-[3px_3px_0_var(--color-ink)]"
			>
				<IconTreePalm class="size-8" aria-hidden="true" />
			</span>
			<div>
				<h2 id="beachhead-map-title" class="text-2xl font-bold">{m.beachhead_map_title()}</h2>
				<p>{m.beachhead_map_intro()}</p>
			</div>
		</div>
		<div class="flex flex-wrap items-center gap-2 font-display font-bold">
			<p class="rounded-md border-2 border-ink bg-paper px-2 py-0.5">
				{m.beachhead_supplies({ count: game.supplies })}
			</p>
			<p class="rounded-md border-2 border-ink bg-explosion-yellow px-2 py-0.5">
				{m.beachhead_income({ rate: game.incomeRate })}
			</p>
			<p class="rounded-md border-2 border-ink bg-paper px-2 py-0.5">
				{m.beachhead_controlled_count({ count: game.controlled, total: game.islandCount })}
			</p>
		</div>
	</div>

	<button
		type="button"
		class="sticker sticker-interactive flex w-full flex-wrap items-center justify-between gap-2 p-3 text-start"
		style:--tilt="-0.6deg"
		onclick={() => game.goBase()}
	>
		<span class="flex items-center gap-3">
			<IconAnchor class="size-8 shrink-0" aria-hidden="true" />
			<span class="flex flex-col leading-tight">
				<span class="text-lg font-bold">{m.beachhead_home_base()}</span>
				<span class="text-sm font-semibold">{m.beachhead_income({ rate: game.incomeRate })}</span>
			</span>
		</span>
		<span class="rounded-md border-2 border-ink bg-sand px-2 py-0.5 text-sm font-bold">
			{m.beachhead_to_base()}
		</span>
	</button>

	<ol class="grid grid-cols-2 gap-4 sm:grid-cols-3">
		{#each ISLAND_IDS as islandId, index (islandId)}
			{@const unlocked = game.isUnlocked(index)}
			{@const controlled = game.isControlled(islandId)}
			{@const stars = game.starsFor(islandId)}
			{@const best = unlocked ? game.bestFor(islandId) : null}
			{@const tax = ISLAND_INCOME[index] ?? 0}
			<li class="flex">
				<button
					type="button"
					class="sticker sticker-interactive flex min-h-40 w-full flex-col items-center justify-center gap-1 p-2 text-center disabled:cursor-not-allowed disabled:bg-sand"
					style:--tilt="{TILTS[index % TILTS.length]}deg"
					disabled={!unlocked}
					aria-label={unlocked
						? `${m.beachhead_island_label({ index: index + 1 })}, ${islandName(index)}, ${controlled ? `${m.beachhead_island_controlled()}, ${m.beachhead_island_tax({ rate: tax })}` : m.beachhead_island_stars({ stars })}`
						: `${m.beachhead_island_label({ index: index + 1 })}, ${m.beachhead_island_locked()}`}
					onclick={() => game.openIsland(index)}
				>
					<span class="flex items-center gap-1 font-display text-lg leading-none font-bold">
						<span class="text-2xl">{index + 1}</span>
						{#if controlled}
							<span
								class="rounded-md border-2 border-ink bg-khaki px-1 py-0.5 text-[0.65rem] uppercase"
								>{m.beachhead_island_controlled()}</span
							>
						{/if}
					</span>
					{#if unlocked}
						<span dir="auto" class="text-sm leading-tight font-bold">{islandName(index)}</span>
						<BeachheadStars {stars} class="size-4" />
						{#if controlled}
							<span class="text-xs font-bold text-khaki tabular-nums">
								{m.beachhead_island_tax({ rate: tax })}
							</span>
						{:else}
							<span
								class="rounded-md border-2 border-ink bg-explosion-yellow px-2 py-0.5 text-xs font-bold"
							>
								{m.beachhead_attack_island()}
							</span>
						{/if}
						{#if best !== null}
							<span class="text-xs font-bold tabular-nums"
								>{m.beachhead_island_best({ score: best })}</span
							>
						{/if}
					{:else}
						<IconLock class="size-5" aria-hidden="true" />
						<span class="text-xs leading-tight font-semibold">{m.beachhead_island_locked()}</span>
					{/if}
				</button>
			</li>
		{/each}
	</ol>
</section>
