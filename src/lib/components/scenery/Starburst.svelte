<!-- Flat freeonis-style explosion: yellow rays with red arrowhead tips, no outline -->
<svelte:options namespace="svg" />

<script lang="ts">
	import { starburst } from '$lib/theme/starburst';

	let {
		x,
		y,
		radius,
		animated = false
	}: { x: number; y: number; radius: number; animated?: boolean } = $props();

	const shapes = $derived(starburst(x, y, radius));
</script>

<g class:burst={animated} style:transform-origin="{x}px {y}px">
	{#each shapes.rays as ray, index (index)}
		<polygon points={ray} fill="#F5C83A" />
	{/each}
	{#each shapes.sparks as spark, index (index)}
		<polygon points={spark} fill="#F5C83A" />
	{/each}
	{#each shapes.tips as tip, index (index)}
		<polygon points={tip} fill="#E5484D" />
	{/each}
</g>

<style>
	.burst {
		animation: burst 1.8s var(--ease-spring) infinite;
	}

	@keyframes burst {
		0%,
		15% {
			scale: 0.2;
			opacity: 0;
		}
		35% {
			scale: 1.1;
			opacity: 1;
		}
		70% {
			scale: 1;
			opacity: 1;
		}
		100% {
			scale: 1.15;
			opacity: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.burst {
			animation: none;
		}
	}
</style>
