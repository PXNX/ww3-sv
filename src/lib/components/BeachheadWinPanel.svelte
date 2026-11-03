<!--
	Victory panel in the manner of a mobile base raid: a big title, the loot as four icons with
	numbers, the troops that fell as red icons, new trophies and two round buttons. No stars, no
	paragraphs.
-->
<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { achievementName, troopName } from '#lib/components/beachheadText.js';
	import { TROOP_ICONS } from '#lib/components/beachheadIcons.js';
	import ResourceIcon from '#lib/components/ResourceIcon.svelte';
	import type { Resources } from '#lib/game/beachhead/campaign.js';
	import type { TroopKind } from '#lib/game/beachhead/config.js';
	import type { CrystalType } from '#lib/game/beachhead/crystals.js';
	import CrystalIcon from '#lib/components/CrystalIcon.svelte';
	import { crystalName } from '#lib/components/beachheadText.js';
	import Confetti from './Confetti.svelte';
	import IconTimer from '~icons/lucide/timer';
	import IconGem from '~icons/lucide/gem';
	import IconMap from '~icons/lucide/map';
	import IconTrophy from '~icons/lucide/trophy';

	let {
		open,
		loot,
		lost,
		shards,
		crystal,
		seconds,
		islandName,
		newAchievements,
		onIslands
	}: {
		open: boolean;
		/** Resources won in this battle */
		loot: Resources;
		/** Troops the attack killed, by kind */
		lost: Partial<Record<TroopKind, number>>;
		/** Hero shards this victory dropped */
		shards: number;
		/** The crystal this victory dropped, if any */
		crystal: { type: CrystalType; count: number } | null;
		/** How long the attack took */
		seconds: number;
		islandName: string;
		/** Achievements unlocked by this victory */
		newAchievements: string[];
		onIslands: () => void;
	} = $props();

	let dialog: HTMLDialogElement | undefined = $state();

	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		else if (!open && dialog.open) dialog.close();
	});

	const RESOURCE_KINDS = ['wood', 'stone', 'iron', 'gold'] as const;
	const fallen = $derived(
		(Object.entries(lost) as [TroopKind, number][]).filter(([, count]) => count > 0)
	);
</script>

<dialog
	bind:this={dialog}
	class="modal modal-bottom sm:modal-middle"
	aria-labelledby="beachhead-win-title"
	oncancel={(event) => event.preventDefault()}
>
	<div
		class="sticker relative modal-box flex max-h-[92dvh] flex-col items-center gap-3 overflow-y-auto border-3 border-ink p-5 text-center"
		style:--tilt="1deg"
	>
		<Confetti />

		<div
			class="sunburst -mx-5 -mt-5 flex w-[calc(100%+2.5rem)] flex-col items-center gap-1 px-5 pt-5 pb-3"
		>
			<h2
				id="beachhead-win-title"
				class="victory-ribbon -rotate-2 rounded-[10px] border-3 border-ink bg-tie-red px-6 py-1 text-4xl font-bold tracking-wide text-paper uppercase shadow-[3px_3px_0_var(--color-ink)]"
			>
				{m.beachhead_win_title()}
			</h2>
			<p class="font-display text-sm font-bold">{islandName}</p>
			<p
				class="flex items-center gap-1.5 rounded-full border-2 border-ink bg-paper px-3 py-0.5 font-display text-lg font-bold tabular-nums"
				title={m.beachhead_win_time()}
			>
				<IconTimer class="size-5" aria-hidden="true" />
				{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
			</p>
		</div>

		<ul class="flex flex-wrap justify-center gap-2" aria-label={m.beachhead_loot_title()}>
			{#each RESOURCE_KINDS as resource (resource)}
				<li
					class="pop-in flex items-center gap-1.5 rounded-full border-3 border-ink bg-paper py-1 ps-1.5 pe-3 font-display text-xl font-bold tabular-nums shadow-[2px_2px_0_var(--color-ink)]"
				>
					<ResourceIcon kind={resource} class="size-8" />
					+{loot[resource]}
				</li>
			{/each}
		</ul>

		{#if shards > 0}
			<p
				class="pop-in flex items-center gap-1.5 rounded-full border-3 border-ink bg-[#b48cf0] py-1 ps-1.5 pe-3 font-display text-xl font-bold tabular-nums shadow-[2px_2px_0_var(--color-ink)]"
				title={m.beachhead_hero_cards({ cards: shards })}
			>
				<IconGem class="size-8" aria-hidden="true" />
				+{shards}
			</p>
		{/if}

		{#if crystal}
			<p
				class="pop-in flex items-center gap-1.5 rounded-full border-3 border-ink bg-paper py-1 ps-1.5 pe-3 font-display text-xl font-bold tabular-nums shadow-[2px_2px_0_var(--color-ink)]"
				title={`${m.beachhead_crystals_found()}: ${crystalName(crystal.type)}`}
			>
				<CrystalIcon type={crystal.type} class="size-8" />
				+{crystal.count}
			</p>
		{/if}

		{#if fallen.length > 0}
			<ul class="flex flex-wrap justify-center gap-1.5" aria-label={m.beachhead_lost_troops()}>
				{#each fallen as [kind, count] (kind)}
					{@const TroopIcon = TROOP_ICONS[kind]}
					<li
						class="flex items-center gap-1 rounded-full border-2 border-ink bg-tie-red px-2 py-0.5 font-display text-sm font-bold text-paper tabular-nums"
						title={troopName(kind)}
					>
						<TroopIcon class="size-4" aria-hidden="true" />
						−{count}
					</li>
				{/each}
			</ul>
		{/if}

		{#if newAchievements.length > 0}
			<p
				class="flex items-center gap-1 rounded-md border-2 border-ink bg-explosion-yellow px-2 py-1 text-sm font-bold"
			>
				<IconTrophy class="size-4" aria-hidden="true" />
				{newAchievements.map((id) => achievementName(id)).join(', ')}
			</p>
		{/if}

		<div class="flex flex-wrap items-center justify-center gap-3">
			<button
				type="button"
				class="btn-chunky flex items-center gap-2 text-lg"
				aria-label={m.beachhead_to_map()}
				title={m.beachhead_to_map()}
				onclick={onIslands}
			>
				<IconMap class="size-6" aria-hidden="true" />
			</button>
		</div>
	</div>
</dialog>

<style>
	.sunburst {
		background: repeating-conic-gradient(
			from 0deg at 50% 100%,
			color-mix(in srgb, var(--color-explosion-yellow) 38%, transparent) 0deg 9deg,
			transparent 9deg 18deg
		);
	}

	.victory-ribbon {
		animation: ribbon-in 420ms cubic-bezier(0.2, 1.4, 0.4, 1);
	}

	@keyframes ribbon-in {
		from {
			transform: rotate(-2deg) scale(0.4);
			opacity: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.victory-ribbon {
			animation: none;
		}
	}
</style>
