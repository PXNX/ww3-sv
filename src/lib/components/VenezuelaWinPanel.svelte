<!-- Level-won panel for El Presidente: stars, score, what was collected, next level, and sharing on a new best -->
<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import type { ScoreCard } from '#lib/services/share.js';
	import Confetti from './Confetti.svelte';
	import ShareButton from './ShareButton.svelte';
	import VenezuelaStars from './VenezuelaStars.svelte';
	import IconArrowRight from '~icons/lucide/arrow-right';
	import IconList from '~icons/lucide/list';
	import IconRotate from '~icons/lucide/rotate-ccw';

	let {
		open,
		score,
		stars,
		barrels,
		barrelsTotal,
		hearts,
		goons,
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
		barrels: number;
		barrelsTotal: number;
		hearts: number;
		goons: number;
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
	aria-labelledby="venezuela-win-title"
	oncancel={(event) => event.preventDefault()}
>
	<div
		class="sticker relative modal-box flex max-h-[92dvh] flex-col items-center gap-3 overflow-y-auto border-3 border-ink p-5 text-center"
		style:--tilt="1deg"
	>
		{#if isNewBest}
			<Confetti />
		{/if}

		<h2 id="venezuela-win-title" class="text-3xl font-bold">{m.venezuela_win_title()}</h2>
		<VenezuelaStars {stars} class="size-12" />

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
			<li>{m.venezuela_win_barrels({ count: barrels, total: barrelsTotal })}</li>
			<li>{m.venezuela_win_goons({ count: goons })}</li>
			<li>{m.venezuela_win_hearts({ count: hearts })}</li>
		</ul>

		{#if !hasNext}
			<p class="font-semibold">{m.venezuela_all_cleared()}</p>
		{/if}

		<div class="flex flex-wrap items-center justify-center gap-3">
			{#if hasNext}
				<button type="button" class="btn-chunky bg-khaki text-lg" onclick={onNext}>
					{m.venezuela_next_level()}
					<IconArrowRight class="size-5 rtl:rotate-180" aria-hidden="true" />
				</button>
			{/if}
			<button type="button" class="btn-chunky" onclick={onRetry}>
				<IconRotate class="size-5" aria-hidden="true" />
				{m.venezuela_restart()}
			</button>
			<button type="button" class="btn-chunky" onclick={onLevels}>
				<IconList class="size-5" aria-hidden="true" />
				{m.venezuela_back_to_levels()}
			</button>
		</div>

		{#if isNewBest}
			<ShareButton {modeName} {score} {drawBoard} />
		{/if}
	</div>
</dialog>
