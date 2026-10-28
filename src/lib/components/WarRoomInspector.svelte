<!--
	The inspector for one region: who holds it, what it pays, how well supplied it is, and the
	stack that sits there. When the selected stack sits in this region it also lists the orders
	for every neighbouring region, with the attack odds before the dice are rolled.
-->
<script lang="ts">
	import { regionDef, type RegionId } from '#lib/game/warroom/config.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { WarRoomGame } from '#lib/stores/warroomGame.svelte.js';
	import WarRoomDivisionRow from './WarRoomDivisionRow.svelte';
	import { oddsLabel, regionName, resourceName, terrainBonus, terrainName } from './warroomText.js';
	import IconCrosshair from '~icons/lucide/crosshair';
	import IconFlag from '~icons/lucide/flag-triangle-right';
	import IconFootprints from '~icons/lucide/footprints';
	import IconX from '~icons/lucide/x';

	let { game }: { game: WarRoomGame } = $props();

	const def = $derived(regionDef(game.focused));
	const ours = $derived(game.owner[game.focused] === 'player');
	const stack = $derived(game.divisions[game.focused] ?? []);
	const supply = $derived(game.supplyAt(game.focused));
	const moved = $derived(game.moved.includes(game.focused));
	const selected = $derived(game.selected === game.focused);
	const playing = $derived(game.status === 'playing');
	const canTakeCommand = $derived(ours && stack.length > 0 && !moved && playing);
	const orders = $derived(
		def.neighbors.map((neighbor) => ({
			id: neighbor,
			ours: game.owner[neighbor] === 'player',
			preview: selected ? game.preview(game.focused, neighbor) : null
		}))
	);

	function takeCommand() {
		game.selectRegion(game.focused);
	}

	function order(to: RegionId) {
		game.orderSelected(to);
	}
</script>

<section
	class="flex flex-col gap-2 rounded-[12px_6px_14px_8px] border-3 border-ink bg-paper p-2 shadow-[3px_3px_0_var(--color-ink)]"
