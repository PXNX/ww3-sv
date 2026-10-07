<!--
	Level-finished panel for Tanker Parking. There are no lives and no game over: this shows the
	stars, the moves against par, then offers the next level, the level list or another try.
-->
<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import type { ScoreCard } from '#lib/services/share.js';
	import Confetti from './Confetti.svelte';
	import ParkingStars from './ParkingStars.svelte';
	import ShareButton from './ShareButton.svelte';
	import IconArrowRight from '~icons/lucide/arrow-right';
	import IconList from '~icons/lucide/list';
	import IconRotate from '~icons/lucide/rotate-ccw';

	let {
		open,
		stars,
		moves,
		par,
		best,
		isNewBest,
		hasNext,
		totalStars,
		modeName,
		drawBoard,
		onNext,
		onRetry,
		onLevels
	}: {
		open: boolean;
		stars: number;
		moves: number;
		par: number;
		best: number | null;
		isNewBest: boolean;
		hasNext: boolean;
		/** All stars collected so far; this is the "score" on the share card */
		totalStars: number;
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
	aria-labelledby="parking-win-title"
	oncancel={(event) => event.preventDefault()}
>
	<div
		class="sticker relative modal-box flex max-h-[92dvh] flex-col items-center gap-3 overflow-y-auto border-3 border-ink p-5 text-center"
		style:--tilt="1deg"
	>
		{#if isNewBest}
			<Confetti />
		{/if}

		<h2 id="parking-win-title" class="text-3xl font-bold">{m.parking_win_title()}</h2>
		<ParkingStars {stars} class="size-12" />

		<dl class="grid w-full grid-cols-3 gap-2 text-center">
			<div class="rounded-lg border-2 border-ink bg-sand p-1">
				<dt class="text-xs font-bold">{m.parking_moves()}</dt>
				<dd class="font-display text-2xl font-bold text-tie-red tabular-nums">{moves}</dd>
			</div>
			<div class="rounded-lg border-2 border-ink bg-sand p-1">
				<dt class="text-xs font-bold">{m.parking_par()}</dt>
				<dd class="font-display text-2xl font-bold tabular-nums">{par}</dd>
			</div>
			<div class="rounded-lg border-2 border-ink bg-sand p-1">
				<dt class="text-xs font-bold">{m.parking_best()}</dt>
				<dd class="font-display text-2xl font-bold tabular-nums">{best ?? moves}</dd>
			</div>
		</dl>

		{#if isNewBest}
			<span
				class="pop-in rotate-2 rounded-md border-2 border-ink bg-explosion-yellow px-2 font-bold"
			>
				{m.parking_new_best()}
			</span>
		{/if}

		{#if !hasNext}
			<p class="font-semibold">{m.parking_all_cleared()}</p>
		{/if}

		<div class="flex flex-wrap items-center justify-center gap-3">
			{#if hasNext}
				<button type="button" class="btn-chunky bg-khaki text-lg" onclick={onNext}>
					{m.parking_next_level()}
					<IconArrowRight class="size-5 rtl:rotate-180" aria-hidden="true" />
				</button>
			{/if}
			<button type="button" class="btn-chunky" onclick={onRetry}>
				<IconRotate class="size-5" aria-hidden="true" />
				{m.parking_play_again()}
			</button>
			<button type="button" class="btn-chunky" onclick={onLevels}>
				<IconList class="size-5" aria-hidden="true" />
				{m.parking_back_to_levels()}
			</button>
		</div>

		{#if isNewBest}
			<ShareButton {modeName} score={totalStars} {drawBoard} />
		{/if}
	</div>
</dialog>
