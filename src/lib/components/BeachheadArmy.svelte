<!--
	The army sheet: a grid of troop tiles. Each tile shows the unit, its training level, how many ride
	in the boats and what they cost in gold. Troops killed in attacks are gone for good until they are
	retrained with gold: the red badge counts them, one button brings back as many as the gold allows.
-->
<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { ARMY_KINDS, type Resources } from '#lib/game/beachhead/campaign.js';
	import {
		MAX_TROOP_LEVEL,
		TROOPS,
		type ArmyKind,
		type TroopKind
	} from '#lib/game/beachhead/config.js';
	import { troopName } from '#lib/components/beachheadText.js';
	import { TROOP_ICONS } from '#lib/components/beachheadIcons.js';
	import ResourceIcon from '#lib/components/ResourceIcon.svelte';
	import type { BeachheadGame } from '#lib/stores/beachheadGame.svelte.js';
	import IconCircleArrowUp from '~icons/lucide/circle-arrow-up';
	import IconLock from '~icons/lucide/lock';
	import IconMinus from '~icons/lucide/minus';
	import IconPlus from '~icons/lucide/plus';
	import IconRotateCcw from '~icons/lucide/rotate-ccw';
	import IconShip from '~icons/lucide/ship';
	import IconStar from '~icons/lucide/star';
	import IconUsers from '~icons/lucide/users';

	let { game }: { game: BeachheadGame } = $props();

	const RESOURCE_KINDS = ['wood', 'stone', 'iron', 'gold'] as const;
	const kinds = Object.keys(TROOPS) as TroopKind[];
	const isArmy = (kind: TroopKind): kind is ArmyKind =>
		(ARMY_KINDS as readonly string[]).includes(kind);
	const fill = $derived(game.armyCapacity > 0 ? game.armyUsed / game.armyCapacity : 0);
	const lost = $derived(game.lost);
</script>

{#snippet costChips(cost: Resources)}
	<span
		class="flex flex-wrap items-center justify-center gap-1 font-display text-[0.7rem] font-bold"
	>
		{#each RESOURCE_KINDS as resource (resource)}
			<span
				class="inline-flex items-center gap-0.5 rounded border-2 border-ink px-1 {game.resources[
					resource
				] >= cost[resource]
					? 'bg-paper'
					: 'bg-tie-red text-paper'}"
			>
				<ResourceIcon kind={resource} class="size-3.5" />
				{cost[resource]}
			</span>
		{/each}
	</span>
{/snippet}

