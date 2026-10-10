<!--
	Finished-run panel for the Bureaucracy Maze. There are no lives and no game over: this shows
	the stars, the steps against the shortest way and the best, then offers a new maze, the same
	maze again or the size picker.
-->
<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import type { ScoreCard } from '#lib/services/share.js';
	import Confetti from './Confetti.svelte';
	import MazeItemIcon from './MazeItemIcon.svelte';
	import MazeStars from './MazeStars.svelte';
	import ShareButton from './ShareButton.svelte';
	import IconList from '~icons/lucide/list';
	import IconRotate from '~icons/lucide/rotate-ccw';
	import IconShuffle from '~icons/lucide/shuffle';

	let {
		open,
		stars,
		steps,
		par,
		best,
		isNewBest,
		modeName,
		drawBoard,
		onNew,
		onRetry,
		onSizes
	}: {
		open: boolean;
		stars: number;
		steps: number;
		/** Steps of the shortest way */
		par: number;
		best: number | null;
		isNewBest: boolean;
		modeName: string;
		drawBoard?: ScoreCard['drawBoard'];
		onNew: () => void;
		onRetry: () => void;
		onSizes: () => void;
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
	aria-labelledby="maze-win-title"
	oncancel={(event) => event.preventDefault()}
>
	<div
		class="sticker relative modal-box flex max-h-[92dvh] flex-col items-center gap-3 overflow-y-auto border-3 border-ink p-5 text-center"
		style:--tilt="1deg"
	>
		{#if isNewBest}
			<Confetti />
		{/if}

		<MazeItemIcon kind="permit" class="size-16" />
		<h2 id="maze-win-title" class="text-3xl font-bold">{m.maze_win_title()}</h2>
		<MazeStars {stars} class="size-12" />
		<p class="text-sm">{m.maze_win_line()}</p>

		<dl class="grid w-full grid-cols-3 gap-2 text-center">
			<div class="rounded-lg border-2 border-ink bg-sand p-1">
				<dt class="text-xs font-bold">{m.maze_steps()}</dt>
				<dd class="font-display text-2xl font-bold text-tie-red tabular-nums">{steps}</dd>
			</div>
			<div class="rounded-lg border-2 border-ink bg-sand p-1">
				<dt class="text-xs font-bold">{m.maze_par()}</dt>
				<dd class="font-display text-2xl font-bold tabular-nums">{par}</dd>
			</div>
			<div class="rounded-lg border-2 border-ink bg-sand p-1">
				<dt class="text-xs font-bold">{m.maze_best()}</dt>
				<dd class="font-display text-2xl font-bold tabular-nums">{best ?? steps}</dd>
			</div>
		</dl>

		{#if isNewBest}
			<span
				class="pop-in rotate-2 rounded-md border-2 border-ink bg-explosion-yellow px-2 font-bold"
			>
				{m.maze_new_best()}
			</span>
		{/if}

		<div class="flex flex-wrap items-center justify-center gap-3">
			<button type="button" class="btn-chunky bg-khaki text-lg" onclick={onNew}>
				<IconShuffle class="size-5" aria-hidden="true" />
				{m.maze_new_maze()}
			</button>
			<button type="button" class="btn-chunky" onclick={onRetry}>
				<IconRotate class="size-5" aria-hidden="true" />
				{m.maze_same_maze()}
			</button>
			<button type="button" class="btn-chunky" onclick={onSizes}>
				<IconList class="size-5" aria-hidden="true" />
				{m.maze_back_to_sizes()}
			</button>
		</div>

		{#if isNewBest}
			<ShareButton {modeName} score={steps} {drawBoard} />
		{/if}
	</div>
</dialog>
