<!--
	The army tab: every region that holds a stack, with its symbol line, morale state and supply.
	Tap a row to take command of the stack; a stack that already moved today only opens its details.
-->
<script lang="ts">
	import { REGION_IDS, regionDef, type RegionId } from '#lib/game/warroom/config.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { WarRoomGame } from '#lib/stores/warroomGame.svelte.js';
	import NatoSymbol from './NatoSymbol.svelte';
	import { regionName, terrainName } from './warroomText.js';
	import IconCheck from '~icons/lucide/check';
	import IconFootprints from '~icons/lucide/footprints';

	let { game }: { game: WarRoomGame } = $props();

	const rows = $derived(
		REGION_IDS.filter((id) => game.owner[id] === 'player' && (game.divisions[id]?.length ?? 0) > 0)
	);

	function moraleOf(id: RegionId): number {
		const stack = game.divisions[id] ?? [];
		if (stack.length === 0) return 0;
		return Math.round(stack.reduce((sum, division) => sum + division.morale, 0) / stack.length);
	}

	function supplyTone(value: number): string {
		return value >= 70 ? 'bg-[#8fd19e]' : value >= 45 ? 'bg-[#e8c46a]' : 'bg-tie-red';
	}

	function open(id: RegionId) {
		if (game.moved.includes(id)) game.focusRegion(id);
		else game.selectRegion(id);
	}
</script>

<section
	class="flex flex-col gap-2 rounded-[12px_6px_14px_8px] border-3 border-ink bg-paper p-2 shadow-[3px_3px_0_var(--color-ink)]"
>
	<div class="flex flex-col gap-0.5">
		<h2 dir="auto" class="font-display text-lg leading-tight font-bold">
			{m.warroom_army_title()}
		</h2>
		<p dir="auto" class="text-xs leading-snug font-semibold opacity-80">{m.warroom_army_hint()}</p>
	</div>

	{#if rows.length === 0}
		<p
			dir="auto"
			class="rounded-md border-2 border-dashed border-ink/40 px-2 py-2 text-sm font-semibold"
		>
			{m.warroom_army_empty()}
		</p>
	{:else}
		<ul class="flex flex-col gap-1.5">
			{#each rows as id (id)}
				{@const stack = game.divisions[id] ?? []}
				{@const moved = game.moved.includes(id)}
				{@const selected = game.selected === id}
				{@const supply = game.supplyAt(id)}
				<li>
					<button
						type="button"
						class="flex w-full items-center gap-2 rounded-[9px_5px_11px_6px] border-2 border-ink px-2 py-1.5 text-start {selected
							? 'bg-explosion-yellow'
							: 'bg-sand'}"
						aria-pressed={selected}
						onclick={() => open(id)}
					>
						<span class="flex min-w-0 flex-1 flex-col">
							<span class="flex items-baseline justify-between gap-2">
								<span dir="auto" class="truncate font-display text-sm leading-tight font-bold">
									{regionName(id)}
								</span>
								<span dir="auto" class="shrink-0 text-[0.6rem] font-semibold">
									{terrainName(regionDef(id).terrain)}
								</span>
							</span>
							<span class="flex items-center gap-1">
								{#each stack.slice(0, 4) as division (division.id)}
									<NatoSymbol kind={division.template} side="player" class="h-3 w-4 shrink-0" />
								{/each}
								{#if stack.length > 4}
									<span class="text-[0.6rem] font-bold">+{stack.length - 4}</span>
								{/if}
								<span class="text-[0.6rem] font-bold tabular-nums">
									{stack.length === 1
										? m.warroom_division_count_one()
										: m.warroom_division_count({ count: stack.length })}
								</span>
							</span>
							<span class="flex items-center gap-1">
								<span
									class="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full border border-ink bg-paper"
								>
									<span class="block h-full {supplyTone(supply)}" style:width="{supply}%"></span>
								</span>
								<span class="shrink-0 text-[0.6rem] font-semibold tabular-nums" dir="ltr">
									{m.warroom_army_supply({ supply })}
								</span>
								<span class="shrink-0 text-[0.6rem] font-semibold tabular-nums" dir="ltr">
									{m.warroom_army_morale({ morale: moraleOf(id) })}
								</span>
							</span>
						</span>
						<span class="flex shrink-0 flex-col items-center gap-0.5 text-[0.6rem] font-bold">
							{#if selected}
								<IconCheck class="size-4" aria-hidden="true" />
								<span dir="auto">{m.warroom_army_selected()}</span>
							{:else if moved}
								<span dir="auto" class="text-xs">—</span>
								<span dir="auto">{m.warroom_army_moved()}</span>
							{:else}
								<IconFootprints class="size-4" aria-hidden="true" />
								<span dir="auto">{m.warroom_army_select()}</span>
							{/if}
						</span>
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</section>
