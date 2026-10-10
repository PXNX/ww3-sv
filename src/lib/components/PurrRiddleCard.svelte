<!--
	The riddle on a parchment card, in the mystical riddle font, with a faint glow. The five lines
	appear one after the other, letter by letter (word by word in Persian and Arabic, whose letters
	join), and all at once with reduced motion. Screen readers get the whole riddle straight away.
-->
<script lang="ts">
	import type { Riddle } from '#lib/game/purrpentagram/riddle.js';
	import { revealDurationMs, revealLines, revealsByWord } from '#lib/game/purrpentagram/reveal.js';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { stepText } from '#lib/theme/purrText.js';

	let { riddle, calm }: { riddle: Riddle; calm: boolean } = $props();

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
			<li dir="auto" class="riddle-glow text-sm leading-snug font-bold sm:text-base">
				<span class="sr-only">{lines[index]}</span>
				<span aria-hidden="true">{line.shown}<span class="opacity-0">{line.hidden}</span></span>
			</li>
		{/each}
	</ol>
</section>
