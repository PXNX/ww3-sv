<!--
	Original cartoon documents of the Bureaucracy Maze: two rubber stamps, a wax seal, two forms and
	the Passierschein B-38 itself. Each has its own shape and color. It renders an <svg>, so it can
	sit in a page or, with x/y/width/height, inside the maze's own <svg>.
-->
<script lang="ts">
	import type { SVGAttributes } from 'svelte/elements';
	import { ITEM_COLORS } from '#lib/game/maze/items.js';
	import type { ItemKind } from '#lib/game/maze/maze.js';

	let { kind, ...rest }: { kind: ItemKind | 'permit' } & SVGAttributes<SVGSVGElement> = $props();

	const color = $derived(ITEM_COLORS[kind]);
</script>

<svg viewBox="0 0 24 24" aria-hidden="true" {...rest}>
	<g
		stroke="var(--color-ink)"
		stroke-width="1.6"
		stroke-linejoin="round"
		stroke-linecap="round"
		fill={color}
	>
		{#if kind === 'entry-stamp' || kind === 'approval-stamp'}
			<!-- Rubber stamp: knob, neck, base and an ink pad line below -->
			<rect x="8.5" y="2.5" width="7" height="8" rx="3.5" />
			<rect x="10.5" y="10" width="3" height="4.5" fill="var(--color-paper)" />
			<rect x="4" y="14.5" width="16" height="5" rx="1.5" />
			<path d="M4 22h16" fill="none" />
			{#if kind === 'approval-stamp'}
				<path d="M10.4 6.4l1.4 1.5 2.4-3" fill="none" stroke="var(--color-paper)" />
			{:else}
				<path d="M10.5 6.3h3" fill="none" stroke="var(--color-paper)" />
			{/if}
		{:else if kind === 'seal'}
			<!-- Wax seal with two ribbon tails -->
			<path d="M8.5 15.5l-2 6.5 4-2 2 2.3 1-6.3z" fill="var(--color-paper)" />
			<circle cx="12" cy="10" r="8" />
			<circle cx="12" cy="10" r="4.8" fill="none" stroke-width="1.2" />
			<path
				d="M12 6.8l1 2.1 2.3.3-1.7 1.6.4 2.3-2-1.1-2 1.1.4-2.3-1.7-1.6 2.3-.3z"
				fill="var(--color-paper)"
				stroke-width="1"
			/>
		{:else if kind === 'form-27b'}
			<!-- Form with a tick box and lines -->
			<path d="M5.5 2.5h9.5l4 4v15h-13.5z" fill="var(--color-paper)" />
			<path d="M15 2.5v4h4" fill="none" />
			<rect x="8" y="8.5" width="3.4" height="3.4" fill={color} stroke-width="1.2" />
			<path d="M13 10.2h3.5M8 15h8.5M8 18h6" fill="none" stroke-width="1.3" />
		{:else if kind === 'form-annex'}
			<!-- Annex form held by a paper clip -->
			<path d="M5.5 4.5h9.5l4 4v13h-13.5z" fill="var(--color-paper)" />
			<path d="M15 4.5v4h4" fill="none" />
			<path d="M8 13h8.5M8 16h8.5M8 19h5" fill="none" stroke-width="1.3" />
			<path d="M9.5 8.5v-6a2 2 0 0 1 4 0v7" fill="none" stroke="var(--color-ink)" />
			<path d="M9.5 8.5v-6a2 2 0 0 1 4 0v7" fill="none" stroke={color} stroke-width="0.8" />
		{:else}
			<!-- Passierschein B-38: a big permit with a ribbon rosette -->
			<path d="M3.5 2.5h14l3 3v15h-17z" fill="var(--color-paper)" />
			<path d="M17.5 2.5v3h3" fill="none" />
			<text
				x="11.2"
				y="9.6"
				text-anchor="middle"
				font-size="6"
				font-weight="800"
				fill="var(--color-ink)"
				stroke="none">B-38</text
			>
			<path d="M6.5 12.2h9M6.5 15h6" fill="none" stroke-width="1.3" />
			<circle cx="16.5" cy="17.5" r="4" />
			<path d="M14.8 20.8l-.8 3 2.5-1.4 2.5 1.4-.8-3" fill={color} stroke-width="1.2" />
		{/if}
	</g>
</svg>
