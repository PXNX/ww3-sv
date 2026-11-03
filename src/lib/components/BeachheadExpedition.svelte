<!--
	The expedition sheet. Three trips of two, four and eight hours, each with its price; while a ship is
	out a countdown and a ring show how long it still has, and when it is back a chest waits. Opening
	the chest lists what was inside: resources, crystals, hero shards and Fake News.
-->
<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import CrystalIcon from '#lib/components/CrystalIcon.svelte';
	import ResourceIcon from '#lib/components/ResourceIcon.svelte';
	import type { CrystalType } from '#lib/game/beachhead/crystals.js';
	import type { BeachheadGame } from '#lib/stores/beachheadGame.svelte.js';
	import IconCoins from '~icons/lucide/coins';
	import IconGem from '~icons/lucide/gem';
	import IconHourglass from '~icons/lucide/hourglass';
	import IconPackage from '~icons/lucide/package';
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

	type Reward =
		| { kind: 'resource'; resource: (typeof RESOURCE_KINDS)[number]; amount: number }
		| { kind: 'crystal'; type: CrystalType; amount: number }
		| { kind: 'shards'; amount: number }
		| { kind: 'coins'; amount: number };

	/** The chest's contents in the order they come out; nothing of it is known before the taps */
	const rewards = $derived.by((): Reward[] => {
		const chest = game.chest;
		if (!chest) return [];
		const list: Reward[] = [];
		for (const resource of RESOURCE_KINDS) {
			if (chest.resources[resource] > 0) {
				list.push({ kind: 'resource', resource, amount: chest.resources[resource] });
			}
		}
		for (const entry of chest.crystals) {
			list.push({ kind: 'crystal', type: entry.type, amount: entry.count });
		}
		if (chest.shards > 0) list.push({ kind: 'shards', amount: chest.shards });
		if (chest.coins > 0) list.push({ kind: 'coins', amount: chest.coins });
		return list;
	});
	let taps = $state(0);
	const latest = $derived(taps > 0 ? (rewards[taps - 1] ?? null) : null);
	const done = $derived(taps >= rewards.length);

	function reveal() {
		if (taps < rewards.length) taps += 1;
		if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.(12);
	}

	// A new chest starts closed again
	$effect(() => {
		if (game.chest) untrack(() => (taps = 0));
	});

	const clock = (ms: number): string => {
		const total = Math.ceil(ms / 1000);
		const hours = Math.floor(total / 3600);
		const minutes = Math.floor((total % 3600) / 60);
		return `${hours}:${String(minutes).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
	};
</script>

{#snippet pill(reward: Reward)}
	<span
		class="flex items-center gap-1.5 rounded-full border-3 border-ink py-1 ps-1.5 pe-3 font-display text-lg font-bold tabular-nums shadow-[2px_2px_0_var(--color-ink)] {reward.kind ===
		'shards'
			? 'bg-[#b48cf0]'
			: reward.kind === 'coins'
				? 'bg-explosion-yellow'
				: 'bg-paper'}"
	>
		{#if reward.kind === 'resource'}
			<ResourceIcon kind={reward.resource} class="size-7" />
		{:else if reward.kind === 'crystal'}
			<CrystalIcon type={reward.type} class="size-7" />
		{:else if reward.kind === 'shards'}
			<IconGem class="size-7" aria-hidden="true" />
		{:else}
			<IconCoins class="size-7" aria-hidden="true" />
		{/if}
		+{reward.amount}
	</span>
{/snippet}

{#if game.chest}
	<div class="flex flex-col items-center gap-3 text-center">
		<!-- The chest opens a little with every tap and throws out the next reward -->
		<div class="relative flex h-28 w-full items-end justify-center">
			{#key taps}
				<button
					type="button"
					class="chest-tap btn-chunky relative flex size-20 items-center justify-center rounded-full bg-explosion-yellow p-0"
					aria-label={m.beachhead_expedition_open()}
					title={m.beachhead_expedition_open()}
					disabled={done}
					onclick={reveal}
				>
					{#if taps === 0}
						<IconPackage class="size-10" aria-hidden="true" />
					{:else}
						<IconPackageOpen class="size-10" aria-hidden="true" />
					{/if}
				</button>
			{/key}
			{#if latest}
				{#key taps}
					<span class="reward-fly absolute bottom-10 flex items-center" aria-hidden="true">
						{@render pill(latest)}
					</span>
				{/key}
			{/if}
		</div>
		<ul class="flex flex-wrap justify-center gap-2">
			{#each rewards.slice(0, Math.max(0, taps - 1)) as reward, index (index)}
				<li>{@render pill(reward)}</li>
			{/each}
			{#if taps > 0}
				<li class="settle">{@render pill(rewards[taps - 1])}</li>
			{/if}
		</ul>
		{#if done}
			<button type="button" class="btn-chunky" onclick={() => (game.chest = null)}>
				<IconShip class="size-5" aria-hidden="true" />
			</button>
		{/if}
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
	.chest-tap {
		animation: chest-shake 360ms ease-out;
	}

	@keyframes chest-shake {
		0% {
			transform: scale(1);
		}
		25% {
			transform: scale(0.85) rotate(-8deg);
		}
		60% {
			transform: scale(1.15) rotate(6deg);
		}
		100% {
			transform: scale(1);
		}
	}

	/* The reward shoots out of the chest, hangs for a moment, then settles into the list below */
	.reward-fly {
		animation: reward-fly 900ms cubic-bezier(0.2, 0.9, 0.3, 1) forwards;
		pointer-events: none;
	}

	@keyframes reward-fly {
		0% {
			transform: translateY(40px) scale(0.2);
			opacity: 0;
		}
		35% {
			transform: translateY(-34px) scale(1.25);
			opacity: 1;
		}
		70% {
			transform: translateY(-26px) scale(1.1);
			opacity: 1;
		}
		100% {
			transform: translateY(30px) scale(0.9);
			opacity: 0;
		}
	}

	.settle {
		animation: settle 500ms 650ms backwards;
	}

	@keyframes settle {
		from {
			transform: scale(0);
			opacity: 0;
		}
	}

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
		.chest-tap,
		.reward-fly,
		.settle,
		.chest-wobble,
		:global(.chest-open) {
			animation: none;
		}
	}
</style>
