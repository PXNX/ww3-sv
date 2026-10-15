<!--
	Result and statistics sheet of Sanctions Wordle. Sanctions Wordle has no lives and no score, so
	this replaces the shared game-over modal: it shows how the puzzle ended, the daily stats (games
	played, win rate, streak, best streak and the guess distribution), the time until the next
	daily puzzle, and a share button that sends coloured squares only, never a letter.
-->
<script lang="ts">
	import { formatCountdown } from '#lib/game/wordle/daily.js';
	import { MAX_GUESSES } from '#lib/game/wordle/locales.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { WordleGame } from '#lib/stores/wordleGame.svelte.js';
	import Confetti from './Confetti.svelte';
	import IconCalendar from '~icons/lucide/calendar-days';
	import IconDice from '~icons/lucide/dices';
	import IconShare from '~icons/lucide/share-2';

	let {
		open,
		game,
		onclose,
		onpractice,
		ondaily
	}: {
		open: boolean;
		game: WordleGame;
		onclose: () => void;
		/** Starts a practice round (also used for "new word" after a practice round) */
		onpractice: () => void;
		/** Goes back to the daily puzzle from practice */
		ondaily: () => void;
	} = $props();

	let dialog: HTMLDialogElement | undefined = $state();
	let status = $state('');

	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) {
			status = '';
			dialog.showModal();
		} else if (!open && dialog.open) {
			dialog.close();
		}
	});

	const practice = $derived(game.mode === 'practice');
	const distribution = $derived(game.stats.distribution);
	const mostWins = $derived(Math.max(1, ...distribution));
	// The bar of the daily puzzle that was just solved is highlighted
	const solvedIn = $derived(game.mode === 'daily' && game.won ? game.guesses.length : 0);

	const title = $derived(
		game.finished
			? game.won
				? m.wordle_result_won_title()
				: m.wordle_result_lost_title()
			: m.wordle_stats_title()
	);

	const summary = $derived.by(() => {
		if (!game.finished) return '';
		if (game.won) {
			const values = { count: game.guesses.length, max: MAX_GUESSES };
			return practice ? m.wordle_result_practice_won(values) : m.wordle_result_won_text(values);
		}
		const values = { word: game.solution };
		return practice ? m.wordle_result_practice_lost(values) : m.wordle_result_lost_text(values);
	});

	async function copy(text: string): Promise<boolean> {
		try {
			await navigator.clipboard.writeText(text);
			return true;
		} catch {
			return false;
		}
	}

	async function share() {
		const text = game.share(m.wordle_share_title(), location.origin);
		try {
			if (typeof navigator.share === 'function') {
				await navigator.share({ text });
				status = '';
				return;
			}
		} catch (error) {
			if (error instanceof DOMException && error.name === 'AbortError') return;
			// Any other failure falls back to copying
		}
		status = (await copy(text)) ? m.wordle_notice_copied() : m.wordle_notice_share_failed();
	}
</script>

<dialog
	bind:this={dialog}
	class="modal modal-bottom sm:modal-middle"
	aria-labelledby="wordle-result-title"
	{onclose}
>
	<div
		class="sticker relative modal-box flex max-h-[92dvh] flex-col items-center gap-3 overflow-y-auto border-3 border-ink p-5 text-center"
		style:--tilt="1deg"
	>
		{#if open && game.won && !practice}
			<Confetti />
		{/if}

		<h2 id="wordle-result-title" dir="auto" class="text-3xl font-bold">{title}</h2>

		{#if game.finished}
			<p dir="auto" class="font-semibold">{summary}</p>
		{/if}

		<dl class="grid w-full grid-cols-4 gap-2 text-center">
			<div class="rounded-lg border-2 border-ink bg-sand p-1">
				<dt class="text-xs leading-tight font-bold" dir="auto">{m.wordle_stat_played()}</dt>
				<dd class="font-display text-2xl font-bold tabular-nums">{game.stats.played}</dd>
			</div>
			<div class="rounded-lg border-2 border-ink bg-sand p-1">
				<dt class="text-xs leading-tight font-bold" dir="auto">{m.wordle_stat_win_rate()}</dt>
				<dd class="font-display text-2xl font-bold tabular-nums">{game.winPercent}%</dd>
			</div>
			<div class="rounded-lg border-2 border-ink bg-sand p-1">
				<dt class="text-xs leading-tight font-bold" dir="auto">{m.wordle_stat_streak()}</dt>
				<dd class="font-display text-2xl font-bold tabular-nums">{game.streak}</dd>
			</div>
			<div class="rounded-lg border-2 border-ink bg-sand p-1">
				<dt class="text-xs leading-tight font-bold" dir="auto">{m.wordle_stat_best_streak()}</dt>
				<dd class="font-display text-2xl font-bold tabular-nums">{game.stats.maxStreak}</dd>
			</div>
		</dl>

		<section class="w-full" aria-labelledby="wordle-distribution-title">
			<h3 id="wordle-distribution-title" dir="auto" class="mb-1 text-sm font-bold">
				{m.wordle_distribution_title()}
			</h3>
			<ol class="flex flex-col gap-1" dir="ltr">
				{#each distribution as count, index (index)}
					<li class="flex items-center gap-2 text-sm font-bold">
						<span class="w-3 text-end font-display tabular-nums">{index + 1}</span>
						<span class="flex-1 text-start">
							<span
								class="inline-block min-w-[1.75rem] rounded-sm border-2 border-ink px-1.5 text-end font-display tabular-nums {solvedIn ===
								index + 1
									? 'bg-khaki'
									: 'bg-sky'}"
								style:width="{Math.max(8, Math.round((count / mostWins) * 100))}%"
							>
								{count}
							</span>
						</span>
					</li>
				{/each}
			</ol>
		</section>

		<p class="flex flex-col items-center gap-0.5 text-sm font-bold" dir="auto">
			<span>{m.wordle_next_puzzle()}</span>
			<span class="font-display text-3xl tabular-nums" dir="ltr"
				>{formatCountdown(game.msLeft)}</span
			>
		</p>

		<div class="flex flex-wrap items-center justify-center gap-3">
			{#if game.finished}
				<button type="button" class="btn-chunky bg-flag-blue" onclick={share}>
					<IconShare class="size-5" aria-hidden="true" />
					{m.wordle_share_button()}
				</button>
			{/if}
			{#if practice}
				<button type="button" class="btn-chunky bg-khaki" onclick={onpractice}>
					<IconDice class="size-5" aria-hidden="true" />
					{m.wordle_practice_next()}
				</button>
				<button type="button" class="btn-chunky" onclick={ondaily}>
					<IconCalendar class="size-5" aria-hidden="true" />
					{m.wordle_back_to_daily()}
				</button>
			{:else}
				<button type="button" class="btn-chunky bg-khaki" onclick={onpractice}>
					<IconDice class="size-5" aria-hidden="true" />
					{m.wordle_practice_start()}
				</button>
			{/if}
			<button type="button" class="btn-chunky" onclick={onclose}>{m.wordle_close()}</button>
		</div>

		<p class="min-h-5 text-sm" role="status">{status}</p>
	</div>
</dialog>
