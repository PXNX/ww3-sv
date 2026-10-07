<!-- Level-won panel for Magyar's Birds: stars, score, bonus, next level, and sharing on a new best -->
<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import type { ScoreCard } from '$lib/services/share';
	import Confetti from './Confetti.svelte';
	import FuryStars from './FuryStars.svelte';
	import ShareButton from './ShareButton.svelte';
	import IconArrowRight from '~icons/lucide/arrow-right';
	import IconList from '~icons/lucide/list';

	let {
		open,
		score,
		stars,
		bonus,
		blocksDestroyed,
		blocksTotal,
		isNewBest,
		preparedCleared,
		modeName,
		drawBoard,
		onNext,
		onLevels
	}: {
		open: boolean;
		score: number;
		stars: number;
		bonus: number;
		blocksDestroyed: number;
		blocksTotal: number;
		isNewBest: boolean;
		/** The last prepared level was just won, so random levels follow */
		preparedCleared: boolean;
		modeName: string;
		drawBoard?: ScoreCard['drawBoard'];
		onNext: () => void;
		onLevels: () => void;
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
	aria-labelledby="fury-win-title"
	oncancel={(event) => event.preventDefault()}
>
	<div
		class="sticker relative modal-box flex max-h-[92dvh] flex-col items-center gap-3 overflow-y-auto border-3 border-ink p-5 text-center"
		style:--tilt="1deg"
	>
		{#if isNewBest}
			<Confetti />
		{/if}

		<h2 id="fury-win-title" class="text-3xl font-bold">{m.fury_win_title()}</h2>
		<FuryStars {stars} class="size-12" />

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

		<ul class="flex flex-col gap-0.5 text-sm font-semibold">
			<li>{m.fury_blocks_destroyed({ count: blocksDestroyed, total: blocksTotal })}</li>
			<li>{m.fury_bird_bonus({ points: bonus })}</li>
		</ul>

		{#if preparedCleared}
			<p class="font-semibold">{m.fury_all_cleared()}</p>
		{/if}

		<div class="flex flex-wrap items-center justify-center gap-3">
			<button type="button" class="btn-chunky bg-khaki text-lg" onclick={onNext}>
				{m.fury_next_level()}
				<IconArrowRight class="size-5 rtl:rotate-180" aria-hidden="true" />
			</button>
			<button type="button" class="btn-chunky" onclick={onLevels}>
				<IconList class="size-5" aria-hidden="true" />
				{m.fury_back_to_levels()}
			</button>
		</div>

		{#if isNewBest}
			<ShareButton {modeName} {score} {drawBoard} />
		{/if}
	</div>
</dialog>
