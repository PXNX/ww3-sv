<!--
	Start screen hero: a map-like cartoon strait (pale land, light blue water with a grey coastline,
	as in the freeonis artwork) with tankers sailing through a narrow channel between sea mines.
	Purely decorative.
-->
<script lang="ts">
	import Cloud from './Cloud.svelte';

	const LAND = '#FBEFB4';
	const WATER = '#8FD3E6';
	const COAST = '#777777';

	// Upper and lower coastline, narrowest in the middle (the chokepoint)
	const water =
		'M-10 66 C 60 70 110 96 170 102 S 240 100 280 86 S 360 66 410 70 ' +
		'V 160 C 360 156 310 146 260 140 S 200 128 160 134 S 70 156 -10 158 Z';

	const tufts = [
		[30, 28],
		[92, 40],
		[210, 30],
		[330, 38],
		[60, 196],
		[180, 190],
		[300, 200],
		[372, 184]
	];

	const mines = [
		{ x: 150, y: 128, delay: 0 },
		{ x: 238, y: 104, delay: 0.6 },
		{ x: 318, y: 138, delay: 1.2 }
	];
</script>

<svg viewBox="0 0 400 220" class="block h-auto w-full" aria-hidden="true" data-playfield>
	<rect width="400" height="220" fill={LAND} />
	{#each tufts as [x, y], index (index)}
		<path d="M{x} {y} l2 -6 M{x + 6} {y} l-2 -6" stroke="#CDBF7A" stroke-width="2" />
	{/each}

	<path d={water} fill={WATER} stroke={COAST} stroke-width="8" stroke-linejoin="round" />
	<path
		d="M20 120 q10 -4 20 0 M300 112 q10 -4 20 0 M110 132 q10 -4 20 0"
		stroke="#FFFFFF"
		stroke-width="2.5"
		fill="none"
		stroke-linecap="round"
		opacity="0.8"
	/>

	{#each mines as mine, index (index)}
		<g class="bob" style:animation-delay="{mine.delay}s">
			<g stroke="#2B2B2B" stroke-width="2.5" stroke-linecap="round">
				<path
					d="M{mine.x} {mine.y - 11} v-4 M{mine.x} {mine.y + 11} v4 M{mine.x -
						11} {mine.y} h-4 M{mine.x + 11} {mine.y} h4 M{mine.x - 8} {mine.y - 8} l-3 -3 M{mine.x +
						8} {mine.y + 8} l3 3 M{mine.x + 8} {mine.y - 8} l3 -3 M{mine.x - 8} {mine.y + 8} l-3 3"
				/>
				<circle cx={mine.x} cy={mine.y} r="9" fill="#E5484D" />
			</g>
			<circle cx={mine.x - 3} cy={mine.y - 3} r="2" fill="#FFFFFF" />
		</g>
	{/each}

	{#each [0, 1] as tanker (tanker)}
		<g class="sail" style:animation-delay="{tanker * -6}s">
			<g stroke="#2B2B2B" stroke-width="2.5" stroke-linejoin="round">
				<rect x="6" y="102" width="12" height="8" fill="#FFFFFF" />
				<rect x="9" y="96" width="5" height="6" fill="#E5484D" />
				<path d="M0 110 H46 L41 121 H6 Z" fill="#2B2F36" />
			</g>
			<text
				x="26"
				y="119"
				text-anchor="middle"
				font-size="7"
				font-weight="900"
				fill="#FFFFFF"
				font-family="system-ui, sans-serif">OIL</text
			>
		</g>
	{/each}

	<Cloud x={40} y={8} width={54} />
	<Cloud x={290} y={170} width={46} />
</svg>

<style>
	.sail {
		animation: sail 12s linear infinite;
	}

	@keyframes sail {
		from {
			translate: -60px 0;
		}
		to {
			translate: 420px 0;
		}
	}

	.bob {
		animation: bob 2.2s ease-in-out infinite alternate;
	}

	@keyframes bob {
		to {
			translate: 0 3px;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.sail {
			animation: none;
			translate: 170px 0;
		}

		.sail + .sail {
			translate: 40px 0;
		}

		.bob {
			animation: none;
		}
	}
</style>
