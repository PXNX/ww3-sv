<!--
	The resource HUD: one chunky pill per resource with its picture, the amount and a thin fill bar
	(yellow when the warehouse is full), and below them the builders. Every builder is a little worker
	in a hard hat on a round badge: busy ones have a progress ring and a countdown, free ones are
	waiting with a green dot. Rates and capacities live in the tooltip instead of on screen.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { HOME_PRODUCTION } from '#lib/game/beachhead/campaign.js';
	import ResourceIcon from '#lib/components/ResourceIcon.svelte';
	import IconFlag from '~icons/lucide/flag-triangle-right';
	import IconHouse from '~icons/lucide/house';
	import IconHourglass from '~icons/lucide/hourglass';
	import IconShieldCheck from '~icons/lucide/shield-check';
	import IconWarehouse from '~icons/lucide/warehouse';
	import IconX from '~icons/lucide/x';
	import IconCrown from '~icons/lucide/crown';
	import IconGraduationCap from '~icons/lucide/graduation-cap';
	import IconLock from '~icons/lucide/lock';
	import type { BeachheadGame } from '#lib/stores/beachheadGame.svelte.js';

	let { game }: { game: BeachheadGame } = $props();

	const RESOURCES = [
		{ kind: 'wood', label: () => m.beachhead_resource_wood(), color: '#9b6a3c' },
		{ kind: 'stone', label: () => m.beachhead_resource_stone(), color: '#a7a9ad' },
		{ kind: 'iron', label: () => m.beachhead_resource_iron(), color: '#6f7b88' },
		{ kind: 'gold', label: () => m.beachhead_resource_gold(), color: '#e0b030' }
	] as const;

	let now = $state(Date.now());
	/** The resource whose production and storage are shown in detail */
	let detail = $state<(typeof RESOURCES)[number]['kind'] | null>(null);

	function detailOf(kind: (typeof RESOURCES)[number]['kind']) {
		const multiplier = 1 + 0.25 * (game.levelOf('hq') - 1);
		const total = game.income[kind];
		const home = Math.round(HOME_PRODUCTION[kind] * multiplier * 10) / 10;
		const capacity = game.storageCapacity(kind);
		const room = Math.max(0, capacity - game.resources[kind]);
		return {
			total,
			home,
			islands: Math.round((total - home) * 10) / 10,
			bonus: Math.round((multiplier - 1) * 100),
			capacity,
			// Minutes until the warehouses are full at the current rate
			minutesToFull: total > 0 && room > 0 ? Math.ceil(room / total) : null,
			warehouses: [0, 1].map((index) => game.levelOf(`warehouse-${kind}-${index}`))
		};
	}

	function minutes(value: number): string {
		return value >= 60 ? `${Math.floor(value / 60)}h ${value % 60}m` : `${value}m`;
	}
	/** Tapping a builder shows what Pro adds; it fades on its own */
	let proHint = $state(false);
	let hintTimer: ReturnType<typeof setTimeout> | undefined;

	function showProHint() {
		if (game.isPro) return;
		proHint = true;
		clearTimeout(hintTimer);
		hintTimer = setTimeout(() => (proHint = false), 4500);
	}
	onMount(() => {
		const timer = setInterval(() => (now = Date.now()), 1000);
		return () => {
			clearInterval(timer);
			clearTimeout(hintTimer);
		};
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

	/** The research in the lab, if any */
	const lab = $derived.by(() => {
		const research = game.research;
		if (!research) return null;
		const span = Math.max(1, research.endsAt - research.startedAt);
		return {
			progress: Math.min(1, Math.max(0, (now - research.startedAt) / span)),
			left: Math.max(0, research.endsAt - now)
		};
	});

	function short(ms: number): string {
		const total = Math.ceil(ms / 1000);
		if (total >= 3600) return `${Math.floor(total / 3600)}h`;
		if (total >= 60) return `${Math.floor(total / 60)}m`;
		return `${total}s`;
	}
</script>

<div class="relative flex flex-col items-end gap-1.5">
	{#if detail}
		{@const info = detailOf(detail)}
		{@const resource = RESOURCES.find((entry) => entry.kind === detail)!}
		<div
			class="detail-pop absolute top-full right-0 z-50 mt-1 flex w-60 flex-col gap-1.5 rounded-[14px] border-3 border-ink bg-paper p-2.5 shadow-[3px_3px_0_var(--color-ink)]"
			role="dialog"
			aria-label={resource.label()}
		>
			<div class="flex items-center justify-between gap-2">
				<p class="flex items-center gap-2 font-bold">
					<ResourceIcon kind={detail} class="size-8" />
					{resource.label()}
				</p>
				<button
					type="button"
					class="btn-chunky size-7 rounded-full p-0"
					aria-label={m.beachhead_tutorial_close()}
					onclick={() => (detail = null)}
				>
					<IconX class="mx-auto size-4" aria-hidden="true" />
				</button>
			</div>
			<div
				class="relative h-4 overflow-hidden rounded-full border-2 border-ink bg-sand"
				role="meter"
				aria-valuemin={0}
				aria-valuemax={info.capacity}
				aria-valuenow={game.resources[detail]}
				aria-label={m.beachhead_resource_capacity({ capacity: info.capacity })}
			>
				<div
					class="h-full"
					style:width="{Math.min(100, (game.resources[detail] / info.capacity) * 100)}%"
					style:background={resource.color}
				></div>
			</div>
			<p class="text-end font-display text-sm font-bold tabular-nums">
				{game.resources[detail]} / {info.capacity}
			</p>
			<ul class="flex flex-col gap-1 font-display text-sm font-bold tabular-nums">
				<li class="flex items-center justify-between gap-2" title={m.beachhead_home_base()}>
					<span class="flex items-center gap-1.5"
						><IconHouse class="size-4" aria-hidden="true" /></span
					>
					+{info.home}/min
				</li>
				<li
					class="flex items-center justify-between gap-2"
					title={m.beachhead_controlled_count({ count: game.controlled, total: game.islandCount })}
				>
					<span class="flex items-center gap-1.5">
						<IconFlag class="size-4" aria-hidden="true" />
						{game.controlled}
					</span>
					+{info.islands}/min
				</li>
				<li class="flex items-center justify-between gap-2 border-t-2 border-ink pt-1">
					<span>{m.beachhead_upgrade_hq()} +{info.bonus}%</span>
					<span>+{info.total}/min</span>
				</li>
				<li
					class="flex items-center justify-between gap-2"
					title={m.beachhead_building_bunker_hint({ percent: Math.round(game.securedShare * 100) })}
				>
					<span class="flex items-center gap-1.5">
						<IconShieldCheck class="size-4" aria-hidden="true" />
						{Math.round(game.securedShare * 100)}%
					</span>
					{game.resources[detail] - game.exposedStock(detail)}
				</li>
				{#if info.minutesToFull !== null}
					<li
						class="flex items-center justify-between gap-2"
						title={m.beachhead_resource_capacity({ capacity: info.capacity })}
					>
						<IconHourglass class="size-4" aria-hidden="true" />
						{minutes(info.minutesToFull)}
					</li>
				{/if}
			</ul>
			<ul class="flex gap-1.5" aria-label={m.beachhead_warehouses_title()}>
				{#each info.warehouses as level, index (index)}
					<li
						class="flex flex-1 items-center justify-between gap-1 rounded-full border-2 border-ink bg-sand px-2 py-0.5 font-display text-xs font-bold tabular-nums"
						title={m.beachhead_warehouse_hint({ capacity: level * 500 })}
					>
						<IconWarehouse class="size-3.5" aria-hidden="true" />
						{level}
						<span class="opacity-70">{level * 500}</span>
					</li>
				{/each}
			</ul>
		</div>
	{/if}
	<!-- A row across the top: a big picture overlapping a dark bar that fills up towards the warehouse cap -->
	<ul class="flex flex-wrap justify-end gap-x-1 gap-y-1.5 ps-3">
		{#each RESOURCES as resource (resource.kind)}
			{@const capacity = game.storageCapacity(resource.kind)}
			{@const full = game.isStorageFull(resource.kind)}
			<li class="relative">
				<button
					type="button"
					onclick={() => (detail = detail === resource.kind ? null : resource.kind)}
					aria-expanded={detail === resource.kind}
					class="relative flex h-8 items-center ps-4"
					title={`${resource.label()} — ${m.beachhead_resource_capacity({ capacity })} · ${m.beachhead_resource_rate({ amount: game.income[resource.kind] })}`}
				>
					<span
						class="relative flex h-6 min-w-[4.6rem] items-center justify-end overflow-hidden rounded-s-md rounded-e-full border-2 border-ink bg-ink/75 ps-5 pe-2 font-display text-sm leading-none font-bold text-paper tabular-nums [text-shadow:0_1px_0_var(--color-ink)] sm:min-w-[5.6rem]"
					>
						<span
							class="absolute inset-y-0 start-0 opacity-60"
							style:width="{Math.min(100, (game.resources[resource.kind] / capacity) * 100)}%"
							style:background={full ? 'var(--color-explosion-yellow)' : resource.color}
							aria-hidden="true"
						></span>
						<span class="relative">{game.resources[resource.kind]}</span>
					</span>
					<ResourceIcon
						kind={resource.kind}
						class="absolute start-0 top-1/2 size-8 -translate-y-1/2 drop-shadow-[1px_2px_0_var(--color-ink)]"
					/>
				</button>
			</li>
		{/each}
	</ul>

	<ul
		class="flex gap-1.5"
		aria-label={m.beachhead_builders({ busy: game.buildersBusy, total: game.builderSlots })}
	>
		{#each slots as slot, index (index)}
			<li class="relative">
				<button
					type="button"
					onclick={showProHint}
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
				</button>
			</li>
		{/each}
		<!-- The lab: the troop or skill being researched, with its ring and time left -->
		<li class="relative">
			<span
				class="relative flex size-12 items-center justify-center rounded-full border-3 border-ink shadow-[2px_2px_0_var(--color-ink)] {lab
					? 'bg-sand'
					: 'bg-paper'}"
				title={lab
					? m.beachhead_building_remaining({ time: short(lab.left) })
					: m.beachhead_building_training()}
			>
				{#if lab}
					<span
						class="absolute inset-0.5 rounded-full"
						style:background="conic-gradient(var(--color-flag-blue) {lab.progress * 360}deg,
						transparent 0)"
						aria-hidden="true"
					></span>
					<span class="absolute inset-[5px] rounded-full bg-sand" aria-hidden="true"></span>
				{/if}
				<IconGraduationCap class="relative size-6" aria-hidden="true" />
				{#if lab}
					<span
						class="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full border-2 border-ink bg-paper px-1 font-display text-[0.62rem] leading-3.5 font-bold tabular-nums"
					>
						{short(lab.left)}
					</span>
				{:else}
					<span
						class="absolute -right-0.5 -bottom-0.5 size-3.5 rounded-full border-2 border-ink bg-[#3fa65a]"
						aria-hidden="true"
					></span>
				{/if}
			</span>
		</li>
		{#if !game.isPro}
			<li class="relative">
				<button
					type="button"
					onclick={showProHint}
					class="relative flex size-12 items-center justify-center rounded-full border-3 border-dashed border-ink bg-sand/70 opacity-80"
					aria-label={m.beachhead_builders_pro()}
					title={m.beachhead_builders_pro()}
				>
					<IconLock class="size-5" aria-hidden="true" />
					<span
						class="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full border-2 border-ink bg-explosion-yellow"
						aria-hidden="true"
					>
						<IconCrown class="size-3" />
					</span>
				</button>
			</li>
		{/if}
	</ul>
	{#if proHint && !game.isPro}
		<p
			class="hint-pop flex max-w-52 items-start gap-1.5 rounded-[12px] border-2 border-ink bg-explosion-yellow px-2 py-1 text-xs font-bold shadow-[2px_2px_0_var(--color-ink)]"
			role="status"
		>
			<IconCrown class="mt-px size-4 shrink-0" aria-hidden="true" />
			{m.beachhead_builders_pro()}
		</p>
	{/if}
</div>

<style>
	.detail-pop {
		animation: detail-pop 160ms ease-out;
	}

	@keyframes detail-pop {
		from {
			transform: translateX(6px) scale(0.97);
			opacity: 0;
		}
	}

	.hint-pop {
		animation: hint-pop 180ms ease-out;
	}

	@keyframes hint-pop {
		from {
			transform: translateY(-4px) scale(0.96);
			opacity: 0;
		}
	}

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
