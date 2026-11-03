<!--
	The resource HUD: one chunky pill per resource with its picture, the amount and a thin fill bar
	(yellow when the warehouse is full), and below them the builders. Every builder is a little worker
	in a hard hat on a round badge: busy ones have a progress ring and a countdown, free ones are
	waiting with a green dot. Rates and capacities live in the tooltip instead of on screen.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import ResourceIcon from '#lib/components/ResourceIcon.svelte';
	import type { BeachheadGame } from '#lib/stores/beachheadGame.svelte.js';

	let { game }: { game: BeachheadGame } = $props();

	const RESOURCES = [
		{ kind: 'wood', label: () => m.beachhead_resource_wood(), color: '#9b6a3c' },
		{ kind: 'stone', label: () => m.beachhead_resource_stone(), color: '#a7a9ad' },
		{ kind: 'iron', label: () => m.beachhead_resource_iron(), color: '#6f7b88' },
		{ kind: 'gold', label: () => m.beachhead_resource_gold(), color: '#e0b030' }
	] as const;

	let now = $state(Date.now());
	onMount(() => {
		const timer = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(timer);
	});

	const slots = $derived(
		Array.from({ length: game.builderSlots }, (_, index) => {
			const task = game.campaign.builders[index];
			if (!task) return { busy: false as const, progress: 0, left: 0 };
			const span = Math.max(1, task.endsAt - task.startedAt);
			return {
				busy: true as const,
				progress: Math.min(1, Math.max(0, (now - task.startedAt) / span)),
				left: Math.max(0, task.endsAt - now)
			};
		})
	);

	function short(ms: number): string {
		const total = Math.ceil(ms / 1000);
		if (total >= 3600) return `${Math.floor(total / 3600)}h`;
		if (total >= 60) return `${Math.floor(total / 60)}m`;
		return `${total}s`;
	}
</script>

<div class="flex flex-col items-end gap-1.5">
	<ul class="flex flex-col gap-1">
		{#each RESOURCES as resource (resource.kind)}
			{@const capacity = game.storageCapacity(resource.kind)}
			{@const full = game.isStorageFull(resource.kind)}
			<li
				class="relative flex min-w-[5.8rem] items-center gap-1.5 overflow-hidden rounded-full border-2 border-ink py-0.5 ps-0.5 pe-2.5 font-display text-sm font-bold tabular-nums shadow-[2px_2px_0_var(--color-ink)] {full
					? 'bg-explosion-yellow'
					: 'bg-paper'}"
				title={`${resource.label()} — ${m.beachhead_resource_capacity({ capacity })} · ${m.beachhead_resource_rate({ amount: game.income[resource.kind] })}`}
			>
				<ResourceIcon kind={resource.kind} class="size-7 shrink-0" />
				<span class="flex-1 text-end">{game.resources[resource.kind]}</span>
				<span
					class="absolute inset-x-1.5 bottom-0 h-[3px] rounded-full bg-ink/15"
					aria-hidden="true"
				>
					<span
						class="block h-full rounded-full"
						style:width="{Math.min(100, (game.resources[resource.kind] / capacity) * 100)}%"
						style:background={resource.color}
					></span>
				</span>
			</li>
		{/each}
	</ul>

	<ul
		class="flex gap-1.5"
		aria-label={m.beachhead_builders({ busy: game.buildersBusy, total: game.builderSlots })}
	>
		{#each slots as slot, index (index)}
			<li
				class="relative flex size-12 items-center justify-center rounded-full border-3 border-ink shadow-[2px_2px_0_var(--color-ink)] {slot.busy
					? 'bg-sand'
					: 'bg-paper'}"
				title={slot.busy
					? m.beachhead_building_remaining({ time: short(slot.left) })
					: m.beachhead_builders({ busy: game.buildersBusy, total: game.builderSlots })}
			>
				{#if slot.busy}
					<span
						class="absolute inset-0.5 rounded-full"
						style:background="conic-gradient(var(--color-khaki) {slot.progress * 360}deg,
						transparent 0)"
						aria-hidden="true"
					></span>
					<span class="absolute inset-[5px] rounded-full bg-sand" aria-hidden="true"></span>
				{/if}
				<!-- A worker in a yellow hard hat -->
				<svg
					viewBox="0 0 32 32"
					class="relative size-9"
					class:builder-work={slot.busy}
					aria-hidden="true"
				>
					<circle cx="16" cy="19" r="8" fill="#f6c9a0" stroke="#111" stroke-width="1.6" />
					<path
						d="M7 17a9 9 0 0 1 18 0z"
						fill="#f5c83a"
						stroke="#111"
						stroke-width="1.6"
						stroke-linejoin="round"
					/>
					<rect
						x="5"
						y="16"
						width="22"
						height="3"
						rx="1.5"
						fill="#e0a91c"
						stroke="#111"
						stroke-width="1.4"
					/>
					<path d="M16 8v8" stroke="#111" stroke-width="1.4" />
					<circle cx="13" cy="21" r="1.1" fill="#111" />
					<circle cx="19" cy="21" r="1.1" fill="#111" />
					<path
						d="M13 24.2q3 2 6 0"
						fill="none"
						stroke="#111"
						stroke-width="1.3"
						stroke-linecap="round"
					/>
				</svg>
				{#if slot.busy}
					<span
						class="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full border-2 border-ink bg-paper px-1 font-display text-[0.62rem] leading-3.5 font-bold tabular-nums"
					>
						{short(slot.left)}
					</span>
				{:else}
					<span
						class="absolute -right-0.5 -bottom-0.5 size-3.5 rounded-full border-2 border-ink bg-[#3fa65a]"
						aria-hidden="true"
					></span>
				{/if}
			</li>
		{/each}
	</ul>
</div>

<style>
	.builder-work {
		animation: builder-bob 0.9s ease-in-out infinite;
		transform-origin: 50% 90%;
	}

	@keyframes builder-bob {
		0%,
		100% {
			transform: rotate(-4deg) translateY(0);
		}
		45% {
			transform: rotate(5deg) translateY(1px);
		}
		50% {
			transform: rotate(5deg) translateY(2px) scaleY(0.94);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.builder-work {
			animation: none;
		}
	}
</style>
