<!--
	Top-down silhouette of one ship class of the Black Sea Fleet Hunt, with its own colour and deck
	layout so the classes are easy to tell apart: the long grey Moskva with red missile tubes, the
	blunt khaki Ropucha with its vehicle deck, the black Kilo submarine, the mustard Buyan-M and the
	small Tarantul. The bow points to the ship's first cell (left, or up when vertical). A sunk
	ship gets cracks across its hull.
-->
<script lang="ts">
	import { SHIP_CLASSES, type ShipClass } from '#lib/game/fleethunt/fleet.js';

	let {
		shipClass,
		vertical = false,
		sunk = false,
		class: className = ''
	}: {
		shipClass: ShipClass;
		vertical?: boolean;
		sunk?: boolean;
		class?: string;
	} = $props();

	const length = $derived(SHIP_CLASSES[shipClass].length * 100);
</script>

<svg
	viewBox={vertical ? `0 0 100 ${length}` : `0 0 ${length} 100`}
	class={className}
	aria-hidden="true"
	stroke="#111111"
	stroke-width="5"
	stroke-linejoin="round"
>
	<g transform={vertical ? 'translate(100 0) rotate(90)' : undefined}>
		{#if shipClass === 'moskva'}
			<path
				d="M10 50 L75 16 L470 16 Q492 16 492 38 L492 62 Q492 84 470 84 L75 84 Z"
				fill="var(--color-banner-slate)"
			/>
			<rect x="200" y="30" width="130" height="40" rx="6" fill="var(--color-paper)" />
			<circle cx="265" cy="50" r="10" fill="var(--color-banner-slate)" />
			{#each [100, 140, 360, 400] as x (x)}
				<circle cx={x} cy="34" r="9" fill="var(--color-tie-red)" />
				<circle cx={x} cy="66" r="9" fill="var(--color-tie-red)" />
			{/each}
		{:else if shipClass === 'ropucha'}
			<path
				d="M14 32 Q14 14 36 14 L378 14 Q392 14 392 30 L392 70 Q392 86 378 86 L36 86 Q14 86 14 68 Z"
				fill="var(--color-khaki)"
			/>
			<rect x="48" y="30" width="200" height="40" rx="4" fill="var(--color-sand)" />
			{#each [88, 128, 168, 208] as x (x)}
				<line x1={x} y1="30" x2={x} y2="70" stroke-width="3" />
			{/each}
			<rect x="276" y="26" width="86" height="48" rx="6" fill="var(--color-paper)" />
		{:else if shipClass === 'kilo'}
			<rect x="12" y="28" width="270" height="44" rx="22" fill="var(--color-ink)" />
			<path d="M282 50 L294 30 M282 50 L294 70" stroke-width="7" stroke-linecap="round" />
			<ellipse cx="120" cy="50" rx="38" ry="12" fill="var(--color-banner-slate)" />
		{:else if shipClass === 'buyan'}
			<path
				d="M8 50 L62 20 L278 20 Q292 20 292 34 L292 66 Q292 80 278 80 L62 80 Z"
				fill="var(--color-mustard)"
			/>
			<circle cx="80" cy="50" r="12" fill="var(--color-ink)" />
			<rect x="130" y="32" width="96" height="36" rx="6" fill="var(--color-paper)" />
		{:else}
			<path
				d="M8 50 L52 22 L184 22 Q194 22 194 34 L194 66 Q194 78 184 78 L52 78 Z"
				fill="var(--color-skin)"
			/>
			<circle cx="62" cy="50" r="10" fill="var(--color-ink)" />
			<rect x="92" y="35" width="60" height="30" rx="5" fill="var(--color-paper)" />
		{/if}
		{#if sunk}
			{#each Array.from({ length: length / 100 }, (_, index) => index * 100 + 50) as x (x)}
				<path
					d="M{x - 18} 18 L{x - 4} 42 L{x - 14} 56 L{x + 8} 84"
					fill="none"
					stroke-width="6"
					stroke-linecap="round"
				/>
			{/each}
		{/if}
	</g>
</svg>
