<!--
	Original cartoon port badges: a colored disc with a harbor symbol on it (crane, temple, anchor,
	windmill, lighthouse, sailboat, containers, ship wheel, palm). Each port always gets the same
	badge, so the two ends of a route match by shape as well as by color. It renders an <svg>, so
	it can sit in a page or, with x/y/width/height, inside the board's own <svg>.
-->
<script lang="ts">
	import type { SVGAttributes } from 'svelte/elements';

	let { glyph, color, ...rest }: { glyph: number; color: string } & SVGAttributes<SVGSVGElement> =
		$props();

	const SPOKES = [0, 45, 90, 135];
</script>

<svg viewBox="0 0 24 24" aria-hidden="true" {...rest}>
	<circle cx="12" cy="12" r="11" fill={color} stroke="var(--color-ink)" stroke-width="1.8" />
	<g
		fill="var(--color-paper)"
		stroke="var(--color-ink)"
		stroke-width="1.3"
		stroke-linejoin="round"
		stroke-linecap="round"
	>
		{#if glyph === 0}
			<!-- Gantry crane -->
			<rect x="5.5" y="17" width="13" height="2" />
			<rect x="7" y="7" width="2.4" height="10" />
			<path d="M6 7h13v2.4H6z" />
			<path d="M16.5 9.4v4" fill="none" />
			<rect x="15" y="13.4" width="3" height="2.2" />
		{:else if glyph === 1}
			<!-- Temple -->
			<path d="M12 4.8L4.8 10h14.4z" />
			<rect x="6.2" y="11" width="2.6" height="6" />
			<rect x="10.7" y="11" width="2.6" height="6" />
			<rect x="15.2" y="11" width="2.6" height="6" />
			<rect x="4.8" y="17" width="14.4" height="2.2" />
		{:else if glyph === 2}
			<!-- Anchor -->
			<circle cx="12" cy="6.6" r="1.7" />
			<path d="M12 8.4V18" fill="none" />
			<path d="M8.4 10.8h7.2" fill="none" />
			<path d="M6.2 13.4Q7.4 19 12 18.4Q16.6 19 17.8 13.4" fill="none" />
		{:else if glyph === 3}
			<!-- Windmill -->
			<path d="M10.4 12h3.2l1 7H9.4z" />
			<g transform="rotate(30 12 11)">
				<rect x="11.1" y="3.8" width="1.8" height="14.4" />
				<rect x="4.8" y="10.1" width="14.4" height="1.8" />
			</g>
			<circle cx="12" cy="11" r="1.2" />
		{:else if glyph === 4}
			<!-- Lighthouse -->
			<path d="M9.8 8.4h4.4l1 10.6H8.8z" />
			<path d="M9.4 13h5.2" fill="none" />
			<rect x="9.6" y="5.6" width="4.8" height="2.8" />
			<path d="M12 3.2l-3 2.4h6z" />
		{:else if glyph === 5}
			<!-- Sailboat -->
			<path d="M4.8 16.2h14.4l-2.6 3H7.4z" />
			<path d="M12 4.2v12" fill="none" />
			<path d="M12.8 5.4L18 14.6h-5.2z" />
			<path d="M11.2 7.6L6.8 14.6h4.4z" />
		{:else if glyph === 6}
			<!-- Container stack -->
			<rect x="4.8" y="14" width="7" height="4.4" />
			<rect x="12.2" y="14" width="7" height="4.4" />
			<rect x="8.5" y="9.4" width="7" height="4.4" />
			<path d="M7.2 14v4.4M9.6 14v4.4M14.6 14v4.4M17 14v4.4M11 9.4v4.4M13.4 9.4v4.4" fill="none" />
		{:else if glyph === 7}
			<!-- Ship wheel -->
			{#each SPOKES as angle (angle)}
				<rect
					x="11.2"
					y="3.8"
					width="1.6"
					height="16.4"
					rx="0.8"
					transform="rotate({angle} 12 12)"
				/>
			{/each}
			<circle cx="12" cy="12" r="5.2" fill="none" />
			<circle cx="12" cy="12" r="1.8" />
		{:else}
			<!-- Palm tree -->
			<path d="M11 19Q11.4 13.4 13 9.2" fill="none" stroke-width="2.4" />
			<path d="M13 9.2Q9 5.4 5 8.4Q9 7.6 13 9.2Z" />
			<path d="M13 9.2Q13 4.2 18 5Q15 6.2 13 9.2Z" />
			<path d="M13 9.2Q17.6 6.8 19.8 10.6Q16.4 8.8 13 9.2Z" />
			<path d="M13 9.2Q8 9.4 6.6 13.4Q9.8 10.6 13 9.2Z" />
			<path d="M5.8 19.2h12.4" fill="none" />
		{/if}
	</g>
</svg>
