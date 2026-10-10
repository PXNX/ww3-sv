<!--
	Map picker for Drone Wall: one small card per map, drawn from the map's own road and colours,
	in a row that scrolls sideways (there are eleven maps). Big maps that scroll in the game are
	squeezed into the same card and marked with an arrow. Used before the first game and on the
	game-over screen.
-->
<script lang="ts">
	import { MAP_DEFS, WORLD_WIDTH, isTallMap, type MapId } from '#lib/game/dronewall/config.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { DroneWallGame } from '#lib/stores/dronewallGame.svelte.js';
	import IconUpDown from '~icons/lucide/chevrons-up-down';

	let { game }: { game: DroneWallGame } = $props();

	/** Thickness of each flag stripe at the line, thicker on big maps so it stays visible squeezed */
	const strip = (height: number) => Math.max(20, height * 0.03);

	const NAMES: Record<MapId, () => string> = {
		serpentine: m.dronewall_map_serpentine,
		riverbend: m.dronewall_map_riverbend,
		lightning: m.dronewall_map_lightning,
		switchbacks: m.dronewall_map_switchbacks,
		ridge: m.dronewall_map_ridge,
		oxbow: m.dronewall_map_oxbow,
		barricades: m.dronewall_map_barricades,
		longmarch: m.dronewall_map_longmarch,
		blackforest: m.dronewall_map_blackforest,
		tundra: m.dronewall_map_tundra,
		metropolis: m.dronewall_map_metropolis
	};
</script>

<div class="flex w-full min-w-0 flex-col items-center gap-1">
	<p class="font-display text-sm font-bold">{m.dronewall_map_pick()}</p>
	<ul class="flex w-full snap-x gap-1.5 overflow-x-auto px-0.5 pb-1.5">
		{#each MAP_DEFS as map (map.id)}
			{@const chosen = game.mapId === map.id}
			{@const tall = isTallMap(map)}
			<li class="shrink-0 snap-start">
				<button
					type="button"
					class="btn-chunky relative w-[4.4rem] flex-col gap-0.5 px-1 py-1 text-[0.65rem] leading-tight {chosen
						? 'bg-explosion-yellow'
						: 'bg-paper'}"
					aria-pressed={chosen}
					onclick={() => game.selectMap(map.id)}
				>
					<!-- The whole map squeezed into one card, strokes keep their size -->
					<svg
						viewBox="0 0 {WORLD_WIDTH} {map.height}"
						preserveAspectRatio="none"
						class="h-16 w-10 rounded-[3px] border-2 border-ink"
						aria-hidden="true"
					>
						<rect width={WORLD_WIDTH} height={map.height} fill={map.theme.field} />
						<polyline
							points={map.points.map((point) => `${point.x},${point.y}`).join(' ')}
							fill="none"
							stroke="var(--color-ink)"
							stroke-width="5.5"
							stroke-linejoin="round"
							vector-effect="non-scaling-stroke"
						/>
						<polyline
							points={map.points.map((point) => `${point.x},${point.y}`).join(' ')}
							fill="none"
							stroke={map.theme.road}
							stroke-width="3.5"
							stroke-linejoin="round"
							vector-effect="non-scaling-stroke"
						/>
						{#each map.slots as slot, index (index)}
							<ellipse
								cx={slot.x}
								cy={slot.y}
								rx="14"
								ry={14 * (map.height / 640)}
								fill="var(--color-ink)"
								fill-opacity="0.45"
							/>
						{/each}
						<rect
							y={map.lineY}
							width={WORLD_WIDTH}
							height={strip(map.height)}
							fill="var(--color-flag-blue)"
						/>
						<rect
							y={map.lineY + strip(map.height)}
							width={WORLD_WIDTH}
							height={strip(map.height)}
							fill="var(--color-explosion-yellow)"
						/>
					</svg>
					{#if tall}
						<span
							class="absolute top-0.5 right-0.5 inline-flex rounded-full border-2 border-ink bg-tie-red p-0.5"
							title={m.dronewall_map_tall()}
						>
							<IconUpDown class="size-2.5 text-paper" aria-label={m.dronewall_map_tall()} />
						</span>
					{/if}
					<span class="text-center">{NAMES[map.id]()}</span>
				</button>
			</li>
		{/each}
	</ul>
</div>
