<!--
	Hermit Hackers: one line of terminal output that types itself out character by character, with a
	soft key tick every few characters. Lines that are not new (`animate` false), and everyone with
	reduced motion, get the whole text at once. Screen readers always get the full text.
-->
<script lang="ts">
	import { untrack } from 'svelte';
	import { soundManager } from '#lib/sound/soundManager.svelte.js';

	let {
		text,
		animate = true,
		speed = 14,
		sound = true,
		onDone
	}: {
		text: string;
		animate?: boolean;
		/** Milliseconds per character */
		speed?: number;
		sound?: boolean;
		onDone?: () => void;
	} = $props();

	const reduced =
		typeof window !== 'undefined' &&
		window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

	let shown = $state(untrack(() => (animate && !reduced ? 0 : text.length)));
	let timer: ReturnType<typeof setInterval> | undefined;

	$effect(() => {
		const total = text.length;
		if (!animate || reduced) {
			shown = total;
			return;
		}
		timer = setInterval(() => {
			shown = Math.min(total, shown + 1);
			if (sound && shown % 4 === 1) soundManager().play('term-type', 0.5);
			if (shown >= total) {
				clearInterval(timer);
				onDone?.();
			}
		}, speed);
		return () => clearInterval(timer);
	});
</script>

<span class="sr-only">{text}</span>
<span aria-hidden="true">{text.slice(0, shown)}</span>