<div class="flex flex-wrap items-center gap-2">
	<IconUsers class="size-5 shrink-0" aria-hidden="true" />
	<div
		class="h-4 min-w-24 flex-1 overflow-hidden rounded-full border-2 border-ink bg-sand"
		role="meter"
		aria-valuemin={0}
		aria-valuemax={game.armyCapacity}
		aria-valuenow={game.armyUsed}
		aria-label={m.beachhead_army_capacity({ used: game.armyUsed, capacity: game.armyCapacity })}
	>
		<div
			class="h-full {fill >= 1 ? 'bg-tie-red' : 'bg-khaki'}"
			style:width="{Math.min(100, fill * 100)}%"
		></div>
	</div>
	<span class="font-display text-sm font-bold tabular-nums"
		>{game.armyUsed}/{game.armyCapacity}</span
	>
	{#if game.lostTotal > 0}
		<button
			type="button"
			class="btn-chunky flex items-center gap-1.5 bg-explosion-yellow text-sm"
			aria-label={m.beachhead_retrain_all()}
			title={m.beachhead_retrain_all()}
			onclick={() => game.retrainAll()}
		>
			<IconRotateCcw class="size-4" aria-hidden="true" />
			<span class="tabular-nums">{game.lostTotal}</span>
			<ResourceIcon kind="gold" class="size-4" />
			<span class="tabular-nums">{game.retrainTotal}</span>
		</button>
	{/if}
</div>

<ul class="flex flex-wrap gap-1.5" aria-label={m.beachhead_boats_title()}>
	{#each game.boats as boat (boat.index)}
		<li
			class="flex items-center gap-1 rounded-full border-2 border-ink px-2 py-0.5 font-display text-xs font-bold tabular-nums {boat.unlocked
				? 'bg-paper'
				: 'bg-sand opacity-60'}"
			title={m.beachhead_boat_label({ index: boat.index + 1 })}
		>
			{#if boat.unlocked}
				<IconShip class="size-3.5" aria-hidden="true" />
				{boat.units.length}/{boat.capacity}
			{:else}
				<IconLock class="size-3.5" aria-hidden="true" />
			{/if}
		</li>
	{/each}
</ul>

<ul class="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
	{#each kinds as kind (kind)}
		{@const TroopIcon = TROOP_ICONS[kind]}
		{@const level = game.troopLevel(kind)}
		{@const cost = game.troopUpgradeCost(kind)}
		{@const locked = game.troopUpgradeLocked(kind)}
		<li
			class="relative flex flex-col items-center gap-1 rounded-[14px] border-2 border-ink bg-sand p-2"
		>
			{#if isArmy(kind) && lost[kind] > 0}
				<span
					class="absolute -end-1 -top-2 z-10 flex min-w-6 items-center justify-center rounded-full border-2 border-ink bg-tie-red px-1 font-display text-xs font-bold text-paper tabular-nums"
					title={m.beachhead_lost_troops()}
				>
					−{lost[kind]}
				</span>
			{/if}
			<span
				class="flex size-12 items-center justify-center rounded-full border-3 border-ink bg-paper shadow-[2px_2px_0_var(--color-ink)]"
			>
				<TroopIcon class="size-7" aria-hidden="true" />
			</span>
			<p class="text-center text-xs leading-tight font-bold">{troopName(kind)}</p>
			<div
				class="flex gap-px"
				role="img"
				aria-label={m.beachhead_troop_level({ level, max: MAX_TROOP_LEVEL })}
				title={m.beachhead_troop_stats({
					hp: game.troopStats(kind).hp,
					damage: game.troopStats(kind).damage
				})}
			>
				{#each Array.from({ length: MAX_TROOP_LEVEL }, (_, index) => index + 1) as pip (pip)}
					<span
						class="h-1.5 w-2 rounded-sm border border-ink {pip <= level ? 'bg-khaki' : 'bg-paper'}"
					></span>
				{/each}
			</div>

			{#if isArmy(kind)}
				<div class="flex items-center gap-1">
					<button
						type="button"
						class="btn-chunky size-7 rounded-full p-0"
						aria-label={m.beachhead_army_remove({ troop: troopName(kind) })}
						disabled={game.campaign.army[kind] <= 0}
						onclick={() => game.changeTroop(kind, -1)}
					>
						<IconMinus class="mx-auto size-3.5" aria-hidden="true" />
					</button>
					<span class="w-7 text-center font-display text-base font-bold tabular-nums">
						{game.campaign.army[kind]}
					</span>
					<button
						type="button"
						class="btn-chunky size-7 rounded-full p-0"
						aria-label={m.beachhead_army_add({ troop: troopName(kind) })}
						disabled={game.armyCapacity - game.armyUsed < TROOPS[kind].space ||
							game.resources.gold < game.retrainGold(kind)}
						onclick={() => game.changeTroop(kind, 1)}
					>
						<IconPlus class="mx-auto size-3.5" aria-hidden="true" />
					</button>
				</div>
				<span
					class="inline-flex items-center gap-0.5 font-display text-[0.7rem] font-bold {game
						.resources.gold >= game.retrainGold(kind)
						? ''
						: 'text-tie-red'}"
					title={m.beachhead_retrain_cost()}
				>
					<ResourceIcon kind="gold" class="size-3.5" />
					{game.retrainGold(kind)}
				</span>
			{/if}

			{#if cost === null}
				<IconStar class="size-5 text-explosion-yellow" aria-label={m.beachhead_upgrade_max()} />
			{:else if locked}
				<IconLock class="size-5" aria-label={m.beachhead_troop_locked()} />
			{:else}
				{@render costChips(cost)}
				<button
					type="button"
					class="btn-chunky flex size-8 items-center justify-center rounded-full p-0"
					aria-label={`${m.beachhead_troop_train()} ${troopName(kind)}`}
					disabled={!game.canUpgradeTroop(kind)}
					onclick={() => game.upgradeTroop(kind)}
				>
					<IconCircleArrowUp class="size-5" aria-hidden="true" />
				</button>
			{/if}
		</li>
	{/each}
</ul>
