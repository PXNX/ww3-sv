<!--
	The build panel under the playfield: with an empty slot selected it offers the four defenses,
	with a built one selected it shows what it is and offers upgrade and sell. Everything costs
	helmets (the only currency). A button that is too expensive stays tappable so the helmet
	counter can shake, and says so to screen readers through aria-disabled.
-->
<script lang="ts">
	import {
		DEFENSE_KINDS,
		MAX_LEVEL,
		buildCost,
		sellValue,
		upgradeCost,
		type DefenseKind
	} from '#lib/game/dronewall/config.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { DroneWallGame } from '#lib/stores/dronewallGame.svelte.js';
	import DroneWallDefense from './DroneWallDefense.svelte';
	import IconArrowUp from '~icons/lucide/arrow-big-up';
	import IconCoins from '~icons/lucide/hand-coins';

	let { game }: { game: DroneWallGame } = $props();

	const NAMES: Record<DefenseKind, () => string> = {
		squad: m.dronewall_squad_name,
		mortar: m.dronewall_mortar_name,
		nest: m.dronewall_nest_name,
		trench: m.dronewall_trench_name
	};
	const ROLES: Record<DefenseKind, () => string> = {
		squad: m.dronewall_squad_role,
		mortar: m.dronewall_mortar_role,
		nest: m.dronewall_nest_role,
		trench: m.dronewall_trench_role
	};

	const defense = $derived.by(() => {
		void game.revision;
		const slot = game.selectedSlot;
		const built = slot === null ? null : game.state.defenses[slot];
		return built ? { kind: built.kind, level: built.level } : null;
	});
	const next = $derived(defense ? upgradeCost(defense.kind, defense.level) : null);
	const afford = (cost: number) => game.helmets >= cost;
</script>

<div
	class="flex min-h-[5.5rem] w-full flex-col justify-center rounded-[12px_6px_14px_8px] border-3 border-ink bg-paper px-2 py-1.5 shadow-[3px_3px_0_var(--color-ink)]"
	aria-live="polite"
>
	{#if game.selectedSlot === null}
		<p dir="auto" class="px-1 text-center text-sm leading-snug font-semibold">
			{m.dronewall_panel_hint()}
		</p>
	{:else if defense === null}
		<ul class="grid grid-cols-4 gap-1.5">
			{#each DEFENSE_KINDS as kind (kind)}
				{@const cost = buildCost(kind)}
				<li class="contents">
					<button
						type="button"
						class="btn-chunky flex-col gap-0 px-1 py-1 text-xs leading-tight {afford(cost)
							? 'bg-paper'
							: 'bg-sand opacity-70'}"
						aria-disabled={!afford(cost)}
						onclick={() => game.build(kind)}
					>
						<DroneWallDefense {kind} class="size-8" />
						<span class="text-center">{NAMES[kind]()}</span>
						<span class="flex items-center gap-0.5 text-sm" aria-label={m.dronewall_cost({ cost })}>
							<DroneWallDefense kind="helmet" class="size-4" />
							{cost}
						</span>
					</button>
				</li>
			{/each}
		</ul>
	{:else}
		<div class="flex items-center gap-2">
			<DroneWallDefense kind={defense.kind} class="size-11 shrink-0" />
			<div class="min-w-0 flex-1 leading-tight">
				<p class="font-display text-base font-bold">{NAMES[defense.kind]()}</p>
				<p dir="auto" class="text-xs">{ROLES[defense.kind]()}</p>
				<p class="text-xs font-bold">
					{defense.level >= MAX_LEVEL
						? m.dronewall_level_max({ level: defense.level })
						: m.dronewall_level({ level: defense.level })}
				</p>
			</div>
			<div class="flex shrink-0 flex-col gap-1">
				{#if next !== null}
					<button
						type="button"
						class="btn-chunky px-2 py-0.5 text-sm {afford(next)
							? 'bg-explosion-yellow'
							: 'bg-sand opacity-70'}"
						aria-disabled={!afford(next)}
						onclick={() => game.upgrade()}
					>
						<IconArrowUp class="size-4" aria-hidden="true" />
						{m.dronewall_upgrade()}
						<span class="flex items-center gap-0.5" aria-label={m.dronewall_cost({ cost: next })}>
							<DroneWallDefense kind="helmet" class="size-4" />
							{next}
						</span>
					</button>
				{/if}
				<button type="button" class="btn-chunky px-2 py-0.5 text-sm" onclick={() => game.sell()}>
					<IconCoins class="size-4" aria-hidden="true" />
					{m.dronewall_sell()}
					<span class="flex items-center gap-0.5">
						<DroneWallDefense kind="helmet" class="size-4" />
						+{sellValue(defense.kind, defense.level)}
					</span>
				</button>
			</div>
		</div>
	{/if}
</div>
