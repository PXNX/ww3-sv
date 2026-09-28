<!--
	Generic olive flatbed truck in the freeonis style (side view, facing right), without any
	markings or insignia. With `broken`, the front tyre is flat and the bonnet is steaming.
-->
<svelte:options namespace="svg" />

<script lang="ts">
	let { x, y, broken = false }: { x: number; y: number; broken?: boolean } = $props();
</script>

<g transform="translate({x} {y})" stroke="#2B2B2B" stroke-width="3" stroke-linejoin="round">
	<!-- chassis -->
	<rect x="10" y="66" width="178" height="12" fill="#3D4A2A" />
	<!-- flatbed with slats -->
	<rect x="6" y="38" width="116" height="30" fill="#7B7F4E" />
	<path d="M8 48 H120 M8 58 H120" fill="none" stroke-width="1.5" />
	<path d="M30 38 V68 M56 38 V68 M82 38 V68 M106 38 V68" fill="none" stroke-width="2" />
	<!-- cab -->
	<path d="M122 78 V22 Q122 12 132 12 H166 Q174 12 178 22 L190 50 V78 Z" fill="#6E8B3D" />
	<path d="M131 20 H164 L175 44 H131 Z" fill="#CFDCDC" />
	<path d="M146 20 V44" fill="none" stroke-width="2" />
	<path d="M131 52 H142" fill="none" stroke-width="2" />
	<circle cx="185" cy="58" r="4" fill="#FFFFFF" />
	<rect x="176" y="76" width="18" height="6" rx="2" fill="#444444" />
	<!-- wheels -->
	<circle cx="44" cy="84" r="16" fill="#2B2B2B" />
	<circle cx="44" cy="84" r="7" fill="#6E8B3D" />
	{#if broken}
		<ellipse cx="158" cy="89" rx="18" ry="11" fill="#2B2B2B" />
		<ellipse cx="158" cy="88" rx="7" ry="5" fill="#6E8B3D" />
	{:else}
		<circle cx="158" cy="84" r="16" fill="#2B2B2B" />
		<circle cx="158" cy="84" r="7" fill="#6E8B3D" />
	{/if}
</g>

{#if broken}
	<g class="steam" fill="#D9D9D9" stroke="none">
		<circle cx={x + 186} cy={y + 10} r="10" />
		<circle cx={x + 198} cy={y - 4} r="13" />
		<circle cx={x + 214} cy={y - 18} r="9" />
	</g>
{/if}

<style>
	.steam {
		animation: steam 2.4s ease-in-out infinite alternate;
	}

	@keyframes steam {
		to {
			translate: 6px -6px;
			opacity: 0.6;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.steam {
			animation: none;
		}
	}
</style>
