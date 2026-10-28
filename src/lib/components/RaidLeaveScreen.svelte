<!--
	The leave screen, opened from the exit button (and whenever the raid pauses): the battlefield
	as a big map with a legend of what its markers mean, everything collected so far, how far this
	raid has taken today's quests, and in the bottom right the button that confirms leaving the
	battle. The cross in the top right goes back to the fight.
-->
<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { MINIMAP_MARKS, type MarkShape, type MinimapMark } from '#lib/game/raid/render.js';
	import type { RaidGame } from '#lib/stores/raidGame.svelte.js';
	import RaidMinimap from './RaidMinimap.svelte';
	import RaidQuestCard from './RaidQuestCard.svelte';
	import { formatTime, MAP_NAMES } from './raidText';
	import IconCoins from '~icons/lucide/coins';
	import IconGem from '~icons/lucide/gem';
	import IconPackage from '~icons/lucide/package';
	import IconSkull from '~icons/lucide/skull';
	import IconSparkles from '~icons/lucide/sparkles';
	import IconWrench from '~icons/lucide/wrench';
	import IconX from '~icons/lucide/x';
	import IconZap from '~icons/lucide/zap';

	let { game, onResume, onLeave }: { game: RaidGame; onResume: () => void; onLeave: () => void } =
		$props();

	// The raid stands still while this screen is open, so one look at it is enough
	const raid = untrack(() => game.state);
	const haul = [
		{ icon: IconSparkles, label: 'XP', value: Math.floor(raid.xp), color: 'text-[#7fd3ff]' },
		{ icon: IconCoins, label: m.raid_stat_gold(), value: raid.gold, color: 'text-[#ffd23a]' },
		{ icon: IconWrench, label: m.raid_result_scrap(), value: raid.scrap, color: 'text-[#c9ced4]' },
		{ icon: IconSkull, label: m.raid_stat_kills(), value: raid.kills, color: 'text-[#ff8a8a]' },
		{
			icon: IconGem,
			label: m.raid_result_crystals(),
			value: raid.crystals.length,
			color: 'text-[#c79bff]'
		},
		{ icon: IconPackage, label: m.raid_result_loot(), value: raid.haul.length, color: 'text-white' }
	];
	const { before, after: quests } = untrack(() => game.liveQuests());

	const LEGEND: { mark: MinimapMark; label: () => string }[] = [
		{ mark: 'boss', label: m.raid_map_boss },
		{ mark: 'fighter', label: m.raid_map_fighters },
		{ mark: 'shooter', label: m.raid_map_shooters },
		{ mark: 'drone', label: m.raid_map_drones },
		{ mark: 'support', label: m.raid_map_support },
		{ mark: 'friend', label: m.raid_map_friends },
		{ mark: 'loot', label: m.raid_map_loot }
	];

	/** The map as big as the screen allows, in the battlefield's own proportions */
	let size = $state<{ width: number; height: number } | null>(null);
	onMount(() => {
		const room = {
			width: Math.min(420, window.innerWidth * 0.45),
			height: window.innerHeight - 200
		};
		const scale = Math.min(room.width / raid.map.width, room.height / raid.map.height);
		size = {
			width: Math.round(raid.map.width * scale),
			height: Math.round(raid.map.height * scale)
		};
	});

	const SHAPES: Record<MarkShape, string> = {
		circle: 'M5 1a4 4 0 1 0 0 8a4 4 0 1 0 0-8z',
		ring: 'M5 1a4 4 0 1 0 0 8a4 4 0 1 0 0-8z',
		diamond: 'M5 0.5L9.5 5L5 9.5L0.5 5z',
		triangle: 'M5 1L9.5 8.6H0.5z',
		square: 'M1.5 1.5h7v7h-7z'
	};
</script>

<div
	class="fixed inset-0 z-50 flex flex-col gap-3 overflow-y-auto bg-[radial-gradient(ellipse_at_40%_55%,#5f93ec,#2f58b8_55%,#1f3c8a)] pt-[calc(0.75rem+var(--top-inset))] pr-(--hud-right) pb-[calc(0.75rem+env(safe-area-inset-bottom))] pl-(--hud-left) text-white"
	role="dialog"
	aria-modal="true"
	aria-labelledby="raid-leave-title"
