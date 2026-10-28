<!--
	The campaign bar: the day and what is left of it, the front's size, the four resources the
	regions pay and the four kinds of equipment the factories make.
-->
<script lang="ts">
	import { EQUIPMENT_IDS, MAX_DAYS, REGION_IDS, RESOURCE_IDS } from '#lib/game/warroom/config.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { WarRoomGame } from '#lib/stores/warroomGame.svelte.js';
	import { equipmentName, regionName, resourceName } from './warroomText.js';
	import IconAnvil from '~icons/lucide/anvil';
	import IconBomb from '~icons/lucide/bomb';
	import IconCrosshair from '~icons/lucide/crosshair';
	import IconFuel from '~icons/lucide/fuel';
	import IconGem from '~icons/lucide/gem';
	import IconShield from '~icons/lucide/shield';
	import IconTruck from '~icons/lucide/truck';
	import IconWheat from '~icons/lucide/wheat';

	let { game }: { game: WarRoomGame } = $props();

	const resourceIcons = {
		steel: IconAnvil,
		oil: IconFuel,
		rare: IconGem,
		grain: IconWheat
	} as const;
	const equipmentIcons = {
		rifles: IconCrosshair,
		armour: IconShield,
		guns: IconBomb,
		trucks: IconTruck
	} as const;

	const day = $derived(Math.min(game.day, MAX_DAYS));
	const divisions = $derived(
		REGION_IDS.reduce((sum, id) => sum + (game.divisions[id]?.length ?? 0), 0)
	);
</script>

<section
	class="flex flex-col gap-1.5 rounded-[12px_6px_14px_8px] border-3 border-ink bg-paper px-2 py-1.5 shadow-[3px_3px_0_var(--color-ink)]"
>
	<div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
		<p dir="auto" class="font-display text-sm font-bold tabular-nums sm:text-base">
			{m.warroom_hud_day({ day, total: MAX_DAYS })}
		</p>
		<p dir="auto" class="text-xs font-semibold tabular-nums">
			{game.armistice === 1
				? m.warroom_hud_armistice_one()
				: m.warroom_hud_armistice({ days: game.armistice })}
		</p>
		<p dir="auto" class="text-xs font-semibold tabular-nums">
			{m.warroom_hud_regions({
				count: REGION_IDS.filter((id) => game.owner[id] === 'player').length
			})}
			· {m.warroom_hud_divisions({ count: divisions })}
		</p>
	</div>
	<p dir="auto" class="text-[0.65rem] leading-snug font-semibold opacity-80 sm:text-xs">
		{m.warroom_hud_goal({ region: regionName('redcapital') })}
	</p>

	<div class="grid grid-cols-1 gap-1 sm:grid-cols-2">
		<div>
			<p class="text-[0.55rem] font-bold tracking-wide uppercase opacity-70">
				{m.warroom_resource_title()}
			</p>
			<ul class="grid grid-cols-4 gap-1">
				{#each RESOURCE_IDS as id (id)}
					{@const Icon = resourceIcons[id]}
					<li
						class="flex items-center gap-1 rounded border-2 border-ink bg-sand px-1 py-0.5"
						title={resourceName(id)}
					>
						<Icon class="size-3 shrink-0" aria-hidden="true" />
						<span class="min-w-0 truncate text-[0.6rem] font-semibold">{resourceName(id)}</span>
						<span class="ms-auto shrink-0 font-display text-xs font-bold tabular-nums" dir="ltr">
							{game.resources[id]}
						</span>
					</li>
				{/each}
			</ul>
		</div>
		<div>
			<p class="text-[0.55rem] font-bold tracking-wide uppercase opacity-70">
				{m.warroom_equipment_title()}
			</p>
			<ul class="grid grid-cols-4 gap-1">
				{#each EQUIPMENT_IDS as id (id)}
					{@const Icon = equipmentIcons[id]}
					<li
						class="flex items-center gap-1 rounded border-2 border-ink bg-sand px-1 py-0.5"
						title={equipmentName(id)}
					>
						<Icon class="size-3 shrink-0" aria-hidden="true" />
						<span class="min-w-0 truncate text-[0.6rem] font-semibold">{equipmentName(id)}</span>
						<span class="ms-auto shrink-0 font-display text-xs font-bold tabular-nums" dir="ltr">
							{game.equipment[id]}
						</span>
					</li>
				{/each}
			</ul>
		</div>
	</div>
</section>
