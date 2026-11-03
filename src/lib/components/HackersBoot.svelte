<!--
	Hermit Hackers run boot sequence: a few lines of connection set-up are typed out before the
	contract starts, and the game's clock does not run meanwhile. A tap, click or key skips it;
	with reduced motion it is shown whole and finishes after a short beat.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import type { HackersGame } from '#lib/stores/hackersGame.svelte.js';
	import { soundManager } from '#lib/sound/soundManager.svelte.js';
	import { haptic } from '#lib/haptic/haptic.svelte.js';

	let { game, onDone }: { game: HackersGame; onDone: () => void } = $props();

	const LINE_MS = 260;

	const lines = $derived([
		m.hackers_boot_proxies(),
		m.hackers_boot_dampener(),
		m.hackers_log_connect({ ip: game.ip, system: game.system }),
		m.hackers_boot_handshake()
	]);
	let count = $state(0);

	onMount(() => {
		const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
		if (reduced) {
			count = lines.length;
			const done = setTimeout(onDone, 500);
			return () => clearTimeout(done);
		}
		let finish: ReturnType<typeof setTimeout> | undefined;
		const timer = setInterval(() => {
			count += 1;
			soundManager().play('term-type', 0.6);
			haptic().play(0.05);
			if (count >= lines.length) {
				clearInterval(timer);
				finish = setTimeout(onDone, 380);
			}
		}, LINE_MS);
		return () => {
			clearInterval(timer);
			clearTimeout(finish);
		};
	});
</script>

<svelte:window onkeydown={onDone} />

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div
	class="absolute inset-0 z-20 flex flex-col justify-end gap-1 bg-(--hk-bg) p-4 text-sm"
	dir="ltr"
	onclick={onDone}
>
	{#each lines.slice(0, count) as line, i (i)}
		<p class={i === count - 1 ? '' : 'opacity-70'}>{line}</p>
	{/each}
	<p><span class="hk-cursor" aria-hidden="true"></span></p>
</div>
