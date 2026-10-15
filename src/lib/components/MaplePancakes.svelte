<!--
	The ending of every level: one pancake per barrel delivered, stacked up with a pat of butter
	and a slow drip of syrup on top (the stack never grows taller than MAX_PANCAKES).
-->
<script lang="ts">
	import { MAX_PANCAKES } from '#lib/game/maple/config.js';
	import { m } from '#lib/paraglide/messages.js';

	let { count, class: className = 'h-28' }: { count: number; class?: string } = $props();

	const shown = $derived(Math.min(MAX_PANCAKES, Math.max(0, count)));
	/** Each pancake is 7 units tall and the stack grows upward from the plate */
	const top = $derived(70 - shown * 7);
</script>

<svg
	viewBox="0 0 100 80"
	class="w-auto {className}"
	role="img"
	aria-label={m.maple_pancakes_alt({ count })}
	stroke="var(--color-ink)"
	stroke-width="2.5"
	stroke-linejoin="round"
>
	<ellipse cx="50" cy="73" rx="44" ry="6" fill="var(--color-paper)" />
	{#each Array.from({ length: shown }, (_, stacked) => stacked) as index (index)}
		<g>
			<rect x="22" y={63 - index * 7} width="56" height="8" rx="4" fill="#d9a05b" />
			<ellipse cx="50" cy={63 - index * 7} rx="28" ry="3.5" fill="#efc384" />
		</g>
	{/each}
	{#if shown > 0}
		<path
			d="M26 {top + 1} Q50 {top - 3} 74 {top + 1} L74 {top + 6} Q70 {top + 9} 66 {top +
				6} Q62 {top + 12} 58 {top + 6} Q40 {top + 8} 34 {top + 6} Q30 {top + 11} 26 {top + 6} Z"
			fill="#c8791a"
		/>
		<rect x="44" y={top - 6} width="12" height="6" rx="1.5" fill="var(--color-explosion-yellow)" />
	{/if}
</svg>
