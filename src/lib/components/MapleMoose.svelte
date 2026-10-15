<!--
	A cartoon moose guard, drawn in one cell of 40 units. It faces left or right (mirrored by
	scaling), and the boss wears a tiny tariff hat. Original art, flat colours, thick outlines.
-->
<script lang="ts">
	let { facing, boss = false }: { facing: 'left' | 'right'; boss?: boolean } = $props();
</script>

<g
	stroke="var(--color-ink)"
	stroke-width="2"
	stroke-linecap="round"
	stroke-linejoin="round"
	transform={facing === 'left' ? 'translate(40 0) scale(-1 1)' : undefined}
>
	<!-- Antlers -->
	<path d="M20 12 L15 4 M17 8 L12 7 M24 12 L29 3 M27 7 L32 6" fill="none" stroke-width="2.5" />
	<!-- Body, head and snout -->
	<ellipse cx="17" cy="26" rx="12" ry="8" fill="#6b4423" />
	<rect x="12" y="34" width="3" height="5" fill="#4a2f17" />
	<rect x="21" y="34" width="3" height="5" fill="#4a2f17" />
	<ellipse cx="27" cy="19" rx="7" ry="6" fill="#8a5a2b" />
	<ellipse cx="33" cy="22" rx="5" ry="4" fill="#a8743a" />
	<circle cx="26" cy="17" r="1.6" fill="var(--color-ink)" stroke="none" />
	<circle cx="35" cy="21" r="1" fill="var(--color-ink)" stroke="none" />
	{#if boss}
		<!-- The tiny tariff hat, red band and all -->
		<path d="M21 13 L26 5 L31 13 Z" fill="var(--color-paper)" />
		<path d="M21.5 11.5 H30.5" fill="none" stroke="var(--color-tie-red)" stroke-width="2" />
	{/if}
</g>
