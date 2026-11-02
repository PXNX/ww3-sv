<!--
	The player's shore base: what the islands produce, and the three upgrades that make the next
	landing possible. Supplies are banked on every visit and while the screen stays open.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import type { Component } from 'svelte';
	import type { SvelteHTMLElements } from 'svelte/elements';
	import { m } from '#lib/paraglide/messages.js';
	import type { UpgradeKey } from '#lib/game/beachhead/campaign.js';
	import type { BeachheadGame } from '#lib/stores/beachheadGame.svelte.js';
	import IconFlag from '~icons/lucide/flag-triangle-right';
	import IconLock from '~icons/lucide/lock';
	import IconShip from '~icons/lucide/ship';
	import IconTreePalm from '~icons/lucide/tree-palm';
	import IconUsers from '~icons/lucide/users';

	let { game }: { game: BeachheadGame } = $props();

	const UPGRADES: readonly {
		key: UpgradeKey;
		icon: Component<SvelteHTMLElements['svg']>;
		name: string;
		hint: string;
	}[] = [
		{
			key: 'hq',
			icon: IconFlag,
			name: m.beachhead_upgrade_hq(),
			hint: m.beachhead_upgrade_hq_hint()
		},
		{
			key: 'troops',
			icon: IconUsers,
			name: m.beachhead_upgrade_troops(),
			hint: m.beachhead_upgrade_troops_hint()
		},
		{
			key: 'landing',
			icon: IconShip,
			name: m.beachhead_upgrade_landing(),
			hint: m.beachhead_upgrade_landing_hint()
		}
	];

	// Supplies tick in whole minutes; checking often keeps the counter close to the clock
	onMount(() => {
		const timer = setInterval(() => game.collectIncome(), 15_000);
		return () => clearInterval(timer);
	});
</script>

<section class="flex flex-col gap-4" aria-labelledby="beachhead-base-title">
	<div class="flex flex-wrap items-end justify-between gap-2">
		<div class="flex items-center gap-3">
			<span
				class="flex size-14 shrink-0 items-center justify-center rounded-[14px_8px_16px_10px] border-3 border-ink bg-khaki text-paper shadow-[3px_3px_0_var(--color-ink)]"
			>
				<IconTreePalm class="size-8" aria-hidden="true" />
			</span>
			<div>
				<h2 id="beachhead-base-title" class="text-2xl font-bold">{m.beachhead_base_title()}</h2>
				<p>{m.beachhead_base_intro()}</p>
			</div>
		</div>
		<div class="flex flex-wrap items-center gap-2 font-display font-bold">
			<p class="rounded-md border-2 border-ink bg-paper px-2 py-0.5">
				{m.beachhead_supplies({ count: game.supplies })}
			</p>
			<p class="rounded-md border-2 border-ink bg-explosion-yellow px-2 py-0.5">
				{m.beachhead_income({ rate: game.incomeRate })}
			</p>
			<p class="rounded-md border-2 border-ink bg-paper px-2 py-0.5">
				{m.beachhead_controlled_count({ count: game.controlled, total: game.islandCount })}
			</p>
		</div>
	</div>

	<div
		class="relative overflow-hidden rounded-[18px_10px_16px_8px] border-3 border-ink bg-sand shadow-[4px_4px_0_var(--color-ink)]"
	>
		<div
			class="h-12 border-b-3 border-ink bg-flag-blue"
			aria-hidden="true"
			style:background-image="repeating-linear-gradient(90deg, transparent 0 18px, rgb(255 255 255 /
			0.16) 18px 24px)"
		></div>
		<div class="flex flex-wrap items-center justify-between gap-3 p-4">
			<div class="flex items-center gap-3">
				<IconTreePalm class="size-12 shrink-0 text-khaki" aria-hidden="true" />
				<div>
					<p class="text-lg font-bold">{m.beachhead_home_base()}</p>
					<p class="text-sm font-semibold">{m.beachhead_tutorial_base()}</p>
				</div>
			</div>
			<button type="button" class="btn-chunky bg-flag-blue text-lg" onclick={() => game.goMap()}>
				{m.beachhead_to_map()}
			</button>
		</div>
	</div>

	<h3 class="text-xl font-bold">{m.beachhead_upgrades_title()}</h3>
	<ul class="grid gap-3 sm:grid-cols-3">
		{#each UPGRADES as upgrade (upgrade.key)}
			{@const level = game.campaign.upgrades[upgrade.key]}
			{@const max = game.maxUpgrade(upgrade.key)}
			{@const cost = game.upgradeCost(upgrade.key)}
			{@const locked = game.upgradeLocked(upgrade.key)}
			{@const Icon = upgrade.icon}
			<li>
				<div class="sticker flex h-full flex-col gap-2 p-3" style:--tilt="-0.8deg">
					<div class="flex items-center gap-2">
						<Icon class="size-6 shrink-0" aria-hidden="true" />
						<div class="leading-tight">
							<p class="font-bold">{upgrade.name}</p>
							<p class="text-xs font-semibold">
								{m.beachhead_upgrade_level({ level, max })}
							</p>
						</div>
					</div>
					<p class="text-sm leading-snug">{upgrade.hint}</p>
					<div class="flex gap-1" aria-hidden="true">
						{#each Array.from({ length: max }, (_, index) => index + 1) as pip (pip)}
							<span
								class="h-2 flex-1 rounded-sm border-2 border-ink {pip <= level
									? 'bg-khaki'
									: 'bg-paper'}"
							></span>
						{/each}
					</div>
					<button
						type="button"
						class="btn-chunky mt-auto w-full text-sm"
						disabled={locked || cost === null || !game.canUpgrade(upgrade.key)}
						onclick={() => game.upgrade(upgrade.key)}
					>
						{#if locked}
							<IconLock class="size-4" aria-hidden="true" />
							{m.beachhead_upgrade_locked()}
						{:else if cost === null}
							{m.beachhead_upgrade_max()}
						{:else}
							{m.beachhead_upgrade_cost({ cost })}
						{/if}
					</button>
				</div>
			</li>
		{/each}
	</ul>
</section>
