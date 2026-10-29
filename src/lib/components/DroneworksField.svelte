<!--
	Drone Works playfield: the contract with its quota and clock, the resource strip, the shop floor
	with its twelve build slots, and one panel for whatever slot is selected (build menu on an empty
	one, repair and demolish on a building). The fixed-step loop only ticks the plant; everything
	here reads the reactive copies from the store.
-->
<script lang="ts">
	import { onMount, type Component } from 'svelte';
	import { BUILDING_IDS, BUILDINGS, RESOURCES } from '#lib/game/droneworks/config.js';
	import type { BuildingId } from '#lib/game/droneworks/config.js';
	import { createFixedLoop, onAppHidden } from '#lib/game/loop.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { DroneworksGame } from '#lib/stores/droneworksGame.svelte.js';
	import { displayAmount } from '#lib/game/droneworks/state.js';
	import PauseOverlay from './PauseOverlay.svelte';
	import {
		buildingAbout,
		buildingName,
		droneName,
		droneRecipe,
		resourceName
	} from './droneworksText.js';
	import IconCog from '~icons/lucide/cog';
	import IconCoins from '~icons/lucide/coins';
	import IconCpu from '~icons/lucide/cpu';
	import IconFactory from '~icons/lucide/factory';
	import IconFlame from '~icons/lucide/flame';
	import IconPickaxe from '~icons/lucide/pickaxe';
	import IconPlane from '~icons/lucide/plane';
	import IconPlay from '~icons/lucide/play';
	import IconPlus from '~icons/lucide/plus';
	import IconRadar from '~icons/lucide/radar';
	import IconTrash from '~icons/lucide/trash-2';
	import IconWrench from '~icons/lucide/wrench';
	import IconX from '~icons/lucide/x';

	let { game }: { game: DroneworksGame } = $props();

	let field: HTMLDivElement | undefined = $state();
	let selected = $state<number | null>(null);

	const icons: Record<BuildingId, Component> = {
		mine: IconPickaxe,
		smelter: IconFlame,
		chipfab: IconCpu,
		engine: IconCog,
		airframe: IconPlane,
		assembly: IconFactory,
		flak: IconRadar
	};

	const loop = createFixedLoop({
		update: (dtMs) => game.update(dtMs),
		render: () => {}
	});

	onMount(() => {
		const stopHidden = onAppHidden(() => game.pause());
		return () => {
			loop.pause();
			stopHidden();
		};
	});

	$effect(() => {
		if (game.status === 'playing') loop.start();
		else loop.pause();
	});

	// A new shift starts with nothing selected
	$effect(() => {
		if (game.status === 'ready') selected = null;
	});

	// The hall jolts whenever a strike lands
	$effect(() => {
		const count = game.hitCount;
		if (count === 0 || !field || game.reducedMotion) return;
		field.animate(
			[
				{ transform: 'translate(0, 0)' },
				{ transform: 'translate(-5px, 2px)' },
				{ transform: 'translate(5px, -2px)' },
				{ transform: 'translate(0, 0)' }
			],
			{ duration: 240, easing: 'ease-out' }
		);
	});

	const building = $derived(selected === null ? null : game.slots[selected]);
	const timeClass = $derived(
		game.timeShare > 0.5
			? 'bg-[#6f8d4b]'
			: game.timeShare > 0.2
				? 'bg-explosion-yellow'
				: 'bg-tie-red'
	);

	function onKey(event: KeyboardEvent) {
		if (game.status === 'over' || event.ctrlKey || event.metaKey || event.altKey) return;
		const target = event.target;
		if (target instanceof HTMLElement && target.closest('input, select, textarea')) return;
		if (event.code === 'Escape') {
			if (selected !== null) selected = null;
			else if (game.status === 'playing') game.pause();
			return;
		}
		if (event.code === 'KeyP' && !event.repeat && !(target instanceof HTMLButtonElement)) {
			game.togglePause();
		}
	}

	function select(slot: number) {
		selected = selected === slot ? null : slot;
	}

	function canBuildHere(id: BuildingId): boolean {
		return selected !== null && game.canBuild(selected, id);
	}

	function buildHere(id: BuildingId) {
		if (selected !== null) game.build(selected, id);
	}

	function canRepairHere(): boolean {
		return selected !== null && game.canRepair(selected);
	}

	function repairCostHere(): number {
		return selected === null ? 0 : game.repairCost(selected);
	}

	function repairHere() {
		if (selected !== null) game.repair(selected);
	}

	function demolishHere() {
		if (selected === null) return;
		game.demolish(selected);
		selected = null;
	}
</script>

<svelte:window onkeydown={onKey} />

<div
	bind:this={field}
	data-playfield
	dir="ltr"
	class="relative flex w-full flex-1 flex-col gap-2 overflow-y-auto rounded-2xl border-3 border-ink bg-sand p-2 shadow-[4px_4px_0_var(--color-ink)] select-none sm:p-3"
