<!--
	One memory module (a RAM stick) for the Stage B board. The bigger the tier, the more chips sit on
	the green circuit board, so the size reads without relying on color or on the label alone.
-->
<script lang="ts">
	let { tier, class: className = '' }: { tier: number; class?: string } = $props();

	// 1 chip at 4 GB up to 6 chips from 128 GB on
	const chips = $derived(Math.min(6, 1 + Math.floor((Math.max(1, tier) - 1) * 0.65)));
	const chipWidth = $derived(78 / chips - 4);
	const pins = Array.from({ length: 11 }, (_, index) => index);
</script>

<svg viewBox="0 0 100 60" class={className} aria-hidden="true">
	<rect
		x="4"
		y="4"
		width="92"
		height="38"
		rx="4"
		fill="#2f9e5f"
		stroke="#111111"
		stroke-width="4"
		stroke-linejoin="round"
	/>
	{#each { length: chips }, index (index)}
		<rect
			x={11 + index * (78 / chips + 0.5)}
			y="12"
			width={chipWidth}
			height="22"
			rx="2"
			fill="#2b2b33"
			stroke="#111111"
			stroke-width="2.5"
		/>
	{/each}
	{#each pins as pin (pin)}
		<rect
			x={8 + pin * 8}
			y="45"
			width="5"
			height="10"
			fill={pin === 5 ? 'none' : '#f5c83a'}
			stroke={pin === 5 ? 'none' : '#111111'}
			stroke-width="2"
		/>
	{/each}
</svg>
