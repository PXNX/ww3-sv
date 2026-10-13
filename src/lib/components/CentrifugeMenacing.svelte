<!--
	The purple menacing "ゴゴゴ" from the meme, shown while a scare is running. Drawn as paths so it
	does not depend on a Japanese font being installed. Each glyph trembles on its own beat (held
	still with reduced motion). Pure decoration.
-->
<script lang="ts">
	let { still = false, class: className = '' }: { still?: boolean; class?: string } = $props();

	/** One ゴ: a square bracket and two small ticks, outlined first, then filled */
	const GLYPH = 'M10 12 H46 V58 H10 M54 4 L60 18 M64 2 L70 16';
	const glyphs = [
		{ x: 4, y: 4, scale: 1, tilt: -6, delay: 0 },
		{ x: 26, y: 78, scale: 1.2, tilt: 4, delay: -90 },
		{ x: 6, y: 168, scale: 1, tilt: -3, delay: -45 }
	];
</script>

<svg viewBox="0 0 110 260" aria-hidden="true" class={className}>
	{#each glyphs as glyph, index (index)}
		<g transform="translate({glyph.x} {glyph.y}) rotate({glyph.tilt}) scale({glyph.scale})">
			<g class:tremble={!still} style:animation-delay="{glyph.delay}ms">
				<path
					d={GLYPH}
					fill="none"
					stroke="#111"
					stroke-width="15"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
				<path
					d={GLYPH}
					fill="none"
					stroke="#8b4fe0"
					stroke-width="8"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
			</g>
		</g>
	{/each}
</svg>

<style>
	.tremble {
		animation: tremble 110ms steps(2, jump-none) infinite alternate;
	}

	@keyframes tremble {
		from {
			transform: translate(-2px, 1px);
		}
		to {
			transform: translate(2px, -1px);
		}
	}
</style>
