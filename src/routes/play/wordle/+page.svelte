<!--
	Sanctions Wordle (roadmap 3.16): a daily five-letter word puzzle with six guesses, themed on
	sanctions, energy, trade and bureaucracy. Every language has its own word list and its own
	daily word (the same for everyone on the same local day), the result and stats stay in local
	storage, and practice mode gives unlimited random words. There are no lives and no score: a
	puzzle ends after six guesses or when the word is found, and the result sheet shows the stats,
	a countdown to the next puzzle and a share button that sends coloured squares only.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import GameShell from '#lib/components/GameShell.svelte';
	import TutorialModal from '#lib/components/TutorialModal.svelte';
	import WordleBoard from '#lib/components/WordleBoard.svelte';
	import WordleKeyboard from '#lib/components/WordleKeyboard.svelte';
	import WordleResult from '#lib/components/WordleResult.svelte';
	import { prefersReducedMotion } from '#lib/game/loop.js';
	import { formatCountdown } from '#lib/game/wordle/daily.js';
	import {
		MAX_GUESSES,
		inputLetters,
		wordleLocale,
		type WordleLocale
	} from '#lib/game/wordle/locales.js';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { firstPlay } from '#lib/services/tutorial.js';
	import { WordleGame } from '#lib/stores/wordleGame.svelte.js';
	import IconCalendar from '~icons/lucide/calendar-days';
	import IconChart from '~icons/lucide/chart-column';
	import IconHelp from '~icons/lucide/circle-help';
	import IconDice from '~icons/lucide/dices';

	const locale = wordleLocale(getLocale());
	const game = new WordleGame({ locale });
	const modeName = m.mode_wordle_name();
	const reducedMotion = prefersReducedMotion();

	// The letter rules of each language that is worth a line in the how-to-play screen
	const letterRules: Partial<Record<WordleLocale, () => string>> = {
		de: m.wordle_tutorial_letters_de,
		ru: m.wordle_tutorial_letters_ru,
		fa: m.wordle_tutorial_letters_fa,
		ar: m.wordle_tutorial_letters_ar,
		uk: m.wordle_tutorial_letters_uk
	};
	const letterRule = letterRules[locale];

	const NOTICE_MS = 1800;
	// The tiles of a guess flip one after the other; the sheet opens after the last one
	const REVEAL_MS = reducedMotion ? 300 : 5 * 190 + 800;

	let showTutorial = $state(false);
	let showResult = $state(false);

	onMount(() => {
		showTutorial = firstPlay('wordle');
		const timer = setInterval(() => game.tick(), 1000);
		const onVisible = () => {
			if (document.visibilityState === 'visible') game.tick();
		};
		document.addEventListener('visibilitychange', onVisible);
		return () => {
			clearInterval(timer);
			document.removeEventListener('visibilitychange', onVisible);
		};
	});

	// The result sheet opens when a puzzle ends during play, once the last tile has turned over
	let seenFinishes = 0;
	$effect(() => {
		const finishes = game.finishes;
		if (finishes === seenFinishes) return;
		seenFinishes = finishes;
		const timer = setTimeout(() => (showResult = true), REVEAL_MS);
		return () => clearTimeout(timer);
	});

	// Notices fade away by themselves
	$effect(() => {
		const notice = game.notice;
		if (!notice) return;
		const timer = setTimeout(() => {
			if (game.notice?.id === notice.id) game.notice = null;
		}, NOTICE_MS);
		return () => clearTimeout(timer);
	});

	const noticeText = $derived.by(() => {
		switch (game.notice?.kind) {
			case 'short':
				return m.wordle_notice_short();
			case 'unknown':
				return m.wordle_notice_unknown();
			case 'newDay':
				return m.wordle_notice_new_day();
			default:
				return '';
		}
	});

	function onKeydown(event: KeyboardEvent) {
		if (showTutorial || showResult || event.isComposing) return;
		if (event.ctrlKey || event.metaKey || event.altKey) return;
		// Enter on a focused button or link belongs to that control
		const interactive = (event.target as HTMLElement | null)?.closest?.(
			'button, a, input, textarea, select, [role="button"]'
		);
		if (event.key === 'Enter') {
			if (interactive) return;
			event.preventDefault();
			game.submit();
		} else if (event.key === 'Backspace') {
			event.preventDefault();
			game.backspace();
		} else if (event.key.length === 1) {
			const letters = inputLetters(locale, event.key);
			if (letters.length > 0) {
				event.preventDefault();
				game.type(letters);
			}
		}
	}

	function openHelp() {
		showTutorial = true;
	}

	function startPractice() {
		game.startPractice();
		showResult = false;
	}

	function showDaily() {
		game.showDaily();
		showResult = false;
	}
</script>

<svelte:window onkeydown={onKeydown} />

