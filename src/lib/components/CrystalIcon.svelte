<!-- A faceted gem in the colour of its crystal type -->
<script lang="ts">
	import { CRYSTAL_COLORS, type CrystalType } from '#lib/game/beachhead/crystals.js';

	let { type, class: className = 'size-6' }: { type: CrystalType; class?: string } = $props();
	const color = $derived(CRYSTAL_COLORS[type]);
</script>

<svg class={className} viewBox="0 0 24 24" aria-hidden="true" stroke-linejoin="round">
	<path d="M12 2 20 9 12 22 4 9Z" fill={color} stroke="#111" stroke-width="1.6" />
	<path d="M4 9h16L12 22Z" fill="#000" opacity="0.22" />
	<path d="M12 2 9 9h6Z" fill="#fff" opacity="0.5" />
	<path d="M4 9 9 9 12 22Z" fill="#fff" opacity="0.18" />
	<path d="M12 2 20 9 12 22 4 9Z" fill="none" stroke="#111" stroke-width="1.6" />
</svg>
