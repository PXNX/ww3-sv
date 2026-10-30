<!--
	Hermit Hackers, stage 3 (relays): with the passphrase in hand, switch off the target's alarm
	relays. A switch flips itself and its neighbours (Lights Out). Lit red = alarm still on.
-->
<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import type { HackersGame } from '#lib/stores/hackersGame.svelte.js';

	let { game }: { game: HackersGame } = $props();

	const cell = $derived(game.panelSize >= 5 ? '3rem' : '3.5rem');
</script>

<div class="flex flex-col items-center gap-3">
	<p class="self-start text-sm leading-snug">{m.hackers_relays_hint()}</p>

	<div
		dir="ltr"
		class="grid gap-2"
		style:grid-template-columns="repeat({game.panelSize}, {cell})"
		role="group"
		aria-label={m.hackers_relays_label()}
	>
		{#each game.panel as lit, i (i)}
			<button
				type="button"
				class="rounded border-2 transition-colors {lit
					? 'border-[#ff8a8e] bg-[#e5484d] shadow-[0_0_12px_#e5484d]'
					: 'border-[#39ff6a]/60 bg-[#0b2a14]'}"
				style:height={cell}
				aria-pressed={lit}
				aria-label={lit ? m.hackers_relay_on() : m.hackers_relay_off()}
				onclick={() => game.flipRelay(i)}
			></button>
		{/each}
	</div>

	<p class="text-xs opacity-80">{m.hackers_relays_moves({ count: game.moves, par: game.par })}</p>
</div>