<GameShell title={modeName} confirmLeave={false}>
	{#snippet actions()}
		<button
			type="button"
			class="btn-chunky px-2 py-1 text-sm sm:px-3"
			aria-label={m.wordle_stats_button()}
			onclick={() => (showResult = true)}
		>
			<IconChart class="size-4" aria-hidden="true" />
			<span class="hidden sm:inline">{m.wordle_stats_button()}</span>
		</button>
		<button
			type="button"
			class="btn-chunky px-2 py-1 text-sm sm:px-3"
			aria-label={m.wordle_help_button()}
			onclick={openHelp}
		>
			<IconHelp class="size-4" aria-hidden="true" />
			<span class="hidden sm:inline">{m.wordle_help_button()}</span>
		</button>
	{/snippet}

	<section class="mx-auto flex w-full max-w-xl flex-col gap-2 pb-2">
		<div class="grid grid-cols-2 gap-2" role="group" aria-label={m.wordle_tabs_label()}>
			<button
				type="button"
				class="btn-chunky justify-center px-2 py-1 text-sm {game.mode === 'daily'
					? 'bg-explosion-yellow'
					: 'bg-paper'}"
				aria-pressed={game.mode === 'daily'}
				onclick={showDaily}
			>
				<IconCalendar class="size-4" aria-hidden="true" />
				{m.wordle_tab_daily()}
			</button>
			<button
				type="button"
				class="btn-chunky justify-center px-2 py-1 text-sm {game.mode === 'practice'
					? 'bg-explosion-yellow'
					: 'bg-paper'}"
				aria-pressed={game.mode === 'practice'}
				onclick={() => game.mode !== 'practice' && startPractice()}
			>
				<IconDice class="size-4" aria-hidden="true" />
				{m.wordle_tab_practice()}
			</button>
		</div>

		<div
			class="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 rounded-[12px_6px_14px_8px] border-3 border-ink bg-paper px-3 py-1.5 font-display text-sm font-bold shadow-[3px_3px_0_var(--color-ink)]"
		>
			{#if game.mode === 'daily'}
				<p dir="auto" class="tabular-nums">{m.wordle_hud_daily({ number: game.puzzleNumber })}</p>
				<p dir="auto" class="tabular-nums">
					{m.wordle_hud_guess({
						number: game.finished
							? game.guesses.length
							: Math.min(game.guesses.length + 1, MAX_GUESSES),
						max: MAX_GUESSES
					})}
				</p>
				<p dir="auto" class="tabular-nums">{m.wordle_hud_streak({ count: game.streak })}</p>
			{:else}
				<p dir="auto">{m.wordle_hud_practice()}</p>
				<p dir="auto" class="tabular-nums">
					{m.wordle_hud_guess({
						number: game.finished
							? game.guesses.length
							: Math.min(game.guesses.length + 1, MAX_GUESSES),
						max: MAX_GUESSES
					})}
				</p>
			{/if}
		</div>

		<p
			class="min-h-7 text-center font-display text-lg font-bold"
			role="status"
			aria-live="polite"
			dir="auto"
		>
			{#if game.notice}
				<span class="pop-in inline-block rounded-md border-2 border-ink bg-explosion-yellow px-2">
					{noticeText}
				</span>
			{/if}
		</p>

		<div data-playfield dir="ltr" class="flex flex-col gap-4" style:touch-action="none">
			<WordleBoard {game} />
			<WordleKeyboard
				{game}
				onletter={(letter) => game.type([letter])}
				onenter={() => game.submit()}
				ondelete={() => game.backspace()}
			/>
		</div>

		{#if game.finished && !showResult}
			<div class="flex flex-col items-center gap-2 pt-1">
				{#if game.mode === 'daily'}
					<p class="text-sm font-bold" dir="auto">
						{m.wordle_next_puzzle()}
						<span class="font-display text-lg tabular-nums" dir="ltr">
							{formatCountdown(game.msLeft)}
						</span>
					</p>
				{/if}
				<div class="flex flex-wrap justify-center gap-2">
					<button type="button" class="btn-chunky bg-flag-blue" onclick={() => (showResult = true)}>
						{m.wordle_show_result()}
					</button>
					<button type="button" class="btn-chunky bg-khaki" onclick={startPractice}>
						<IconDice class="size-5" aria-hidden="true" />
						{game.mode === 'practice' ? m.wordle_practice_next() : m.wordle_practice_start()}
					</button>
				</div>
			</div>
		{/if}
	</section>

	<TutorialModal
		open={showTutorial}
		title={m.wordle_tutorial_title()}
		closeLabel={m.wordle_tutorial_close()}
		onclose={() => (showTutorial = false)}
	>
		<p>{m.wordle_tutorial_goal()}</p>
		<p>{m.wordle_tutorial_colors()}</p>
		<p>{m.wordle_tutorial_duplicates()}</p>
		<p>{m.wordle_tutorial_daily()}</p>
		<p>{m.wordle_tutorial_share()}</p>
		<p>{m.wordle_tutorial_keys()}</p>
		{#if letterRule}
			<p>{letterRule()}</p>
		{/if}
	</TutorialModal>

	<WordleResult
		open={showResult}
		{game}
		onclose={() => (showResult = false)}
		onpractice={startPractice}
		ondaily={showDaily}
	/>
</GameShell>
