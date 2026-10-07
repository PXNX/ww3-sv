<!--
	A chess piece as a solid, filled cartoon silhouette: one thick ink outline around the whole
	shape (so overlapping parts leave no seams), the team color inside, and a few ink details. The
	lucide chess icons are open line drawings, so they cannot be filled properly. Your pieces are
	white, Putin's are red.
-->
<script lang="ts">
	import type { Color, PieceType } from '#lib/game/chess/chess.js';

	let {
		type,
		color,
		class: className = ''
	}: { type: PieceType; color: Color; class?: string } = $props();

	interface Drawing {
		/** Closed shapes that make up the body; their union gets the outline */
		shapes: string[];
		/** Ink lines drawn on top of the fill */
		details?: string[];
		/** Ink dots (eyes and the like) as [x, y, radius] */
		dots?: [number, number, number][];
	}

	// Every piece stands on the same rounded base
	const BASE =
		'M5.6 19.2h12.8a1.1 1.1 0 0 1 1.1 1.1v1.2a1.1 1.1 0 0 1-1.1 1.1H5.6a1.1 1.1 0 0 1-1.1-1.1v-1.2a1.1 1.1 0 0 1 1.1-1.1z';

	const DRAWINGS: Record<PieceType, Drawing> = {
		p: {
			shapes: [
				BASE,
				'M12 3.6a3.4 3.4 0 1 1 0 6.8a3.4 3.4 0 1 1 0-6.8z',
				'M8.4 10.2h7.2a.9.9 0 0 1 .9.9v.1a.9.9 0 0 1-.9.9H8.4a.9.9 0 0 1-.9-.9v-.1a.9.9 0 0 1 .9-.9z',
				'M9.4 12.2h5.2c.2 2.6 1.2 4.6 2.6 7H6.8c1.4-2.4 2.4-4.4 2.6-7z'
			]
		},
		r: {
			shapes: [
				BASE,
				'M6.3 3.2h3.1v2.3h1.4V3.2h2.4v2.3h1.4V3.2h3.1v6l-1.9 1.6v6.4l2.3 2H5.8l2.3-2v-6.4L6.3 9.2z'
			],
			details: ['M8.1 12.6h7.8']
		},
		b: {
			shapes: [
				BASE,
				'M12 2.2a1.5 1.5 0 1 1 0 3a1.5 1.5 0 1 1 0-3z',
				'M12 5c-3.1 2.5-4.8 5-4.8 7.4 0 1.7 1.1 2.8 2.6 3.3L8.9 19.2h6.2l-.9-3.5c1.5-.5 2.6-1.6 2.6-3.3 0-2.4-1.7-4.9-4.8-7.4z'
			],
			details: ['M12.8 8.2l2.1 2.7', 'M9.4 15.7h5.2']
		},
		n: {
			shapes: [
				BASE,
				'M6.6 19.2c-.1-3.4 1.2-5.9 3.6-7.7-1.9-.1-3.7-1-4.5-2.7l-.3-1.3 3.3-2.7.1-3.1 2.2 1.6c.7-.3 1.4-.4 2.2-.3 3.4.7 5.6 3.9 5.6 8.2v8z'
			],
			details: ['M6.2 9.2l1.4.5', 'M11.6 12.6c1.6-.6 2.6-1.7 3-3.2'],
			dots: [[10.6, 6.8, 0.85]]
		},
		q: {
			shapes: [
				BASE,
				'M4.4 8.4L7 17l1.3-7.8 2.1 7 1.6-10.2 1.6 10.2 2.1-7L17 17l2.6-8.6-1.1 10.8H5.5z',
				'M4.4 6a1.4 1.4 0 1 1 0 2.8a1.4 1.4 0 1 1 0-2.8z',
				'M8.3 6.8a1.4 1.4 0 1 1 0 2.8a1.4 1.4 0 1 1 0-2.8z',
				'M12 3.3a1.5 1.5 0 1 1 0 3a1.5 1.5 0 1 1 0-3z',
				'M15.7 6.8a1.4 1.4 0 1 1 0 2.8a1.4 1.4 0 1 1 0-2.8z',
				'M19.6 6a1.4 1.4 0 1 1 0 2.8a1.4 1.4 0 1 1 0-2.8z'
			],
			details: ['M7.6 16.2h8.8']
		},
		k: {
			shapes: [
				BASE,
				'M11 1.4h2v1.7h1.7v2H13v2.6h-2V5.1H9.3v-2H11z',
				'M12 7.2c-4.6 0-7.5 2.4-7.5 5.7 0 2 1.1 3.2 2.9 3.8l-.6 2.5h10.4l-.6-2.5c1.8-.6 2.9-1.8 2.9-3.8 0-3.3-2.9-5.7-7.5-5.7z'
			],
			details: ['M7.4 15.4h9.2']
		}
	};

	const drawing = $derived(DRAWINGS[type]);
	const fill = $derived(color === 'w' ? 'var(--color-paper)' : 'var(--color-tie-red)');
</script>

<svg viewBox="0 0 24 24" class={className} aria-hidden="true" overflow="visible">
	{#each drawing.shapes as d, index (index)}
		<path {d} class="edge" />
	{/each}
	{#each drawing.shapes as d, index (index)}
		<path {d} {fill} />
	{/each}
	{#each drawing.details ?? [] as d, index (index)}
		<path {d} class="detail" />
	{/each}
	{#each drawing.dots ?? [] as [cx, cy, r], index (index)}
		<circle {cx} {cy} {r} fill="var(--color-ink)" />
	{/each}
</svg>

<style>
	.edge {
		fill: var(--color-ink);
		stroke: var(--color-ink);
		stroke-width: 3.2;
		stroke-linejoin: round;
	}

	.detail {
		fill: none;
		stroke: var(--color-ink);
		stroke-width: 1.1;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
</style>
