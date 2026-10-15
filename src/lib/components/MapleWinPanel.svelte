<!-- Level-won panel for Maple Reserve Heist: stars, score, what was delivered, next level, and sharing on a new best -->
<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import type { ScoreCard } from '#lib/services/share.js';
	import Confetti from './Confetti.svelte';
	import MaplePancakes from './MaplePancakes.svelte';
	import MapleStars from './MapleStars.svelte';
	import ShareButton from './ShareButton.svelte';
	import IconArrowRight from '~icons/lucide/arrow-right';
	import IconList from '~icons/lucide/list';
	import IconRotate from '~icons/lucide/rotate-ccw';

	let {
		open,
		score,
		stars,
		moves,
		par,
		delivered,
		totalBarrels,
		spotted,
		isNewBest,
		hasNext,
		modeName,
		drawBoard,
		onNext,
		onRetry,
		onLevels
	}: {
		open: boolean;
		score: number;
		stars: number;
		/** Moves the run took, and the par of the level */
		moves: number;
		par: number;
		/** Barrels delivered (one pancake each) out of all barrels on the level, and the times spotted */
		delivered: number;
		totalBarrels: number;
		spotted: number;
		isNewBest: boolean;
		/** Another level follows this one */
		hasNext: boolean;
		modeName: string;
		drawBoard?: ScoreCard['drawBoard'];
		onNext: () => void;
		onRetry: () => void;
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
	aria-labelledby="maple-win-title"
	oncancel={(event) => event.preventDefault()}
>
	<div
		class="sticker relative modal-box flex max-h-[92dvh] flex-col items-center gap-3 overflow-y-auto border-3 border-ink p-5 text-center"
		style:--tilt="1deg"
	>
		{#if isNewBest}
			<Confetti />
		{/if}

		<h2 id="maple-win-title" class="text-3xl font-bold">{m.maple_win_title()}</h2>
		<MapleStars {stars} class="size-12" />

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

		<MaplePancakes count={delivered} />

		<!-- One line per star, so the stars are explained and not only counted -->
		<ul class="flex flex-col gap-0.5 text-sm font-semibold">
			<li>{m.maple_win_barrels({ delivered, total: totalBarrels })}</li>
			<li>{m.maple_win_moves({ moves, par })}</li>
			<li>{m.maple_win_spotted({ count: spotted })}</li>
		</ul>

		{#if !hasNext}
			<p class="font-semibold">{m.maple_all_cleared()}</p>
		{/if}

		<div class="flex flex-wrap items-center justify-center gap-3">
			{#if hasNext}
				<button type="button" class="btn-chunky bg-khaki text-lg" onclick={onNext}>
					{m.maple_next_level()}
					<IconArrowRight class="size-5 rtl:rotate-180" aria-hidden="true" />
				</button>
			{/if}
			<button type="button" class="btn-chunky" onclick={onRetry}>
				<IconRotate class="size-5" aria-hidden="true" />
				{m.maple_restart()}
			</button>
			<button type="button" class="btn-chunky" onclick={onLevels}>
				<IconList class="size-5" aria-hidden="true" />
				{m.maple_back_to_levels()}
			</button>
		</div>

		{#if isNewBest}
			<ShareButton {modeName} {score} {drawBoard} />
		{/if}
	</div>
</dialog>
