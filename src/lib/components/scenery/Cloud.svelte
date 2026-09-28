<!-- Flat white cloud without an outline, flat along the bottom -->
<svelte:options namespace="svg" />

<script lang="ts">
	let { x, y, width = 60 }: { x: number; y: number; width?: number } = $props();
	const s = $derived(width / 60);
</script>

<path
	transform="translate({x} {y}) scale({s})"
	d="M0 20 Q0 12 8 11 Q10 2 20 3 Q26 -6 36 0 Q44 -2 46 7 Q58 7 60 20 Z"
	fill="#FFFFFF"
/>
