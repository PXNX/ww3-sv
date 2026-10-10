<!--
	The build panel, shown over the playfield while a spot is selected: an empty spot offers the
	twelve defenses, a built one shows what it is and offers upgrade and sell. Past level 3 the upgrades are elite promotions, which look and read differently. Everything costs
	helmets (the only currency). A button that is too expensive stays tappable so the helmet
	counter can shake, and says so to screen readers through aria-disabled. Selling asks once more
	(the same two-tap confirmation as restarting in Chess and Merge), since the defense is gone for good.
-->
<script lang="ts">
	import {
		DEFENSE_KINDS,
		MAX_LEVEL,
		NORMAL_LEVELS,
		buildCost,
		eliteTier,
		sellValue,
		upgradeCost
	} from '#lib/game/dronewall/config.js';
	import { onDestroy } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import type { DroneWallGame } from '#lib/stores/dronewallGame.svelte.js';
	import DroneWallDefense from './DroneWallDefense.svelte';
	import { DEFENSE_NAMES as NAMES, DEFENSE_ROLES as ROLES } from './droneWallText.js';
	import IconArrowUp from '~icons/lucide/arrow-big-up';
	import IconStar from '~icons/lucide/star';
	import IconCoins from '~icons/lucide/hand-coins';

	let { game }: { game: DroneWallGame } = $props();

	const defense = $derived.by(() => {
		void game.revision;
		const slot = game.selectedSlot;
		const built = slot === null ? null : game.state.defenses[slot];
		return built ? { kind: built.kind, level: built.level } : null;
	});
	const next = $derived(defense ? upgradeCost(defense.kind, defense.level) : null);
	const elite = $derived(defense ? eliteTier(defense.level) : 0);
	/** The next upgrade is the first or a further elite promotion */
	const promoting = $derived(defense !== null && defense.level >= NORMAL_LEVELS);
	const afford = (cost: number) => game.helmets >= cost;

	const CONFIRM_MS = 3000;
	let confirmingSell = $state(false);
	let confirmTimer: ReturnType<typeof setTimeout> | undefined;
	onDestroy(() => clearTimeout(confirmTimer));

	// Picking another spot, or upgrading, drops a pending sale
	$effect(() => {
		void game.selectedSlot;
		void game.revision;
		clearTimeout(confirmTimer);
		confirmingSell = false;
	});

	function sell() {
		clearTimeout(confirmTimer);
		if (confirmingSell) {
			confirmingSell = false;
			game.sell();
			return;
		}
		confirmingSell = true;
		confirmTimer = setTimeout(() => (confirmingSell = false), CONFIRM_MS);
	}
</script>

<div
	class="flex w-full flex-col justify-center rounded-[12px_6px_14px_8px] border-3 border-ink bg-paper px-2 py-1.5 shadow-[3px_3px_0_var(--color-ink)]"
	aria-live="polite"
>
	{#if defense === null}
		<ul class="grid grid-cols-4 gap-1.5">
			{#each DEFENSE_KINDS as kind (kind)}
				{@const cost = buildCost(kind)}
				<li class="contents">
					<button
						type="button"
						class="btn-chunky h-full flex-col gap-0 px-0.5 py-1 text-[0.7rem] leading-tight sm:text-xs {afford(
							cost
						)
							? 'bg-paper'
							: 'bg-sand opacity-70'}"
						aria-disabled={!afford(cost)}
						onclick={() => game.build(kind)}
					>
						<DroneWallDefense {kind} class="size-7 sm:size-8" />
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
			<DroneWallDefense kind={defense.kind} {elite} class="size-11 shrink-0" />
			<div class="min-w-0 flex-1 leading-tight">
				<p class="font-display text-base font-bold">{NAMES[defense.kind]()}</p>
				<p dir="auto" class="text-xs">{ROLES[defense.kind]()}</p>
				<p class="flex items-center gap-1 text-xs font-bold {elite > 0 ? 'text-tie-red' : ''}">
					{#if elite > 0}
						{#each Array.from({ length: elite }, (_, i) => i) as star (star)}
							<IconStar class="size-3.5 fill-explosion-yellow" aria-hidden="true" />
						{/each}
						{defense.level >= MAX_LEVEL
							? m.dronewall_level_elite_max({ rank: elite })
							: m.dronewall_level_elite({ rank: elite })}
					{:else}
						{m.dronewall_level({ level: defense.level })}
					{/if}
				</p>
			</div>
			<div class="flex shrink-0 flex-col gap-1">
				{#if next !== null}
					<button
						type="button"
						class="btn-chunky px-2 py-0.5 text-sm {afford(next)
							? promoting
								? 'bg-tie-red'
								: 'bg-explosion-yellow'
							: 'bg-sand opacity-70'}"
						aria-disabled={!afford(next)}
						onclick={() => game.upgrade()}
					>
						{#if promoting}
							<IconStar class="size-4" aria-hidden="true" />
							{m.dronewall_upgrade_elite()}
						{:else}
							<IconArrowUp class="size-4" aria-hidden="true" />
							{m.dronewall_upgrade()}
						{/if}
						<span class="flex items-center gap-0.5" aria-label={m.dronewall_cost({ cost: next })}>
							<DroneWallDefense kind="helmet" class="size-4" />
							{next}
						</span>
					</button>
				{/if}
				<button
					type="button"
					class="btn-chunky px-2 py-0.5 text-sm"
					class:bg-explosion-yellow={confirmingSell}
					onclick={sell}
				>
					<IconCoins class="size-4" aria-hidden="true" />
					{confirmingSell ? m.dronewall_sell_confirm() : m.dronewall_sell()}
					<span class="flex items-center gap-0.5">
						<DroneWallDefense kind="helmet" class="size-4" />
						+{sellValue(defense.kind, defense.level)}
					</span>
				</button>
			</div>
		</div>
	{/if}
</div>