>
	<button
		type="button"
		class="absolute top-[calc(0.5rem+var(--top-inset))] right-(--hud-right) flex size-12 -skew-x-6 items-center justify-center rounded-md bg-[#d9f3ff] text-[#7a2fd0] shadow-[0_3px_0_rgb(0_0_0/0.25)] active:scale-95"
		aria-label={m.raid_leave_resume()}
		title={m.raid_leave_resume()}
		onclick={onResume}
	>
		<IconX class="size-8 stroke-[3.5]" aria-hidden="true" />
	</button>

	<!-- Collected so far, and today's quests counting this raid -->
	<div class="flex flex-col gap-1 pe-16">
		<span class="font-display text-xs font-bold tracking-wide uppercase opacity-80"
			>{m.raid_leave_haul()} · {formatTime(raid.timeMs)}</span
		>
		<dl class="flex flex-wrap gap-1.5 font-display font-bold">
			{#each haul as entry (entry.label)}
				<div
					class="flex items-center gap-1 rounded-lg bg-[#16245a]/60 px-2 py-0.5"
					title={entry.label}
				>
					<dt>
						<entry.icon class="size-4 {entry.color}" aria-hidden="true" /><span class="sr-only"
							>{entry.label}</span
						>
					</dt>
					<dd class="tabular-nums">{entry.value}</dd>
				</div>
			{/each}
		</dl>
	</div>
	<section class="flex flex-col gap-1.5" aria-labelledby="raid-leave-quests">
		<h3
			id="raid-leave-quests"
			class="font-display text-sm leading-none font-black uppercase italic"
		>
			{m.raid_quests_title()}
		</h3>
		<div class="grid gap-2 ps-2 pt-1 sm:grid-cols-3">
			{#each quests as quest, index (index)}
				<RaidQuestCard {quest} before={before[index]?.progress ?? 0} compact />
			{/each}
		</div>
	</section>

	<div class="flex min-w-0 flex-col gap-2">
		<h2
				id="raid-leave-title"
				dir="auto"
				class="font-display text-2xl leading-none font-black uppercase italic drop-shadow-[0_2px_0_rgb(0_0_0/0.3)]"
			>
				{MAP_NAMES[raid.mapId]()}
			</h2>
			<ul class="grid grid-cols-2 gap-x-4 gap-y-0.5 font-display text-xs font-bold uppercase">
				<li class="flex items-center gap-2">
					<svg viewBox="0 0 16 16" class="size-3.5" aria-hidden="true"
						><path d="M8 1L14 15L8 11L2 15z" fill="#fff" stroke="#111" stroke-width="1.5" /></svg
					>
					{m.raid_map_you()}
				</li>
				{#each LEGEND as entry (entry.mark)}
					{@const mark = MINIMAP_MARKS[entry.mark]}
					<li class="flex items-center gap-2">
						<svg viewBox="0 0 10 10" class="size-3.5" aria-hidden="true">
							<path
								d={SHAPES[mark.shape]}
								fill={mark.shape === 'ring' ? 'none' : mark.color}
								stroke={mark.shape === 'ring' ? mark.color : 'none'}
								stroke-width="2"
							/>
						</svg>
						{entry.label()}
					</li>
				{/each}
			</ul>

			<!-- Confirms leaving, in the bottom right -->
			<div class="mt-auto flex flex-col items-end gap-1 pt-2">
				<p dir="auto" class="text-end text-xs font-semibold opacity-85">{m.raid_leave_note()}</p>
				<button
					type="button"
					class="me-1 flex -skew-x-6 items-center gap-2 rounded-lg border-b-4 border-[#b84300] bg-linear-to-b from-[#ff9a3c] to-[#ff6a10] px-5 py-2.5 font-display text-xl leading-none font-black text-white uppercase italic shadow-[0_4px_0_rgb(0_0_0/0.25)] active:translate-y-0.5"
					onclick={onLeave}
				>
					<IconZap class="size-6 fill-white" aria-hidden="true" />
					{m.raid_leave_confirm()}
				</button>
			</div>
		</div>
	</div>
</div>
