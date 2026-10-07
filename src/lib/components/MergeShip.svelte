<!--
	Generic, original ship silhouettes for the Merge Tankers tiers. Each tier differs in outline and
	size, not only color (small open boat, then cabins, stacks, decks, containers and long hulls),
	so the ladder stays readable at small sizes and for players with color-vision deficiency.
-->
<script lang="ts">
	import { tierStyle, tokenColor } from '#lib/game/merge/tierStyle.js';

	let { tier, class: className = '' }: { tier: number; class?: string } = $props();

	const hull = $derived(tokenColor(tierStyle(tier).hull));
	const paper = tokenColor('paper');
	const sand = tokenColor('sand');
	const glass = tokenColor('flag-blue');
	const accent = tokenColor('mustard');
	const khaki = tokenColor('khaki');
</script>

<svg
	viewBox="0 0 100 100"
	class={className}
	aria-hidden="true"
	stroke="var(--color-ink)"
	stroke-width="4.5"
	stroke-linejoin="round"
	stroke-linecap="round"
>
	{#if tier <= 1}
		<!-- Rowboat: tiny open hull with two oars -->
		<path d="M38 62 L20 80 M62 62 L80 80" fill="none" />
		<path d="M30 62 H70 L64 76 H36 Z" fill={hull} />
		<path d="M44 62 V69 M56 62 V69" fill="none" />
	{:else if tier === 2}
		<!-- Fishing Boat: small cabin, mast and a fishing rod -->
		<path d="M34 64 V34 L68 56" fill="none" />
		<rect x="50" y="48" width="16" height="15" rx="2" fill={paper} />
		<path d="M24 63 H78 L71 77 H30 Z" fill={hull} />
	{:else if tier === 3}
		<!-- Tugboat: stubby hull, tall wheelhouse, big funnel and a tire bumper -->
		<rect x="47" y="22" width="11" height="16" fill={accent} />
		<rect x="38" y="37" width="28" height="23" rx="3" fill={paper} />
		<rect x="44" y="42" width="7" height="7" fill={glass} stroke-width="3" />
		<rect x="54" y="42" width="7" height="7" fill={glass} stroke-width="3" />
		<path d="M20 60 H82 L75 78 H27 Z" fill={hull} />
		<circle cx="27" cy="67" r="5" fill={sand} />
	{:else if tier === 4}
		<!-- Ferry: long boxy hull with two passenger decks and a row of windows -->
		<rect x="32" y="34" width="36" height="12" rx="2" fill={paper} />
		<rect x="20" y="45" width="60" height="14" rx="2" fill={paper} />
		{#each [27, 37, 47, 57, 67] as x (x)}
			<circle cx={x + 3} cy="52" r="2.6" fill={glass} stroke-width="2.5" />
		{/each}
		<path d="M14 58 H86 L80 76 H20 Z" fill={hull} />
	{:else if tier === 5}
		<!-- Cargo Ship: stacked containers and a bridge tower at the stern -->
		<rect x="14" y="46" width="15" height="12" fill={accent} stroke-width="3.5" />
		<rect x="29" y="46" width="15" height="12" fill={khaki} stroke-width="3.5" />
		<rect x="44" y="46" width="15" height="12" fill={sand} stroke-width="3.5" />
		<rect x="21" y="35" width="15" height="11" fill={sand} stroke-width="3.5" />
		<rect x="36" y="35" width="15" height="11" fill={accent} stroke-width="3.5" />
		<rect x="66" y="28" width="15" height="30" rx="2" fill={paper} />
		<rect x="70" y="33" width="7" height="6" fill={glass} stroke-width="3" />
		<path d="M8 58 H92 L86 77 H16 Z" fill={hull} />
	{:else if tier === 6}
		<!-- Oil Tanker: long, low hull with deck domes, a pipeline and a stern bridge -->
		<rect x="77" y="28" width="7" height="12" fill={accent} />
		<rect x="70" y="39" width="17" height="21" rx="2" fill={paper} />
		<rect x="74" y="44" width="9" height="6" fill={glass} stroke-width="3" />
		<path d="M18 56 H66" fill="none" stroke-width="3.5" />
		{#each [24, 38, 52] as x (x)}
			<path d="M{x - 6} 60 A6 6 0 0 1 {x + 6} 60 Z" fill={sand} stroke-width="3.5" />
		{/each}
		<path d="M5 60 H95 L90 76 H11 Z" fill={hull} />
	{:else if tier === 7}
		<!-- Supertanker: very long, tall hull with a band, four domes and a striped funnel -->
		<rect x="80" y="17" width="9" height="15" fill={paper} />
		<path d="M80 23 H89" fill="none" />
		<rect x="74" y="31" width="19" height="23" rx="2" fill={paper} />
		<rect x="78" y="36" width="11" height="6" fill={glass} stroke-width="3" />
		{#each [14, 28, 42, 56] as x (x)}
			<path d="M{x - 6} 54 A6 6 0 0 1 {x + 6} 54 Z" fill={sand} stroke-width="3.5" />
		{/each}
		<path d="M2 54 H98 L93 80 H8 Z" fill={hull} />
		<path d="M5 66 H96" fill="none" stroke-width="3.5" />
	{:else}
		<!-- Mega-Tanker: the biggest hull, twin funnels, a huge bridge and a cartoon crown -->
		<path d="M68 16 L68 6 L74 11 L79 4 L84 11 L90 6 L90 16 Z" fill={accent} />
		<rect x="67" y="16" width="24" height="30" rx="2" fill={paper} />
		<rect x="71" y="21" width="7" height="7" fill={glass} stroke-width="3" />
		<rect x="80" y="21" width="7" height="7" fill={glass} stroke-width="3" />
		<rect x="46" y="26" width="8" height="20" fill={accent} />
		<rect x="56" y="30" width="8" height="16" fill={accent} />
		{#each [10, 23, 36] as x (x)}
			<path d="M{x - 6} 46 A6 6 0 0 1 {x + 6} 46 Z" fill={sand} stroke-width="3.5" />
		{/each}
		<path d="M1 46 H99 L94 84 H7 Z" fill={hull} />
		<path d="M4 58 H97 M6 70 H95" fill="none" stroke-width="3.5" />
	{/if}
</svg>
