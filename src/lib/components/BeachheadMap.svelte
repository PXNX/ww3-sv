<!--
	The sea chart: the home shore and every island, drawn where it lies on the water instead of in a
	list of levels. Dashed sailing routes lead out from the home shore, the radar tower charts new
	waters, and the enemy retakes one controlled island every six hours.
-->
<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { ISLAND_IDS, ISLAND_MAP_POSITIONS } from '#lib/game/beachhead/config.js';
	import type { BeachheadGame } from '#lib/stores/beachheadGame.svelte.js';
	import { islandName } from './beachheadText';
	import BeachheadStars from './BeachheadStars.svelte';
	import BeachheadTakeoverNotice from './BeachheadTakeoverNotice.svelte';
	import IconAnchor from '~icons/lucide/anchor';
	import IconCloudFog from '~icons/lucide/cloud-fog';
	import IconCompass from '~icons/lucide/compass';
	import IconCrosshair from '~icons/lucide/crosshair';
	import IconFlag from '~icons/lucide/flag-triangle-right';
	import IconLock from '~icons/lucide/lock';
	import IconRadar from '~icons/lucide/radar';
	import IconTreePalm from '~icons/lucide/tree-palm';
	import IconWaves from '~icons/lucide/waves';

	let { game }: { game: BeachheadGame } = $props();

	const TILTS = [-1.4, 1.1, -0.7, 1.6, -1.2, 0.9, -1.8, 0.6, 1.4];
	const HOME = { x: 9, y: 83 };

	/** The sailing route from the home shore through every charted island */
	const route = $derived.by(() => {
		const points = [HOME, ...ISLAND_MAP_POSITIONS.slice(0, game.chartedCount)];
		return points
			.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
			.join(' ');
	});

	const islandAria = (index: number, islandId: string): string => {
		const name = islandName(index);
		if (!game.isCharted(index)) {
			return `${m.beachhead_island_label({ index: index + 1 })}, ${name}, ${m.beachhead_island_uncharted()}`;
		}
		if (game.isControlled(islandId)) {
			return `${name}, ${m.beachhead_island_controlled()}, ${m.beachhead_island_tax(game.incomeFor(index))}`;
		}
		if (game.isUnlocked(index)) {
			return `${name}, ${m.beachhead_attack_island()}, ${m.beachhead_island_stars({ stars: game.starsFor(islandId) })}`;
		}
		return `${name}, ${m.beachhead_island_locked()}`;
	};
</script>

