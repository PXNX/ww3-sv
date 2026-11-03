<!--
	The expedition sheet. Three trips of two, four and eight hours, each with its price; while a ship is
	out a countdown and a ring show how long it still has, and when it is back a chest waits. Opening
	the chest lists what was inside: resources, crystals, hero shards and Fake News.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { crystalName } from '#lib/components/beachheadText.js';
	import CrystalIcon from '#lib/components/CrystalIcon.svelte';
	import ResourceIcon from '#lib/components/ResourceIcon.svelte';
	import type { BeachheadGame } from '#lib/stores/beachheadGame.svelte.js';
	import IconCoins from '~icons/lucide/coins';
	import IconGem from '~icons/lucide/gem';
	import IconHourglass from '~icons/lucide/hourglass';
	import IconPackageOpen from '~icons/lucide/package-open';
	import IconPlay from '~icons/lucide/play';
	import IconShip from '~icons/lucide/ship';

	let { game }: { game: BeachheadGame } = $props();

	const RESOURCE_KINDS = ['wood', 'stone', 'iron', 'gold'] as const;
	let now = $state(Date.now());
	onMount(() => {
		const timer = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(timer);
	});

	const expedition = $derived(game.expedition);
	const left = $derived(expedition ? Math.max(0, expedition.endsAt - now) : 0);
	const progress = $derived(
		expedition
			? Math.min(
					1,
					Math.max(0, (now - expedition.startedAt) / (expedition.endsAt - expedition.startedAt))
				)
			: 0
	);
	const back = $derived(expedition !== null && left <= 0);

	const clock = (ms: number): string => {
		const total = Math.ceil(ms / 1000);
		const hours = Math.floor(total / 3600);
		const minutes = Math.floor((total % 3600) / 60);
		return `${hours}:${String(minutes).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
	};
</script>

{#if game.chest}
	{@const chest = game.chest}
	<div class="flex flex-col items-center gap-3 text-center">
		<IconPackageOpen class="chest-open size-16" aria-hidden="true" />
		<ul class="flex flex-wrap justify-center gap-2">
			{#each RESOURCE_KINDS as kind (kind)}
				<li
					class="pop-in flex items-center gap-1.5 rounded-full border-3 border-ink bg-paper py-1 ps-1.5 pe-3 font-display text-lg font-bold tabular-nums shadow-[2px_2px_0_var(--color-ink)]"
				>
					<ResourceIcon {kind} class="size-7" />
					+{chest.resources[kind]}
				</li>
			{/each}
			{#each chest.crystals as entry (entry.type)}
				<li
					class="pop-in flex items-center gap-1.5 rounded-full border-3 border-ink bg-paper py-1 ps-1.5 pe-3 font-display text-lg font-bold tabular-nums shadow-[2px_2px_0_var(--color-ink)]"
					title={crystalName(entry.type)}
				>
					<CrystalIcon type={entry.type} class="size-7" />
					+{entry.count}
				</li>
			{/each}
			<li
				class="pop-in flex items-center gap-1.5 rounded-full border-3 border-ink bg-[#b48cf0] py-1 ps-1.5 pe-3 font-display text-lg font-bold tabular-nums shadow-[2px_2px_0_var(--color-ink)]"
				title={m.beachhead_hero_cards({ cards: chest.shards })}
			>
				<IconGem class="size-7" aria-hidden="true" />
				+{chest.shards}
			</li>
			<li
				class="pop-in flex items-center gap-1.5 rounded-full border-3 border-ink bg-explosion-yellow py-1 ps-1.5 pe-3 font-display text-lg font-bold tabular-nums shadow-[2px_2px_0_var(--color-ink)]"
				title={m.beachhead_expedition_coins()}
			>
				<IconCoins class="size-7" aria-hidden="true" />
				+{chest.coins}
			</li>
		</ul>
		<button type="button" class="btn-chunky" onclick={() => (game.chest = null)}>
			<IconShip class="size-5" aria-hidden="true" />
		</button>
	</div>
{:else if expedition}
	<div class="flex flex-col items-center gap-3">
		<div
			class="relative flex size-28 items-center justify-center rounded-full border-3 border-ink"
			style:background="conic-gradient(var(--color-khaki) {progress * 360}deg, var(--color-sand) 0)"
		>
			<span class="absolute inset-2 rounded-full bg-paper"></span>
			{#if back}
				<button
					type="button"
					class="chest-wobble btn-chunky relative flex size-20 items-center justify-center rounded-full bg-explosion-yellow p-0"
					aria-label={m.beachhead_expedition_open()}
					title={m.beachhead_expedition_open()}
					onclick={() => game.openChest()}
				>
					<IconPackageOpen class="size-10" aria-hidden="true" />
				</button>
			{:else}
				<IconShip class="relative size-12" aria-hidden="true" />
			{/if}
		</div>
		{#if !back}
			<p class="flex items-center gap-1.5 font-display text-xl font-bold tabular-nums">
				<IconHourglass class="size-5" aria-hidden="true" />
				{clock(left)}
			</p>
		{/if}
	</div>
{:else}
	<ul class="grid gap-2 sm:grid-cols-3">
		{#each game.expeditionTiers as tier, index (index)}
			<li class="flex flex-col items-center gap-2 rounded-[14px] border-2 border-ink bg-sand p-3">
				<IconShip class="size-10" aria-hidden="true" />
				<p class="flex items-center gap-1 font-display text-lg font-bold tabular-nums">
					<IconHourglass class="size-4" aria-hidden="true" />
					{tier.hours}h
				</p>
				<span class="flex flex-wrap justify-center gap-1 font-display text-xs font-bold">
					{#each RESOURCE_KINDS as kind (kind)}
						{#if tier.cost[kind] > 0}
							<span
								class="inline-flex items-center gap-0.5 rounded-full border-2 border-ink py-px ps-0.5 pe-1.5 {game
									.resources[kind] >= tier.cost[kind]
									? 'bg-paper'
									: 'bg-tie-red text-paper'}"
							>
								<ResourceIcon {kind} class="size-4" />
								{tier.cost[kind]}
							</span>
						{/if}
					{/each}
				</span>
				<button
					type="button"
					class="btn-chunky flex size-10 items-center justify-center rounded-full bg-khaki p-0 text-paper"
					aria-label={m.beachhead_expedition_send()}
					title={m.beachhead_expedition_send()}
					disabled={!game.canStartExpedition(index)}
					onclick={() => game.startExpedition(index)}
				>
					<IconPlay class="size-5" aria-hidden="true" />
				</button>
			</li>
		{/each}
	</ul>
{/if}

<style>
	.chest-wobble {
		animation: chest-wobble 1.1s ease-in-out infinite;
	}

	@keyframes chest-wobble {
		0%,
		100% {
			transform: rotate(-4deg) scale(1);
		}
		50% {
			transform: rotate(4deg) scale(1.06);
		}
	}

	:global(.chest-open) {
		animation: chest-pop 500ms cubic-bezier(0.2, 1.4, 0.4, 1);
	}

	@keyframes chest-pop {
		from {
			transform: scale(0.3) rotate(-20deg);
			opacity: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.chest-wobble,
		:global(.chest-open) {
			animation: none;
		}
	}
</style>