>
	<!-- The contract: which drone, how many, how long -->
	<div
		class="flex flex-col gap-2 rounded-2xl border-3 border-ink bg-paper px-3 py-2 shadow-[3px_3px_0_var(--color-ink)]"
	>
		<div class="flex items-center justify-between gap-2">
			<p dir="auto" class="min-w-0 font-display text-base leading-tight font-bold">
				{m.droneworks_hud_contract({ n: game.contract + 1 })} ·
				<span class="text-tie-red">{droneName(game.drone)}</span>
			</p>
			<p
				dir="auto"
				class="shrink-0 rounded-xl border-3 border-ink bg-explosion-yellow px-2.5 py-0.5 font-display text-base font-bold tabular-nums"
				aria-label={m.droneworks_aria_time()}
			>
				{m.droneworks_hud_time({ seconds: game.timeLeftSeconds })}
			</p>
		</div>
		<p dir="auto" class="text-xs leading-tight font-semibold opacity-80">
			{droneRecipe(game.drone)}
		</p>
		<div class="flex items-center gap-2">
			<div
				class="h-3.5 min-w-0 flex-1 overflow-hidden rounded-full border-2 border-ink bg-sand"
				role="progressbar"
				aria-label={m.droneworks_aria_quota()}
				aria-valuemin="0"
				aria-valuemax="100"
				aria-valuenow={Math.round(game.quotaShare * 100)}
			>
				<div
					class="h-full w-full origin-left bg-[#6f8d4b]"
					style:transform="scaleX({game.quotaShare})"
				></div>
			</div>
			<p dir="auto" class="shrink-0 font-display text-sm font-bold tabular-nums">
				{m.droneworks_hud_quota({ done: game.delivered, quota: game.quota })}
			</p>
		</div>
		<div class="h-2 w-full overflow-hidden rounded-full border-2 border-ink bg-sand">
			<div
				class="h-full w-full origin-left {timeClass}"
				style:transform="scaleX({game.timeShare})"
			></div>
		</div>
	</div>

	<!-- The stock, and the budget that pays for buildings and repairs -->
	<div class="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
		<div
			class="flex flex-col items-center justify-center rounded-xl border-3 border-ink bg-explosion-yellow px-1 py-1"
		>
			<span class="flex items-center gap-1 font-display text-sm font-bold tabular-nums">
				<IconCoins class="size-4" aria-hidden="true" />
				{m.droneworks_credits({ value: Math.floor(game.credits) })}
			</span>
		</div>
		{#each RESOURCES as resource (resource)}
			<div class="flex flex-col items-center rounded-xl border-2 border-ink bg-paper px-1 py-1">
				<span
					dir="auto"
					class="max-w-full truncate text-[0.7rem] leading-tight font-bold opacity-70"
				>
					{resourceName(resource)}
				</span>
				<span class="font-display text-sm leading-tight font-bold tabular-nums">
					{displayAmount(game.stock[resource])}
				</span>
			</div>
		{/each}
	</div>

	<!-- Shop floor: twelve slots, four to a row -->
	<div class="grid grid-cols-4 gap-1.5 sm:gap-2" role="group">
		{#each game.slots as building, slot (slot)}
			{@const Icon = building ? icons[building.id] : IconPlus}
			<button
				type="button"
				class="relative flex aspect-square flex-col items-center justify-center gap-0.5 overflow-hidden rounded-xl border-2 border-ink px-1 py-1 text-center transition-colors {building
					? building.condition === 'destroyed'
						? 'bg-tie-red/30'
						: building.condition === 'damaged'
							? 'bg-explosion-yellow/40'
							: 'bg-paper'
					: 'border-dashed bg-paper/50'} {selected === slot ? 'ring-[3px] ring-ink' : ''}"
				class:opacity-60={building !== null && building.condition === 'destroyed'}
				aria-label={building
					? buildingName(building.id)
					: m.droneworks_slot_aria({ index: slot + 1 })}
				aria-pressed={selected === slot}
				onclick={() => select(slot)}
			>
				<Icon class="size-6 shrink-0 sm:size-7" aria-hidden="true" />
				{#if building}
					<span dir="auto" class="w-full truncate text-[0.7rem] leading-tight font-bold">
						{buildingName(building.id)}
					</span>
					{#if building.repairLeftMs > 0}
						<span
							class="absolute inset-x-1.5 bottom-1.5 h-1.5 overflow-hidden rounded-full bg-ink/15"
						>
							<span
								class="block h-full w-full origin-left bg-[#6f8d4b]"
								style:transform="scaleX({1 - building.repairLeftMs / building.repairTotalMs})"
							></span>
						</span>
					{:else if building.condition !== 'ok'}
						<span class="text-[0.7rem] leading-tight font-bold text-tie-red">
							{building.condition === 'destroyed'
								? m.droneworks_condition_destroyed()
								: m.droneworks_condition_damaged()}
						</span>
					{:else if building.slowLeftMs > 0}
						<span class="text-[0.7rem] leading-tight font-bold text-tie-red">
							{m.droneworks_slowed()}
						</span>
					{/if}
				{:else}
					<span class="text-[0.7rem] leading-tight font-semibold opacity-60">
						{m.droneworks_empty_slot()}
					</span>
				{/if}
			</button>
		{/each}
	</div>

	<!-- The selected slot: build menu on an empty one, repair and demolish on a building -->
	{#if selected !== null}
		<div
			class="rounded-2xl border-3 border-ink bg-paper px-3 py-2 shadow-[3px_3px_0_var(--color-ink)]"
		>
			<div class="flex items-start justify-between gap-2">
				<p dir="auto" class="font-display text-sm leading-tight font-bold">
					{building ? buildingName(building.id) : m.droneworks_build_title()}
				</p>
				<button
					type="button"
					class="shrink-0 rounded-lg border-2 border-ink bg-sand px-1.5 py-0.5"
					aria-label={m.droneworks_close()}
					onclick={() => (selected = null)}
				>
					<IconX class="size-3.5" aria-hidden="true" />
				</button>
			</div>

			{#if !building}
				<div class="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
					{#each BUILDING_IDS as id (id)}
						<button
							type="button"
							class="flex flex-col items-start gap-0.5 rounded-xl border-2 border-ink bg-sand px-2 py-1.5 text-left disabled:opacity-45"
							disabled={!canBuildHere(id)}
							onclick={() => buildHere(id)}
						>
							<span dir="auto" class="text-xs leading-tight font-bold">{buildingName(id)}</span>
							<span class="text-[0.7rem] leading-tight font-semibold opacity-70">
								{m.droneworks_build_cost({ cost: BUILDINGS[id].cost })}
							</span>
							<span dir="auto" class="text-[0.7rem] leading-tight opacity-70"
								>{buildingAbout(id)}</span
							>
						</button>
					{/each}
				</div>
			{:else}
				<p dir="auto" class="text-xs leading-snug font-semibold opacity-80">
					{buildingAbout(building.id)}
				</p>
				<div class="mt-1 flex flex-wrap gap-1.5">
					{#if building.condition !== 'ok'}
						{#if building.repairLeftMs > 0}
							<span
								class="rounded-xl border-2 border-ink bg-explosion-yellow/40 px-2 py-1 text-xs font-bold"
							>
								{m.droneworks_repairing({ seconds: Math.ceil(building.repairLeftMs / 1000) })}
							</span>
						{:else}
							<button
								type="button"
								class="btn-chunky gap-1 px-2.5 py-1 text-xs"
								disabled={!canRepairHere()}
								onclick={() => repairHere()}
							>
								<IconWrench class="size-3.5" aria-hidden="true" />
								{m.droneworks_repair_cost({ cost: repairCostHere() })}
							</button>
						{/if}
					{/if}
					<button
						type="button"
						class="btn-chunky gap-1 bg-tie-red px-2.5 py-1 text-xs text-paper"
						onclick={demolishHere}
					>
						<IconTrash class="size-3.5" aria-hidden="true" />
						{m.droneworks_demolish()}
					</button>
				</div>
			{/if}
		</div>
	{/if}

	{#if game.toast && game.status === 'playing'}
		{#key game.toast.id}
			<p
				dir="auto"
				class="notice pointer-events-none absolute inset-x-2 top-[42%] z-10 text-center font-display text-lg leading-tight font-bold text-paper [-webkit-text-stroke:5px_var(--color-ink)] [paint-order:stroke] sm:text-xl"
				aria-live="polite"
			>
				{game.toast.text}
			</p>
		{/key}
	{/if}

	{#key game.hitCount}
		{#if game.hitCount > 0 && game.status === 'playing'}
			<div class="hurt pointer-events-none absolute inset-0 z-10 border-8 border-tie-red"></div>
		{/if}
	{/key}

	{#if game.status === 'ready'}
		<div
			class="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-ink/35 p-4"
		>
			<div
				class="sticker pop-in flex w-full max-w-xs flex-col items-center gap-3 p-4 text-center"
				style:--tilt="-1.5deg"
			>
				<p dir="auto" class="text-sm leading-snug font-semibold">{m.droneworks_ready_hint()}</p>
				{#if game.best !== null}
					<p class="text-sm font-semibold">{m.droneworks_best({ score: game.best })}</p>
				{/if}
				<button type="button" class="btn-chunky bg-tie-red text-xl" onclick={() => game.start()}>
					<IconPlay class="size-5" aria-hidden="true" />
					{m.droneworks_start()}
				</button>
			</div>
		</div>
	{:else if game.status === 'paused'}
		<PauseOverlay onResume={() => game.resume()} />
	{/if}
</div>

<style>
	.notice {
		animation: notice 1300ms ease-out forwards;
	}

	.hurt {
		animation: hurt 420ms ease-out forwards;
	}

	@keyframes notice {
		0% {
			opacity: 0;
			transform: scale(0.7);
		}
		12% {
			opacity: 1;
			transform: scale(1.08);
		}
		20% {
			transform: scale(1);
		}
		75% {
			opacity: 1;
		}
		100% {
			opacity: 0;
			transform: translateY(-0.75rem);
		}
	}

	@keyframes hurt {
		from {
			opacity: 0.85;
		}
		to {
			opacity: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.notice {
			animation: none;
		}

		.hurt {
			animation-duration: 1ms;
		}
	}
</style>