<section class="flex flex-col gap-4" aria-labelledby="beachhead-map-title">
	<div class="flex flex-wrap items-end justify-between gap-2">
		<div class="flex items-center gap-3">
			<span
				class="island-bob flex size-14 shrink-0 items-center justify-center rounded-[14px_8px_16px_10px] border-3 border-ink bg-flag-blue text-paper shadow-[3px_3px_0_var(--color-ink)]"
			>
				<IconTreePalm class="size-8" aria-hidden="true" />
			</span>
			<div>
				<h2 id="beachhead-map-title" class="text-2xl font-bold">{m.beachhead_map_title()}</h2>
				<p>{m.beachhead_map_intro()}</p>
			</div>
		</div>
		<div class="flex flex-wrap items-center gap-2 font-display font-bold">
			<p class="rounded-md border-2 border-ink bg-explosion-yellow px-2 py-0.5">
				{m.beachhead_income_summary(game.income)}
			</p>
			<p class="rounded-md border-2 border-ink bg-paper px-2 py-0.5">
				{m.beachhead_controlled_count({ count: game.controlled, total: game.islandCount })}
			</p>
			<p class="flex items-center gap-1 rounded-md border-2 border-ink bg-sand px-2 py-0.5">
				<IconRadar class="size-4" aria-hidden="true" />
				{m.beachhead_radar_summary({ count: game.chartedCount, total: game.islandCount })}
			</p>
		</div>
	</div>

	<BeachheadTakeoverNotice {game} />

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
				<span class="text-sm font-semibold">{m.beachhead_income_summary(game.income)}</span>
			</span>
		</span>
		<span class="rounded-md border-2 border-ink bg-sand px-2 py-0.5 text-sm font-bold">
			{m.beachhead_to_base()}
		</span>
	</button>

	<div class="-mx-1 overflow-x-auto px-1 pb-1">
		<div
			class="sea-chart relative mx-auto h-[27rem] w-full min-w-[36rem] overflow-hidden rounded-[22px_14px_26px_16px] border-3 border-ink shadow-[5px_5px_0_var(--color-ink)] sm:h-[34rem] sm:min-w-0"
			role="group"
			aria-label={m.beachhead_map_title()}
		>
			<div class="sea-depth absolute inset-0" aria-hidden="true"></div>
			<IconWaves
				class="pointer-events-none absolute -right-6 -bottom-8 size-48 text-paper/15"
				aria-hidden="true"
			/>

			<svg
				class="pointer-events-none absolute inset-0 size-full"
				viewBox="0 0 100 100"
				preserveAspectRatio="none"
				aria-hidden="true"
			>
				<path
					d={route}
					fill="none"
					stroke="var(--color-paper)"
					stroke-width="2.5"
					stroke-dasharray="2.5 5"
					stroke-linecap="round"
					stroke-linejoin="round"
					opacity="0.55"
					vector-effect="non-scaling-stroke"
				/>
			</svg>

			<span
				class="pointer-events-none absolute top-3 right-3 flex size-11 items-center justify-center rounded-full border-2 border-ink bg-paper/85 text-flag-blue shadow-[2px_2px_0_var(--color-ink)]"
				aria-hidden="true"
			>
				<IconCompass class="size-7" />
			</span>

			<!-- The home shore, where the boats and the builders live -->
			<button
				type="button"
				class="map-marker sticker sticker-interactive absolute z-10 flex w-[6.2rem] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 p-1.5 text-center"
				style:--tilt="-2deg"
				style:left="{HOME.x}%"
				style:top="{HOME.y}%"
				aria-label={m.beachhead_home_base()}
				onclick={() => game.goBase()}
			>
				<span
					class="flex size-11 items-center justify-center rounded-[46%_54%_52%_48%] border-2 border-ink bg-khaki text-paper shadow-[2px_2px_0_var(--color-ink)]"
				>
					<IconAnchor class="size-6" aria-hidden="true" />
				</span>
				<span class="text-[0.7rem] leading-tight font-bold">{m.beachhead_home_base()}</span>
			</button>

			<ol class="absolute inset-0 m-0 list-none p-0">
				{#each ISLAND_IDS as islandId, index (islandId)}
					{@const position = ISLAND_MAP_POSITIONS[index] ?? { x: 50, y: 50 }}
					{@const charted = game.isCharted(index)}
					{@const unlocked = charted && game.isUnlocked(index)}
					{@const controlled = game.isControlled(islandId)}
					{@const attackable = unlocked && !controlled}
					{@const stars = game.starsFor(islandId)}
					{@const defense = game.defensePercent(islandId)}
					<li
						class="absolute z-10 -translate-x-1/2 -translate-y-1/2"
						style:left="{position.x}%"
						style:top="{position.y}%"
					>
						<button
							type="button"
							class="map-marker flex w-[7rem] flex-col items-center gap-1 text-center disabled:cursor-not-allowed"
							class:fogged={!charted}
							style:--tilt="{TILTS[index % TILTS.length]}deg"
							disabled={!attackable}
							aria-label={islandAria(index, islandId)}
							onclick={() => game.openIsland(index)}
						>
							<span
								class="island-shape relative flex size-12 items-center justify-center border-2 border-ink shadow-[2px_2px_0_var(--color-ink)] sm:size-14"
								class:island-held={controlled}
								class:island-ready={attackable}
								class:island-locked={charted && !unlocked}
								class:island-fog={!charted}
							>
								{#if !charted}
									<IconCloudFog class="size-7 text-paper" aria-hidden="true" />
								{:else if controlled}
									<IconFlag class="size-7 text-paper" aria-hidden="true" />
								{:else if attackable}
									<IconCrosshair class="size-7 text-ink" aria-hidden="true" />
								{:else}
									<IconLock class="size-6 text-ink/70" aria-hidden="true" />
								{/if}
							</span>

							<span
								dir="auto"
								class="rounded-md border-2 border-ink bg-paper/95 px-1.5 py-0.5 text-[0.7rem] leading-tight font-bold sm:text-xs"
								class:opacity-70={!charted}
							>
								{#if charted}
									{islandName(index)}
								{:else}
									{m.beachhead_island_uncharted_short()}
								{/if}
							</span>

							{#if charted && (controlled || attackable || stars > 0)}
								<span
									class="flex flex-wrap items-center justify-center gap-1 text-[0.65rem] leading-none font-bold"
								>
									{#if controlled}
										<span class="rounded border-2 border-ink bg-khaki px-1 py-0.5 text-paper">
											{m.beachhead_island_controlled()}
										</span>
									{:else if attackable}
										<span
											class="rounded border-2 border-ink bg-explosion-yellow px-1 py-0.5 text-ink"
										>
											{m.beachhead_attack_island()}
										</span>
									{/if}
									{#if stars > 0}
										<span class="rounded border-2 border-ink bg-paper px-1 py-0.5">
											<BeachheadStars {stars} class="size-3" />
										</span>
									{/if}
									{#if defense > 0}
										<span class="rounded border-2 border-ink bg-tie-red px-1 py-0.5 text-paper">
											{m.beachhead_island_defense({ percent: defense })}
										</span>
									{/if}
								</span>
							{:else if charted && !unlocked}
								<span class="text-[0.65rem] leading-tight font-semibold">
									{m.beachhead_island_locked()}
								</span>
							{/if}
						</button>
					</li>
				{/each}
			</ol>
		</div>
	</div>

	<ul class="flex flex-wrap gap-2 text-xs font-semibold">
		<li class="flex items-center gap-1 rounded-md border-2 border-ink bg-paper px-2 py-0.5">
			<span class="size-3 rounded-full border-2 border-ink bg-khaki"></span>
			{m.beachhead_map_legend_held()}
		</li>
		<li class="flex items-center gap-1 rounded-md border-2 border-ink bg-paper px-2 py-0.5">
			<span class="size-3 rounded-full border-2 border-ink bg-explosion-yellow"></span>
			{m.beachhead_map_legend_attack()}
		</li>
		<li class="flex items-center gap-1 rounded-md border-2 border-ink bg-paper px-2 py-0.5">
			<span class="size-3 rounded-full border-2 border-ink bg-sand"></span>
			{m.beachhead_map_legend_locked()}
		</li>
		<li class="flex items-center gap-1 rounded-md border-2 border-ink bg-paper px-2 py-0.5">
			<span class="bg-smoke size-3 rounded-full border-2 border-ink"></span>
			{m.beachhead_map_legend_uncharted()}
		</li>
		<li class="text-smoke flex items-center gap-1">
			<IconRadar class="size-3.5" aria-hidden="true" />
			{m.beachhead_takeback_rhythm()}
		</li>
	</ul>
</section>

<style>
	.sea-chart {
		background:
			radial-gradient(circle at 18% 20%, #8fd0df 0 18%, transparent 19%),
			radial-gradient(circle at 76% 74%, #79c2d4 0 22%, transparent 23%),
			linear-gradient(150deg, #3f8fae 0%, #2e7595 46%, #1f5a78 100%);
	}

	.sea-depth {
		background-image:
			repeating-linear-gradient(115deg, #ffffff10 0 2px, transparent 2px 22px),
			repeating-linear-gradient(25deg, #0000000c 0 1px, transparent 1px 16px);
	}

	.map-marker {
		filter: drop-shadow(0 2px 0 #00000022);
	}

	.island-shape {
		border-radius: 46% 54% 52% 48% / 52% 46% 54% 48%;
		background: var(--color-sand);
		transition:
			transform 160ms ease,
			background-color 160ms ease;
	}

	.map-marker:not(:disabled):hover .island-shape,
	.map-marker:not(:disabled):focus-visible .island-shape {
		transform: translateY(-2px) rotate(2deg) scale(1.06);
	}

	.island-held {
		background: var(--color-khaki);
	}

	.island-ready {
		background: color-mix(in srgb, var(--color-explosion-yellow) 55%, var(--color-sand));
		animation: attack-glow 2.2s ease-in-out infinite;
	}

	.island-locked {
		background: color-mix(in srgb, var(--color-sand) 55%, #9aa6a8);
	}

	.island-fog {
		background: color-mix(in srgb, #6b7f88 70%, #b7c4c8);
		opacity: 0.85;
	}

	.fogged {
		filter: saturate(0.5);
	}

	@keyframes island-bob {
		0%,
		100% {
			transform: translateY(0) rotate(-2deg);
		}
		50% {
			transform: translateY(-3px) rotate(2deg);
		}
	}

	@keyframes attack-glow {
		0%,
		100% {
			box-shadow: 2px 2px 0 var(--color-ink);
		}
		50% {
			box-shadow:
				2px 2px 0 var(--color-ink),
				0 0 0 4px color-mix(in srgb, var(--color-explosion-yellow) 55%, transparent);
		}
	}

	.island-bob {
		animation: island-bob 3.4s ease-in-out infinite;
	}

	@media (prefers-reduced-motion: reduce) {
		.island-bob,
		.island-ready,
		.map-marker:not(:disabled):hover .island-shape,
		.map-marker:not(:disabled):focus-visible .island-shape {
			animation: none;
			transform: none;
		}
	}
</style>
