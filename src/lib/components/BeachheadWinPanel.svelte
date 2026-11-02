<!-- Island-taken panel for Beachhead: stars, score, survivors, next island, and sharing on a new best -->
<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { achievementName } from '#lib/components/beachheadText.js';
	import type { Resources } from '#lib/game/beachhead/campaign.js';
	import type { ScoreCard } from '#lib/services/share.js';
	import BeachheadStars from './BeachheadStars.svelte';
	import Confetti from './Confetti.svelte';
	import ShareButton from './ShareButton.svelte';
	import IconArrowRight from '~icons/lucide/arrow-right';
	import IconList from '~icons/lucide/list';
	import IconRotate from '~icons/lucide/rotate-ccw';

	let {
		open,
		score,
		stars,
		alive,
		deployed,
		loot,
		islandName,
		islandIncome,
		newAchievements,
		isNewBest,
		hasNext,
		modeName,
		drawBoard,
		onNext,
		onRetry,
		onIslands
	}: {
		open: boolean;
		score: number;
		stars: number;
		/** Troops still standing when the headquarters fell */
		alive: number;
		/** Troops landed during the attack */
		deployed: number;
		/** Resources won in this battle */
		loot: Resources;
		/** The island just taken, for the control message */
		islandName: string;
		/** What the island adds to the production per minute */
		islandIncome: Resources;
		/** Achievements unlocked by this victory */
		newAchievements: string[];
		isNewBest: boolean;
		/** Another island follows this one */
		hasNext: boolean;
		modeName: string;
		drawBoard?: ScoreCard['drawBoard'];
		onNext: () => void;
		onRetry: () => void;
		onIslands: () => void;
	} = $props();

	let dialog: HTMLDialogElement | undefined = $state();

	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		else if (!open && dialog.open) dialog.close();
	});
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

		<h2 id="beachhead-win-title" class="text-3xl font-bold">{m.beachhead_win_title()}</h2>
		<BeachheadStars {stars} class="size-12" />

		<div class="flex flex-col items-center">
			<span class="text-sm font-bold uppercase">{m.gameover_final_score()}</span>
			<span class="pop-in font-display text-5xl font-bold text-tie-red tabular-nums">{score}</span>
			{#if isNewBest}
				<span
					class="pop-in mt-1 rotate-2 rounded-md border-2 border-ink bg-explosion-yellow px-2 font-bold"
				>
					{m.gameover_new_best()}
				</span>
			{/if}
		</div>

		<p class="font-semibold">
			{m.beachhead_win_control({ island: islandName })}
		</p>
		<p class="flex flex-wrap items-center justify-center gap-2 text-sm font-bold">
			<span class="rounded-md border-2 border-ink bg-paper px-2 py-0.5">
				{m.beachhead_win_troops({ alive, total: deployed })}
			</span>
			<span class="rounded-md border-2 border-ink bg-explosion-yellow px-2 py-0.5">
				{m.beachhead_victory_loot(loot)}
			</span>
		</p>
		<p class="text-sm font-semibold">
			{m.beachhead_island_tax(islandIncome)}
		</p>
		{#if newAchievements.length > 0}
			<p class="rounded-md border-2 border-ink bg-explosion-yellow px-2 py-1 text-sm font-bold">
				{m.beachhead_win_achievements({
					names: newAchievements.map((id) => achievementName(id)).join(', ')
				})}
			</p>
		{/if}

		{#if !hasNext}
			<p class="font-semibold">{m.beachhead_all_cleared()}</p>
		{/if}

		<div class="flex flex-wrap items-center justify-center gap-3">
			{#if hasNext}
				<button type="button" class="btn-chunky bg-khaki text-lg" onclick={onNext}>
					{m.beachhead_next_island()}
					<IconArrowRight class="size-5 rtl:rotate-180" aria-hidden="true" />
				</button>
			{/if}
			<button type="button" class="btn-chunky" onclick={onRetry}>
				<IconRotate class="size-5" aria-hidden="true" />
				{m.beachhead_retry()}
			</button>
			<button type="button" class="btn-chunky" onclick={onIslands}>
				<IconList class="size-5" aria-hidden="true" />
				{m.beachhead_to_map()}
			</button>
		</div>

		{#if isNewBest}
			<ShareButton {modeName} {score} {drawBoard} />
		{/if}
	</div>
</dialog>