>
	<header class="flex items-start justify-between gap-2">
		<div class="flex min-w-0 flex-col">
			<p class="text-[0.6rem] font-bold tracking-wide uppercase opacity-70">
				{m.warroom_inspector_title()}
			</p>
			<h2 dir="auto" class="truncate font-display text-xl leading-tight font-bold">
				{regionName(game.focused)}
			</h2>
			<p
				dir="auto"
				class="inline-flex w-fit items-center gap-1 rounded-full border-2 border-ink px-2 text-[0.65rem] font-bold {ours
					? 'bg-[#cfe9f7]'
					: 'bg-[#f7cfd1]'}"
			>
				{#if ours}
					<IconFlag class="size-3" aria-hidden="true" />
					{m.warroom_side_player()}
				{:else}
					<IconCrosshair class="size-3" aria-hidden="true" />
					{m.warroom_side_enemy()}
				{/if}
			</p>
		</div>
		{#if selected}
			<button
				type="button"
				class="btn-chunky shrink-0 px-2 py-1 text-xs"
				aria-label={m.warroom_action_clear()}
				onclick={() => game.clearSelection()}
			>
				<IconX class="size-3.5" aria-hidden="true" />
				<span class="hidden sm:inline">{m.warroom_action_clear()}</span>
			</button>
		{/if}
	</header>

	<dl class="grid grid-cols-2 gap-1 text-xs">
		<div class="rounded-md border-2 border-ink bg-sand px-2 py-1">
			<dt class="text-[0.6rem] font-bold uppercase opacity-70">{m.warroom_stat_terrain()}</dt>
			<dd dir="auto" class="font-display leading-tight font-bold">
				{terrainName(def.terrain)}
			</dd>
			{#if terrainBonus(def.terrain) > 0}
				<dd class="text-[0.6rem] font-semibold tabular-nums">
					{m.warroom_terrain_bonus({ percent: terrainBonus(def.terrain) })}
				</dd>
			{/if}
		</div>
		<div class="rounded-md border-2 border-ink bg-sand px-2 py-1">
			<dt class="text-[0.6rem] font-bold uppercase opacity-70">{m.warroom_stat_supply()}</dt>
			<dd class="font-display leading-tight font-bold tabular-nums" dir="ltr">{supply}%</dd>
			<dd class="h-1.5 overflow-hidden rounded-full border border-ink bg-paper">
				<span
					class="block h-full {supply >= 70
						? 'bg-[#8fd19e]'
						: supply >= 45
							? 'bg-[#e8c46a]'
							: 'bg-tie-red'}"
					style:width="{supply}%"
				></span>
			</dd>
		</div>
		<div class="rounded-md border-2 border-ink bg-sand px-2 py-1">
			<dt class="text-[0.6rem] font-bold uppercase opacity-70">{m.warroom_stat_income()}</dt>
			<dd dir="auto" class="font-display leading-tight font-bold">
				{m.warroom_income_value({
					amount: def.income.amount,
					resource: resourceName(def.income.resource)
				})}
			</dd>
		</div>
		<div class="rounded-md border-2 border-ink bg-sand px-2 py-1">
			<dt class="text-[0.6rem] font-bold uppercase opacity-70">{m.warroom_stat_slots()}</dt>
			<dd class="font-display leading-tight font-bold tabular-nums" dir="ltr">
				{m.warroom_slots_value({
					used: game.slotsUsed(game.focused),
					total: game.slotsTotal(game.focused)
				})}
			</dd>
		</div>
	</dl>

	<div class="flex flex-col gap-1">
		<div class="flex items-baseline justify-between gap-2">
			<h3 dir="auto" class="font-display text-sm font-bold">{m.warroom_stat_divisions()}</h3>
			{#if stack.length > 0}
				<span class="text-[0.65rem] font-bold tabular-nums">
					{stack.length === 1
						? m.warroom_division_count_one()
						: m.warroom_division_count({ count: stack.length })}
				</span>
			{/if}
		</div>
		{#if stack.length === 0}
			<p
				dir="auto"
				class="rounded-md border-2 border-dashed border-ink/40 px-2 py-1 text-xs font-semibold"
			>
				{m.warroom_region_empty()}
			</p>
		{:else}
			<ul class="flex flex-col gap-1">
				{#each stack as division (division.id)}
					<WarRoomDivisionRow {division} side={ours ? 'player' : 'enemy'} />
				{/each}
			</ul>
		{/if}
	</div>

	{#if !ours}
		<p dir="auto" class="text-xs leading-snug font-semibold">
			{m.warroom_region_enemy_hint()}
		</p>
	{/if}

	{#if ours && stack.length > 0 && !selected}
		{#if moved}
			<p dir="auto" class="rounded-md border-2 border-ink bg-sand px-2 py-1 text-xs font-semibold">
				{m.warroom_region_moved()}
			</p>
		{:else}
			<button
				type="button"
				class="btn-chunky justify-center bg-explosion-yellow text-sm"
				disabled={!canTakeCommand}
				onclick={takeCommand}
			>
				<IconFootprints class="size-4" aria-hidden="true" />
				{m.warroom_action_select()}
			</button>
		{/if}
	{/if}

	{#if selected && stack.length > 0}
		<div class="flex flex-col gap-1">
			<h3 dir="auto" class="font-display text-sm font-bold">{m.warroom_orders_title()}</h3>
			{#if orders.length === 0}
				<p dir="auto" class="text-xs font-semibold">{m.warroom_orders_none()}</p>
			{:else}
				<div class="grid grid-cols-1 gap-1">
					{#each orders as entry (entry.id)}
						<button
							type="button"
							class="btn-chunky justify-between gap-2 px-2 py-1.5 text-xs {entry.ours
								? 'bg-khaki'
								: 'bg-tie-red text-paper'}"
							disabled={!playing}
							onclick={() => order(entry.id)}
						>
							<span class="inline-flex min-w-0 items-center gap-1">
								{#if entry.ours}
									<IconFootprints class="size-3.5 shrink-0" aria-hidden="true" />
								{:else}
									<IconCrosshair class="size-3.5 shrink-0" aria-hidden="true" />
								{/if}
								<span dir="auto" class="truncate font-bold">
									{entry.ours
										? m.warroom_order_move({ region: regionName(entry.id) })
										: m.warroom_order_attack({ region: regionName(entry.id) })}
								</span>
							</span>
							{#if entry.preview}
								<span class="shrink-0 text-[0.6rem] font-semibold tabular-nums" dir="ltr">
									{oddsLabel(entry.preview.attack, entry.preview.defence)}
								</span>
							{/if}
						</button>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</section>
