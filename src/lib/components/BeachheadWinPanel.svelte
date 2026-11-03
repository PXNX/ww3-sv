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
	import type { ScoreCard } from '#lib/services/share.js';
	import Confetti from './Confetti.svelte';
	import ShareButton from './ShareButton.svelte';
	import IconArrowRight from '~icons/lucide/arrow-right';
	import IconMap from '~icons/lucide/map';
	import IconTrophy from '~icons/lucide/trophy';

	let {
		open,
		score,
		loot,
		lost,
		islandName,
		newAchievements,
		isNewBest,
		hasNext,
		modeName,
		drawBoard,
		onNext,
		onIslands
	}: {
		open: boolean;
		score: number;
		/** Resources won in this battle */
		loot: Resources;
		/** Troops the attack killed, by kind */
		lost: Partial<Record<TroopKind, number>>;
		islandName: string;
		/** Achievements unlocked by this victory */
		newAchievements: string[];
		isNewBest: boolean;
		/** Another island follows this one */
		hasNext: boolean;
		modeName: string;
		drawBoard?: ScoreCard['drawBoard'];
		onNext: () => void;
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
		{#if isNewBest}
			<Confetti />
		{/if}

		<div>
			<h2 id="beachhead-win-title" class="text-3xl font-bold">{m.beachhead_win_title()}</h2>
			<p class="text-sm font-semibold">{islandName}</p>
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

		<p class="font-display text-lg font-bold tabular-nums" title={m.gameover_final_score()}>
			{score}
			{#if isNewBest}
				<span class="rotate-2 rounded-md border-2 border-ink bg-explosion-yellow px-1.5 text-sm">
					{m.gameover_new_best()}
				</span>
			{/if}
		</p>

		<div class="flex flex-wrap items-center justify-center gap-3">
			{#if hasNext}
				<button
					type="button"
					class="btn-chunky flex items-center gap-2 bg-khaki text-lg"
					aria-label={m.beachhead_next_island()}
					title={m.beachhead_next_island()}
					onclick={onNext}
				>
					<IconArrowRight class="size-6 rtl:rotate-180" aria-hidden="true" />
				</button>
			{/if}
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

		{#if isNewBest}
			<ShareButton {modeName} {score} {drawBoard} />
		{/if}
	</div>
</dialog>
