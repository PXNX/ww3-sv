<!--
	Map picker for Drone Wall: one small card per map, drawn from the map's own road and colours.
	Used before the first game and on the game-over screen.
-->
<script lang="ts">
	import { MAP_DEFS, WORLD_HEIGHT, WORLD_WIDTH, type MapId } from '#lib/game/dronewall/config.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { DroneWallGame } from '#lib/stores/dronewallGame.svelte.js';

	let { game }: { game: DroneWallGame } = $props();

	const NAMES: Record<MapId, () => string> = {
		serpentine: m.dronewall_map_serpentine,
		riverbend: m.dronewall_map_riverbend,
		lightning: m.dronewall_map_lightning,
		switchbacks: m.dronewall_map_switchbacks
	};
</script>

<div class="flex w-full flex-col items-center gap-1">
	<p class="font-display text-sm font-bold">{m.dronewall_map_pick()}</p>
	<ul class="grid w-full grid-cols-4 gap-1.5">
		{#each MAP_DEFS as map (map.id)}
			{@const chosen = game.mapId === map.id}
			<li class="contents">
				<button
					type="button"
					class="btn-chunky flex-col gap-0.5 px-1 py-1 text-[0.65rem] leading-tight {chosen
						? 'bg-explosion-yellow'
						: 'bg-paper'}"
					aria-pressed={chosen}
					onclick={() => game.selectMap(map.id)}
				>
					<svg
						viewBox="0 0 {WORLD_WIDTH} {WORLD_HEIGHT}"
						class="h-14 w-auto rounded-[3px] border-2 border-ink"
						aria-hidden="true"
					>
						<rect width={WORLD_WIDTH} height={WORLD_HEIGHT} fill={map.theme.field} />
						<polyline
							points={map.points.map((point) => `${point.x},${point.y}`).join(' ')}
							fill="none"
							stroke="var(--color-ink)"
							stroke-width="46"
							stroke-linejoin="round"
						/>
						<polyline
							points={map.points.map((point) => `${point.x},${point.y}`).join(' ')}
							fill="none"
							stroke={map.theme.road}
							stroke-width="34"
							stroke-linejoin="round"
						/>
						{#each map.slots as slot, index (index)}
							<circle cx={slot.x} cy={slot.y} r="16" fill="var(--color-ink)" fill-opacity="0.45" />
						{/each}
						<rect y="600" width={WORLD_WIDTH} height="20" fill="var(--color-flag-blue)" />
						<rect y="620" width={WORLD_WIDTH} height="20" fill="var(--color-explosion-yellow)" />
					</svg>
					<span class="text-center">{NAMES[map.id]()}</span>
				</button>
			</li>
		{/each}
	</ul>
</div>
