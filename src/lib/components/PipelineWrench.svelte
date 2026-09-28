<!-- The oversized wrench: a generic placeholder shape, usable inside another SVG or on its own -->
<script lang="ts">
	let {
		x = 0,
		y = 0,
		size = 100,
		standalone = false,
		class: className = ''
	}: { x?: number; y?: number; size?: number; standalone?: boolean; class?: string } = $props();
</script>

{#snippet shape()}
	<g transform="rotate(45 50 50)" stroke="#111111" stroke-width="6" stroke-linejoin="round">
		<rect x="41" y="38" width="18" height="58" rx="7" fill="#aeb4be" />
		<path d="M59 6 A20 20 0 1 1 41 6 L41 20 L59 20 Z" fill="#aeb4be" />
	</g>
{/snippet}

{#if standalone}
	<svg viewBox="0 0 100 100" class={className} aria-hidden="true">{@render shape()}</svg>
{:else}
	<svg {x} {y} width={size} height={size} viewBox="0 0 100 100">{@render shape()}</svg>
{/if}
