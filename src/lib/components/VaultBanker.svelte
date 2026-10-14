<!--
	The banker: an invented stern, neutral-faced caricature of a private banker (no real person).
	His face shows the eyebrow count: one raised eyebrow after the first mismatch, two after the
	second. A glare (a lost heart) slants both brows down, a twitch (the gold-and-cheese pair)
	lifts a corner of his mouth.
-->
<script lang="ts">
	import { raisedEyebrows, type BankerMood } from '#lib/game/vault/banker.js';
	import { m } from '#lib/paraglide/messages.js';

	let {
		eyebrows,
		mood = 'neutral',
		class: className = ''
	}: { eyebrows: number; mood?: BankerMood; class?: string } = $props();

	const raised = $derived(raisedEyebrows(eyebrows));
	const glare = $derived(mood === 'glare');
</script>

<svg
	viewBox="0 0 120 120"
	class={className}
	role="img"
	aria-label={m.vault_banker_alt({ count: raised })}
	fill="none"
	stroke="#111"
	stroke-width="3.5"
	stroke-linecap="round"
	stroke-linejoin="round"
>
	<!-- Suit, shirt and tie -->
	<path d="M8 120 Q10 92 40 88 L80 88 Q110 92 112 120 Z" fill="#7d8594" />
	<path d="M46 88 L60 108 L74 88 Z" fill="#fff" stroke-width="3" />
	<path d="M57 98 L63 98 L65 118 L60 122 L55 118 Z" fill="#2b3a55" stroke-width="3" />
	<path d="M60 88 V98" stroke-width="3" />
	<!-- Ears and head -->
	<ellipse cx="24" cy="58" rx="6" ry="9" fill="#f2c9a0" />
	<ellipse cx="96" cy="58" rx="6" ry="9" fill="#f2c9a0" />
	<ellipse cx="60" cy="56" rx="36" ry="38" fill="#f2c9a0" />
	<!-- Neat grey hair -->
	<path
		d="M25 46 Q22 14 60 11 Q98 14 95 46 Q92 24 74 20 Q56 24 38 20 Q28 24 25 46 Z"
		fill="#b9bdc6"
	/>
	<!-- Eyes -->
	<circle cx="43" cy="58" r="3.2" fill="#111" stroke="none" />
	<circle cx="77" cy="58" r="3.2" fill="#111" stroke="none" />
	<!-- Brows: the left one goes up first, then the right one -->
	<g>
		{#if glare}
			<path d="M30 44 L52 52" stroke-width="5" />
		{:else}
			<path
				d="M31 {raised >= 1 ? 42 : 49} Q42 {raised >= 1 ? 27 : 47} 54 {raised >= 1 ? 33 : 49}"
				stroke-width="5"
			/>
		{/if}
	</g>
	<g>
		{#if glare}
			<path d="M90 44 L68 52" stroke-width="5" />
		{:else}
			<path
				d="M66 {raised >= 2 ? 33 : 49} Q78 {raised >= 2 ? 27 : 47} 89 {raised >= 2 ? 42 : 49}"
				stroke-width="5"
			/>
		{/if}
	</g>
	<!-- Nose -->
	<path d="M60 60 L56 74 L62 75" stroke-width="3" />
	<!-- Mouth: a flat stern line, a frown when glaring, a tiny twitch for gold and cheese -->
	{#if glare}
		<path d="M46 88 Q60 80 74 88" />
	{:else if mood === 'twitch'}
		<path d="M46 85 H68 Q72 85 75 81" />
	{:else}
		<path d="M46 85 H74" />
	{/if}
</svg>
