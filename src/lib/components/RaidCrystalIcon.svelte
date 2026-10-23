<!--
	A raid crystal: a cut gem in its kind's colour (damage red, critical yellow, fire rate blue,
	status orange) ringed in its rarity's colour, as it lies on the battlefield
-->
<script lang="ts">
	import {
		CRYSTAL_COLOR,
		RARITY_COLOR,
		type CrystalKind,
		type Rarity
	} from '#lib/game/raid/config.js';

	let {
		kind,
		rarity,
		class: className = 'size-8'
	}: { kind: CrystalKind; rarity: Rarity; class?: string } = $props();
</script>

<svg viewBox="0 0 48 48" class={className} aria-hidden="true">
	<circle cx="24" cy="24" r="20" fill="#fff" stroke={RARITY_COLOR[rarity]} stroke-width="5" />
	<path
		d="M24 9 L36 20 L31 38 H17 L12 20 Z"
		fill={CRYSTAL_COLOR[kind]}
		stroke="#111"
		stroke-width="2.5"
		stroke-linejoin="round"
	/>
	<path d="M24 9 L28 20 H12 Z" fill="#fff" opacity="0.55" />
	<path d="M12 20 H36 M24 20 L24 38" stroke="#111" stroke-width="1.2" opacity="0.4" fill="none" />
</svg>
