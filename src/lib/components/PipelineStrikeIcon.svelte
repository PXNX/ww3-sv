<!--
	Generic placeholder strike shapes: a plain delta-wing drone and a plain rocket, both pointing
	down at their target. Machines only, with no markings of any kind.
-->
<script lang="ts">
	import type { StrikeKind } from '$lib/game/pipeline/strikes';

	let { kind, class: className = '' }: { kind: StrikeKind; class?: string } = $props();
</script>

<svg viewBox="0 0 100 100" class={className} aria-hidden="true">
	<g stroke="#111111" stroke-width="6" stroke-linejoin="round">
		{#if kind === 'drone'}
			<path d="M50 92 L90 30 L50 42 L10 30 Z" fill="#aeb4be" />
			<path d="M50 42 L50 92" fill="none" stroke-width="4" />
			<rect x="38" y="10" width="24" height="10" rx="3" fill="#7c8c5c" />
			<path d="M50 20 V42" fill="none" />
		{:else}
			<path d="M50 94 L36 72 V16 H64 V72 Z" fill="#ffffff" />
			<path d="M36 26 L20 8 V30 Z M64 26 L80 8 V30 Z" fill="#7c8c5c" />
			<path d="M36 56 H64" fill="none" stroke-width="4" />
			<path d="M42 16 L50 2 L58 16 Z" fill="#f5c83a" />
		{/if}
	</g>
</svg>
