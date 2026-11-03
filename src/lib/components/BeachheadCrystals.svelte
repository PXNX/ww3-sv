<!--
	The crystal sheet. At the top the base crystals, in the base's own slots; below them the
	overcharge slots, one row per building that can carry a crystal; at the bottom every crystal type
	with its level, how many loose ones are waiting and the button that merges n² of them into the next
	level. Tapping a slot cycles through the crystals that fit it, and an empty one at the end.
-->
<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import type { BuildingKind } from '#lib/game/beachhead/config.js';
	import {
		BASE_CRYSTALS,
		CRYSTAL_COLORS,
		CRYSTAL_TYPES,
		OVERCHARGE_CRYSTALS,
		type BaseCrystal,
		type OverchargeCrystal
	} from '#lib/game/beachhead/crystals.js';
	import { buildingName, crystalHint, crystalName } from '#lib/components/beachheadText.js';
	import CrystalIcon from '#lib/components/CrystalIcon.svelte';
	import type { BeachheadGame } from '#lib/stores/beachheadGame.svelte.js';
	import IconMerge from '~icons/lucide/merge';

	let { game }: { game: BeachheadGame } = $props();

	const crystals = $derived(game.crystals);
	const baseSlots = $derived(
		Array.from({ length: game.baseSlotsTotal }, (_, index) => crystals.base[index] ?? null)
	);

	/** Buildings with a slot: the main buildings, and every mine or gun on the island */
	const targets = $derived([
		...(['hq', 'bunker', 'training', 'dojo', 'radar'] as const).map((key) => ({
			id: key as string,
			name: key === 'hq' ? m.beachhead_upgrade_hq() : describe(key)
		})),
		...game.layout.mines.map((defense) => ({
			id: `defense:${defense.id}`,
			name: buildingName(defense.kind as BuildingKind)
		}))
	]);

	function describe(key: string): string {
		if (key === 'bunker') return m.beachhead_building_bunker();
		if (key === 'training') return m.beachhead_building_training();
		if (key === 'dojo') return m.beachhead_building_dojo();
		return m.beachhead_building_radar();
	}

	function cycleBase(index: number) {
		const used = new Set(baseSlots.filter((entry, slot) => entry && slot !== index));
		const choices: (BaseCrystal | null)[] = [
			...BASE_CRYSTALS.filter((type) => !used.has(type)),
			null
		];
		const at = choices.indexOf(baseSlots[index]);
		game.setBaseCrystal(index, choices[(at + 1) % choices.length]);
	}

	function cycleOvercharge(target: string) {
		const current = crystals.slots[target] ?? null;
		const choices: (OverchargeCrystal | null)[] = [...OVERCHARGE_CRYSTALS, null];
		const at = choices.indexOf(current);
		game.setOvercharge(target, choices[(at + 1) % choices.length]);
	}
</script>

<h4 class="text-sm font-bold">{m.beachhead_crystals_base()}</h4>
<ul class="flex flex-wrap gap-2">
	{#each baseSlots as type, index (index)}
		<li>
			<button
				type="button"
				class="slot flex size-14 items-center justify-center rounded-full border-3 border-ink bg-paper shadow-[2px_2px_0_var(--color-ink)]"
				style:background={type
					? `color-mix(in srgb, ${CRYSTAL_COLORS[type]} 30%, white)`
					: undefined}
				title={type
					? `${crystalName(type)} — ${crystalHint(type)}`
					: m.beachhead_crystals_empty_slot()}
				aria-label={type ? crystalName(type) : m.beachhead_crystals_empty_slot()}
				onclick={() => cycleBase(index)}
			>
				{#if type}
					<CrystalIcon {type} class="size-9" />
					<span
						class="absolute -right-1 -bottom-1 rounded-full border-2 border-ink bg-paper px-1 font-display text-xs font-bold tabular-nums"
					>
						{game.crystalLevel(type)}
					</span>
				{/if}
			</button>
		</li>
	{/each}
</ul>

<h4 class="flex items-center gap-2 text-sm font-bold">
	{m.beachhead_crystals_overcharge()}
	<span class="rounded-full border-2 border-ink bg-paper px-2 font-display text-xs tabular-nums">
		{game.overchargeSlotsUsed}/{game.overchargeSlotsTotal}
	</span>
</h4>
<ul class="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
	{#each targets as target (target.id)}
		{@const type = crystals.slots[target.id] ?? null}
		<li
			class="flex items-center justify-between gap-2 rounded-[12px] border-2 border-ink bg-sand px-2 py-1"
		>
			<span class="truncate text-xs font-bold">{target.name}</span>
			<button
				type="button"
				class="slot relative flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-paper"
				style:background={type
					? `color-mix(in srgb, ${CRYSTAL_COLORS[type]} 30%, white)`
					: undefined}
				title={type
					? `${crystalName(type)} — ${crystalHint(type)}`
					: m.beachhead_crystals_empty_slot()}
				aria-label={type ? crystalName(type) : m.beachhead_crystals_empty_slot()}
				disabled={!type && game.overchargeSlotsUsed >= game.overchargeSlotsTotal}
				onclick={() => cycleOvercharge(target.id)}
			>
				{#if type}
					<CrystalIcon {type} class="size-7" />
				{/if}
			</button>
		</li>
	{/each}
</ul>

<ul class="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
	{#each CRYSTAL_TYPES as type (type)}
		{@const cost = game.crystalMergeCost(type)}
		<li
			class="flex flex-col items-center gap-1 rounded-[14px] border-2 border-ink bg-sand p-2"
			title={crystalHint(type)}
		>
			<CrystalIcon {type} class="size-10" />
			<p class="text-center text-xs leading-tight font-bold">{crystalName(type)}</p>
			<p class="font-display text-xs font-bold tabular-nums">
				{game.crystalLevel(type)}
				<span class="opacity-70">· {game.crystalStock(type)}{cost ? `/${cost}` : ''}</span>
			</p>
			<button
				type="button"
				class="btn-chunky flex size-8 items-center justify-center rounded-full p-0"
				aria-label={m.beachhead_crystals_merge()}
				title={m.beachhead_crystals_merge()}
				disabled={!game.canMergeCrystal(type)}
				onclick={() => game.mergeCrystal(type)}
			>
				<IconMerge class="size-4" aria-hidden="true" />
			</button>
		</li>
	{/each}
</ul>

<style>
	.slot {
		position: relative;
	}
</style>
