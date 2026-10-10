<!--
	The dial: a gauge with a safe band in the middle, red at both ends and a needle that swings
	with the drift. Behind the needle a little rotor spins (still, with reduced motion). The
	gauge is drawn in a fixed viewBox and scales with its container.
-->
<script lang="ts">
	import { BAND } from '#lib/game/centrifuge/config.js';

	let {
		value,
		spinning = true,
		reducedMotion = false,
		label,
		class: className = ''
	}: {
		/** Needle position, -1 to 1 */
		value: number;
		spinning?: boolean;
		reducedMotion?: boolean;
		label: string;
		class?: string;
	} = $props();

	const CENTER = 100;
	const RADIUS = 70;
	/** Degrees of needle travel from the middle to either end of the dial */
	const SWEEP = 120;

	function point(angle: number, radius: number) {
		const radians = (angle * Math.PI) / 180;
		return { x: CENTER + radius * Math.sin(radians), y: CENTER - radius * Math.cos(radians) };
	}

	/** An arc along the dial from one dial value to another (both -1..1) */
	function arc(from: number, to: number, radius = RADIUS): string {
		const start = point(from * SWEEP, radius);
		const end = point(to * SWEEP, radius);
		return `M${start.x.toFixed(2)} ${start.y.toFixed(2)} A${radius} ${radius} 0 0 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
	}

	const ticks = Array.from({ length: 11 }, (_, index) => {
		const at = -1 + index * 0.2;
		const outer = point(at * SWEEP, RADIUS + 12);
		const inner = point(at * SWEEP, RADIUS + 20);
		return { x1: outer.x, y1: outer.y, x2: inner.x, y2: inner.y };
	});

	const angle = $derived(Math.max(-1, Math.min(1, value)) * SWEEP);
</script>

<svg viewBox="0 0 200 200" role="img" aria-label={label} class={className}>
	<circle cx={CENTER} cy={CENTER} r="96" fill="#fff" stroke="#111" stroke-width="5" />
	<circle cx={CENTER} cy={CENTER} r="88" fill="#e8e1bc" stroke="#111" stroke-width="2" />

	<!-- The track: red at both ends, the safe band in the middle -->
	<path d={arc(-1, -BAND)} fill="none" stroke="#e5484d" stroke-width="16" />
	<path d={arc(BAND, 1)} fill="none" stroke="#e5484d" stroke-width="16" />
	<path d={arc(-BAND, BAND)} fill="none" stroke="#7c8c5c" stroke-width="16" />
	<path d={arc(-1, 1, RADIUS + 8)} fill="none" stroke="#111" stroke-width="2.5" />
	<path d={arc(-1, 1, RADIUS - 8)} fill="none" stroke="#111" stroke-width="2.5" />
	{#each ticks as tick, index (index)}
		<line {...tick} stroke="#111" stroke-width="3" stroke-linecap="round" />
	{/each}

	<!-- The rotor behind the needle -->
	<g class="rotor" class:spin={spinning && !reducedMotion}>
		<circle cx={CENTER} cy={CENTER} r="24" fill="#aeb4be" stroke="#111" stroke-width="3" />
		{#each [0, 120, 240] as turn (turn)}
			<path
				d="M100 100 L92 78 Q100 70 108 78 Z"
				fill="#f6c9a0"
				stroke="#111"
				stroke-width="2.5"
				stroke-linejoin="round"
				transform="rotate({turn} 100 100)"
			/>
		{/each}
	</g>

	<!-- The needle -->
	<g transform="rotate({angle} 100 100)">
		<path
			d="M96 104 L100 30 L104 104 Z"
			fill="#111"
			stroke="#111"
			stroke-width="3"
			stroke-linejoin="round"
		/>
		<circle cx={CENTER} cy={CENTER} r="9" fill="#ddb93c" stroke="#111" stroke-width="3" />
	</g>
</svg>

<style>
	.rotor {
		transform-box: fill-box;
		transform-origin: center;
	}

	.spin {
		animation: rotor-turn 1.6s linear infinite;
	}

	@keyframes rotor-turn {
		to {
			transform: rotate(360deg);
		}
	}
</style>
