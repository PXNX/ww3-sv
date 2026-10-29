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
	class="flex flex-col gap-2 rounded-2xl border-3 border-ink bg-paper px-3 py-2 shadow-[3px_3px_0_var(--color-ink)]"
>
	<div class="flex items-center justify-between gap-3">
		<p
			dir="auto"
			class="rounded-xl border-3 border-ink bg-explosion-yellow px-2.5 py-1 font-display text-base leading-tight font-bold tabular-nums"
		>
			{m.warroom_hud_day({ day, total: MAX_DAYS })}
		</p>
		<div class="flex flex-wrap justify-end gap-1.5 font-display text-xs font-bold tabular-nums">
			<span class="rounded-full border-2 border-ink bg-sand px-2 py-0.5" dir="auto">
				{game.armistice === 1
					? m.warroom_hud_armistice_one()
					: m.warroom_hud_armistice({ days: game.armistice })}
			</span>
			<span class="rounded-full border-2 border-ink bg-sand px-2 py-0.5" dir="auto">
				{m.warroom_hud_regions({
					count: REGION_IDS.filter((id) => game.owner[id] === 'player').length
				})}
			</span>
			<span class="rounded-full border-2 border-ink bg-sand px-2 py-0.5" dir="auto">
				{m.warroom_hud_divisions({ count: divisions })}
			</span>
		</div>
	</div>
	<p dir="auto" class="text-xs leading-snug font-semibold opacity-80">
		{m.warroom_hud_goal({ region: regionName('redcapital') })}
	</p>

	<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
		<div class="flex flex-col gap-1">
			<p class="text-[0.7rem] font-bold tracking-wide uppercase opacity-70">
				{m.warroom_resource_title()}
			</p>
			<ul class="grid grid-cols-4 gap-1.5">
				{#each RESOURCE_IDS as id (id)}
					{@const Icon = resourceIcons[id]}
					<li
						class="flex flex-col items-center rounded-xl border-2 border-ink bg-sand px-1 py-1"
						title={resourceName(id)}
					>
						<Icon class="size-4 shrink-0" aria-hidden="true" />
						<span class="font-display text-sm leading-tight font-bold tabular-nums" dir="ltr">
							{game.resources[id]}
						</span>
						<span class="max-w-full truncate text-[0.7rem] leading-tight font-semibold opacity-70">
							{resourceName(id)}
						</span>
					</li>
				{/each}
			</ul>
		</div>
		<div class="flex flex-col gap-1">
			<p class="text-[0.7rem] font-bold tracking-wide uppercase opacity-70">
				{m.warroom_equipment_title()}
			</p>
			<ul class="grid grid-cols-4 gap-1.5">
				{#each EQUIPMENT_IDS as id (id)}
					{@const Icon = equipmentIcons[id]}
					<li
						class="flex flex-col items-center rounded-xl border-2 border-ink bg-sand px-1 py-1"
						title={equipmentName(id)}
					>
						<Icon class="size-4 shrink-0" aria-hidden="true" />
						<span class="font-display text-sm leading-tight font-bold tabular-nums" dir="ltr">
							{game.equipment[id]}
						</span>
						<span class="max-w-full truncate text-[0.7rem] leading-tight font-semibold opacity-70">
							{equipmentName(id)}
						</span>
					</li>
				{/each}
			</ul>
		</div>
	</div>
</section>
