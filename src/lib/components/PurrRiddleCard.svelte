<!--
	The riddle on a parchment card, in the mystical riddle font, with a faint glow. The five lines
	appear one after the other, letter by letter (word by word in Persian and Arabic, whose letters
	join), and all at once with reduced motion. Screen readers get the whole riddle straight away.

	The player's place in the riddle shows: the lines already joined get a tick, and the line to do
	next is marked.
-->
<script lang="ts">
	import type { Riddle } from '#lib/game/purrpentagram/riddle.js';
	import { revealDurationMs, revealLines, revealsByWord } from '#lib/game/purrpentagram/reveal.js';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { stepText } from '#lib/theme/purrText.js';
	import IconCheck from '~icons/lucide/check';

	let {
		riddle,
		calm,
		joined = 0,
		closed = false
	}: {
		riddle: Riddle;
		calm: boolean;
		/** How many cats of the star are joined so far: the lines up to there get a tick */
		joined?: number;
		/** The star is closed: nothing is left to do */
		closed?: boolean;
	} = $props();

	const lines = $derived(riddle.clues.map((clue, step) => stepText(step, clue)));
	const byWord = revealsByWord(getLocale());
	const totalMs = $derived(lines.reduce((sum, line) => sum + revealDurationMs(line, byWord), 0));

	let elapsedMs = $state(0);

	// Every new riddle starts revealing from its first letter
	$effect(() => {
		void riddle;
		if (calm) {
			elapsedMs = Infinity;
			return;
		}
		elapsedMs = 0;
		const started = performance.now();
		let frame = requestAnimationFrame(function tick(now) {
			elapsedMs = now - started;
			if (elapsedMs < totalMs) frame = requestAnimationFrame(tick);
		});
		return () => cancelAnimationFrame(frame);
	});

	const revealed = $derived(revealLines(lines, elapsedMs, byWord));
</script>

<section
	class="parchment riddle-font flex flex-col gap-1 px-4 py-3"
	aria-label={m.purr_riddle_title()}
>
	<h2 class="riddle-glow text-center text-lg font-bold tracking-wide sm:text-xl">
		{m.purr_riddle_title()}
	</h2>
	<p dir="auto" class="text-center text-xs leading-snug opacity-80 sm:text-sm">
		{m.purr_riddle_intro()}
	</p>
	<ol class="mt-1 flex flex-col gap-1">
		{#each revealed as line, index (index)}
			{@const done = index < joined}
			{@const next = !closed && index === Math.min(joined, riddle.clues.length)}
			<li
				dir="auto"
				class="flex items-start gap-2 rounded-md px-1 text-sm leading-snug font-bold sm:text-base {done
					? 'opacity-60'
					: 'riddle-glow'} {next ? 'bg-ink/10' : ''}"
				aria-current={next ? 'step' : undefined}
			>
				<span
					class="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 border-current text-xs"
					aria-hidden="true"
				>
					{#if done}<IconCheck class="size-3.5" />{:else}{index + 1}{/if}
				</span>
				<span class="min-w-0 flex-1">
					<span class="sr-only">{lines[index]}</span>
					<span aria-hidden="true">{line.shown}<span class="opacity-0">{line.hidden}</span></span>
				</span>
			</li>
		{/each}
	</ol>
</section>
