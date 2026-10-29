<!--
	The industry tab: what each factory turns into equipment, and where to build the next one.
	Every owned region has a fixed number of slots, so the map decides how much industry fits.
-->
<script lang="ts">
	import {
		FACTORY_IDS,
		REGION_IDS,
		factoryDef,
		regionDef,
		type FactoryId,
		type RegionId
	} from '#lib/game/warroom/config.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { WarRoomGame } from '#lib/stores/warroomGame.svelte.js';
	import { equipmentName, factoryName, regionName, resourceCost } from './warroomText.js';
	import IconFactory from '~icons/lucide/factory';

	let { game }: { game: WarRoomGame } = $props();

	const regions = $derived(REGION_IDS.filter((id) => game.owner[id] === 'player'));
	const buildable = $derived(regions.filter((id) => regionDef(id).slots > 0));
	const hasFreeSlot = $derived(buildable.some((id) => game.slotsUsed(id) < regionDef(id).slots));

	function factoriesIn(region: RegionId): FactoryId[] {
		return game.buildings
			.filter((building) => building.region === region)
			.map((building) => building.factory);
	}

	function build(region: RegionId, factory: FactoryId) {
		game.build(region, factory);
	}
</script>

<section
	class="flex flex-col gap-2 rounded-2xl border-3 border-ink bg-paper p-2 shadow-[3px_3px_0_var(--color-ink)]"
>
	<div class="flex flex-col gap-0.5">
		<h2 dir="auto" class="font-display text-lg leading-tight font-bold">
			{m.warroom_industry_title()}
		</h2>
		<p dir="auto" class="text-xs leading-snug font-semibold opacity-80">
			{m.warroom_industry_hint()}
		</p>
	</div>

	<ul class="grid grid-cols-1 gap-1 sm:grid-cols-2">
		{#each FACTORY_IDS as id (id)}
			{@const def = factoryDef(id)}
			<li class="rounded-xl border-2 border-ink bg-sand px-2 py-1">
				<p dir="auto" class="font-display text-sm leading-tight font-bold">{factoryName(id)}</p>
				<p dir="auto" class="text-[0.75rem] font-semibold tabular-nums">
					{m.warroom_industry_output({
						amount: def.output.amount,
						equipment: equipmentName(def.output.equipment)
					})}
				</p>
				<p dir="auto" class="text-[0.7rem] leading-tight opacity-80">
					{m.warroom_industry_input({ input: resourceCost(def.input) })}
				</p>
			</li>
		{/each}
	</ul>

	{#if !hasFreeSlot}
		<p
			dir="auto"
			class="rounded-xl border-2 border-dashed border-ink/40 px-2 py-2 text-sm font-semibold"
		>
			{m.warroom_industry_none()}
		</p>
	{/if}

	<div class="flex flex-col gap-2">
		{#each buildable as region (region)}
			{@const used = game.slotsUsed(region)}
			{@const total = regionDef(region).slots}
			{@const built = factoriesIn(region)}
			<div class="flex flex-col gap-1 rounded-xl border-2 border-ink bg-sand px-2 py-1.5">
				<div class="flex items-baseline justify-between gap-2">
					<h3 dir="auto" class="font-display text-sm font-bold">{regionName(region)}</h3>
					<span class="text-[0.75rem] font-bold tabular-nums" dir="ltr">
						{m.warroom_industry_slots({ used, total })}
					</span>
				</div>
				{#if built.length > 0}
					<ul class="flex flex-wrap gap-1">
						{#each built as factory, index (factory + index)}
							<li
								dir="auto"
								class="inline-flex items-center gap-1 rounded-full border-2 border-ink bg-paper px-1.5 text-[0.7rem] font-bold"
							>
								<IconFactory class="size-3" aria-hidden="true" />
								{factoryName(factory)}
							</li>
						{/each}
					</ul>
				{/if}
				{#if used >= total}
					<p dir="auto" class="text-[0.75rem] font-semibold opacity-70">
						{m.warroom_industry_full()}
					</p>
				{:else}
					<div class="grid grid-cols-1 gap-1 sm:grid-cols-2">
						{#each FACTORY_IDS as id (id)}
							{@const def = factoryDef(id)}
							{@const affordable = game.canBuild(region, id)}
							<button
								type="button"
								class="btn-chunky flex-col items-start gap-0.5 px-2 py-1 text-start text-xs disabled:opacity-50"
								disabled={!affordable}
								onclick={() => build(region, id)}
							>
								<span class="inline-flex items-center gap-1 font-bold">
									<IconFactory class="size-3.5" aria-hidden="true" />
									<span dir="auto">{m.warroom_industry_build()} {factoryName(id)}</span>
								</span>
								<span dir="auto" class="text-[0.7rem] font-semibold tabular-nums">
									{m.warroom_build_cost({ cost: resourceCost(def.cost) })}
								</span>
							</button>
						{/each}
					</div>
				{/if}
			</div>
		{/each}
	</div>
</section>
