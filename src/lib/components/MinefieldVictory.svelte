<!--
	Minefield win screen (requirements Section 3): the surviving tankers sail past the sulking
	mascot, with a random line from the victory pool, the score, the times, and Play Again.
	A new best score or time adds confetti and a Share button.
-->
<script lang="ts" module>
	import { m } from '$lib/paraglide/messages';

	const VICTORY_LINES = [
		m.minefield_victory_1,
		m.minefield_victory_2,
		m.minefield_victory_3,
		m.minefield_victory_4
	];

	// Remembered across wins so the same line never appears twice in a row
	let lastLine = -1;
</script>

<script lang="ts">
	import { resolve } from '$app/paths';
	import { formatTime } from '$lib/game/minefield/scoring';
	import { getLocale } from '$lib/paraglide/runtime';
	import type { ScoreCard } from '$lib/services/share';
	import type { MinefieldResult } from '$lib/stores/minefieldGame.svelte';
	import { soundManager } from '$lib/sound/soundManager.svelte';
	import { CHARACTER_NAME } from '$lib/theme/character';
	import { spriteSrc } from '$lib/theme/sprites';
	import CharacterMascot from './CharacterMascot.svelte';
	import Confetti from './Confetti.svelte';
	import MinefieldScoreBreakdown from './MinefieldScoreBreakdown.svelte';
	import ShareButton from './ShareButton.svelte';
	import IconRotate from '~icons/lucide/rotate-ccw';
	import IconSliders from '~icons/lucide/sliders-horizontal';

	let {
		open,
		result,
		tankers,
		modeName,
		drawBoard,
		onPlayAgain,
		onChangeDifficulty
	}: {
		open: boolean;
		result: MinefieldResult | null;
		/** Tankers that made it through */
		tankers: number;
		modeName: string;
		drawBoard?: ScoreCard['drawBoard'];
		onPlayAgain: () => void;
		onChangeDifficulty: () => void;
	} = $props();

	let dialog: HTMLDialogElement | undefined = $state();
	let line = $state(0);
	const isNewBest = $derived(!!result && (result.isNewBestScore || result.isNewBestTime));

	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) {
			// Flavor text only, so it does not need the seeded game randomness
			line = Math.floor(Math.random() * VICTORY_LINES.length);
			if (line === lastLine) line = (line + 1) % VICTORY_LINES.length;
			lastLine = line;
			dialog.showModal();
			soundManager().play(isNewBest ? 'new-best' : 'chime-big');
		} else if (!open && dialog.open) {
			dialog.close();
		}
	});
</script>

<dialog
	bind:this={dialog}
	class="modal modal-bottom sm:modal-middle"
	aria-labelledby="minefield-victory-title"
	oncancel={(event) => event.preventDefault()}
>
	{#if result}
		<div
			class="sticker relative modal-box flex max-h-[92dvh] flex-col items-center gap-3 overflow-y-auto rounded-[18px_10px_16px_8px] border-3 border-ink bg-paper p-5 text-center shadow-(--shadow-hard)"
			style:--tilt="1deg"
		>
			{#if isNewBest}
				<Confetti />
			{/if}

			<h2 id="minefield-victory-title" class="text-3xl font-bold">
				{m.minefield_victory_title()}
			</h2>

			<div class="flex w-full items-end gap-2">
				<CharacterMascot pose="sulking" class="w-20 shrink-0 -rotate-3 sm:w-24" />
				<div
					data-playfield
					class="relative h-16 flex-1 overflow-hidden rounded-[10px_6px_12px_8px] border-3 border-ink bg-flag-blue"
					aria-hidden="true"
				>
					{#each Array.from({ length: tankers }, (_, index) => index) as index (index)}
						<img
							src={spriteSrc('tanker')}
							alt=""
							class="sail absolute bottom-1 w-20"
							style:--delay="{index * 1.1}s"
							style:--rest="{8 + index * 30}%"
							draggable="false"
						/>
					{/each}
				</div>
			</div>

			<p class="leading-snug font-semibold">
				{VICTORY_LINES[line]({ characterName: CHARACTER_NAME[getLocale()] })}
			</p>

			<div class="flex flex-col items-center">
				<span class="text-sm font-bold uppercase">{m.gameover_final_score()}</span>
				<span class="pop-in font-display text-5xl font-bold text-tie-red tabular-nums">
					{result.score.total}
				</span>
				{#if result.isNewBestScore}
					<span
						class="pop-in mt-1 rotate-2 rounded-md border-2 border-ink bg-explosion-yellow px-2 font-bold"
					>
						{m.gameover_new_best()}
					</span>
				{/if}
			</div>

			<div class="flex flex-wrap justify-center gap-x-4 font-display font-bold tabular-nums">
				<span>{m.minefield_victory_time({ time: formatTime(result.seconds) })}</span>
				{#if result.bestTime !== null}
					<span>{m.minefield_best_time({ time: formatTime(result.bestTime) })}</span>
				{/if}
			</div>
			{#if result.isNewBestTime}
				<span
					class="pop-in -rotate-2 rounded-md border-2 border-ink bg-explosion-yellow px-2 font-bold"
				>
					{m.minefield_victory_new_best_time()}
				</span>
			{/if}

			<MinefieldScoreBreakdown score={result.score} />

			<div class="flex flex-wrap items-center justify-center gap-3">
				<button type="button" class="btn-chunky bg-tie-red text-lg" onclick={onPlayAgain}>
					<IconRotate class="size-5" aria-hidden="true" />
					{m.minefield_play_again()}
				</button>
				<button type="button" class="btn-chunky" onclick={onChangeDifficulty}>
					<IconSliders class="size-5" aria-hidden="true" />
					{m.minefield_change_difficulty()}
				</button>
				<a href={resolve('/')} class="btn-chunky">{m.gameover_home()}</a>
			</div>

			{#if isNewBest}
				<ShareButton {modeName} score={result.score.total} {drawBoard} />
			{/if}
		</div>
	{/if}
</dialog>

<style>
	.sail {
		animation: sail 6s linear var(--delay) infinite both;
	}

	@keyframes sail {
		from {
			left: -30%;
		}
		to {
			left: 110%;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.sail {
			animation: none;
			left: var(--rest);
		}
	}
</style>
