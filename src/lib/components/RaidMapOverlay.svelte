<!--
	Map overlay: just the big battlefield with legend, opened from the minimap.
	Has a nice view transition and a back button that returns to the fight.
-->
<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { MINIMAP_MARKS, type MinimapMark } from '#lib/game/raid/render.js';
	import type { RaidGame } from '#lib/stores/raidGame.svelte.js';
	import RaidMinimap from './RaidMinimap.svelte';
	import { formatTime, MAP_NAMES } from './raidText';
	import IconX from '~icons/lucide/x';

	let { game, onResume }: { game: RaidGame; onResume: () => void } = $props();

	const raid = untrack(() => game.state);

	let size = $state<{ width: number; height: number } | null>(null);
	onMount(() => {
		const room = { width: Math.min(420, window.innerWidth * 0.45), height: window.innerHeight - 200 };
		const scale = Math.min(room.width / raid.map.width, room.height / raid.map.height);
		size = { width: Math.round(raid.map.width * scale), height: Math.round(raid.map.height * scale) };
	});

	const SHAPES: Record<string, string> = {
		circle: 'M5 1a4 4 0 1 0 0 8a4 4 0 1 0 0-8z',
		ring: 'M5 1a4 4 0 1 0 0 8a4 4 0 1 0 0-8z',
		diamond: 'M5 0.5L9.5 5L5 9.5L0.5 5z',
		triangle: 'M5 1L9.5 8.6H0.5z',
		square: 'M1.5 1.5h7v7h-7z'
	};

	const LEGEND: { mark: MinimapMark; label: () => string }[] = [
		{ mark: 'boss', label: m.raid_map_boss },
		{ mark: 'fighter', label: m.raid_map_fighters },
		{ mark: 'shooter', label: m.raid_map_shooters },
		{ mark: 'drone', label: m.raid_map_drones },
		{ mark: 'support', label: m.raid_map_support },
		{ mark: 'friend', label: m.raid_map_friends },
		{ mark: 'loot', label: m.raid_map_loot }
	];
</script>

<div
	class="pop-in fixed inset-0 z-50 flex flex-col gap-3 overflow-y-auto bg-[radial-gradient(ellipse_at_40%_55%,#5f93ec,#2f58b8_55%,#1f3c8a)] pt-[calc(0.75rem+var(--top-inset))] pr-(--hud-right) pb-[calc(0.75rem+env(safe-area-inset-bottom))] pl-(--hud-left) text-white"
	role="dialog"
	aria-modal="true"
>
	<button
		type="button"
		class="absolute top-[calc(0.5rem+var(--top-inset))] right-(--hud-right) flex size-12 -skew-x-6 items-center justify-center rounded-md bg-[#d9f3ff] text-[#7a2fd0] shadow-[0_3px_0_rgb(0_0_0/0.25)] active:scale-95 transition-transform"
		aria-label={m.raid_leave_resume()}
		title={m.raid_leave_resume()}
		onclick={onResume}
	>
		<IconX class="size-8 stroke-[3.5]" aria-hidden="true" />
	</button>

	<div class="flex flex-col gap-1 pe-16">
		<h2 dir="auto" class="font-display text-2xl leading-none font-black uppercase italic drop-shadow-[0_2px_0_rgb(0_0_0/0.3)]">{MAP_NAMES[raid.mapId]()}</h2>
	</div>

	<div class="grid flex-1 gap-4 sm:grid-cols-[auto_minmax(0,1fr)]">
		<div class="flex items-start justify-center">
			{#if size}
				<div class="rounded-2xl bg-[#1d2f78]/50 p-1.5 shadow-[inset_0_0_0_2px_rgb(255_255_255/0.15)]">
					<RaidMinimap raid={() => raid} width={size.width} height={size.height} markScale={1.6} label={m.raid_hud_minimap()} class="rounded-lg" />
				</div>
			{/if}
		</div>

		<div class="flex min-w-0 flex-col gap-2">
			<ul class="grid grid-cols-2 gap-x-4 gap-y-0.5 font-display text-xs font-bold uppercase">
				<li class="flex items-center gap-2">
					<svg viewBox="0 0 16 16" class="size-3.5"><path d="M8 1L14 15L8 11L2 15z" fill="#fff" stroke="#111" stroke-width="1.5" /></svg>
					{m.raid_map_you()}
				</li>
				{#each LEGEND as entry (entry.mark)}
					{@const mark = MINIMAP_MARKS[entry.mark]}
					<li class="flex items-center gap-2">
						<svg viewBox="0 0 10 10" class="size-3.5">
							<path d={SHAPES[mark.shape]} fill={mark.shape === 'ring' ? 'none' : mark.color} stroke={mark.shape === 'ring' ? mark.color : 'none'} stroke-width="2" />
						</svg>
						{entry.label()}
					</li>
				{/each}
			</ul>
		</div>
	</div>
</div>

<style>
	.pop-in {
		animation: pop-in 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
	}
	@keyframes pop-in {
		from { opacity: 0; transform: scale(0.96); }
		to { opacity: 1; transform: scale(1); }
	}
</style>
