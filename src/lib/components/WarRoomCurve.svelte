<!--
	The campaign curve for the result screen: regions held (blue) and home front stability (red),
	one point per day. The lines draw themselves in unless motion is reduced.
-->
<script lang="ts">
	import { REGION_IDS } from '#lib/game/warroom/config.js';
	import type { HistoryPoint } from '#lib/game/warroom/types.js';
	import { m } from '#lib/paraglide/messages.js';

	let { history }: { history: HistoryPoint[] } = $props();

	const width = 200;
	const height = 60;
	const path = (values: number[], max: number) =>
		values
			.map((value, index) => {
				const x = values.length > 1 ? (index / (values.length - 1)) * width : 0;
				const y = height - (Math.max(0, Math.min(max, value)) / max) * (height - 4) - 2;
				return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
			})
			.join(' ');

	const regions = $derived(
		path(
			history.map((point) => point.regions),
			REGION_IDS.length
		)
	);
	const stability = $derived(
		path(
			history.map((point) => point.stability),
			100
		)
	);
</script>

<figure class="flex flex-col gap-1">
	<figcaption dir="auto" class="text-center text-xs font-bold">
		{m.warroom_curve_title()}
	</figcaption>
	<svg
		viewBox="0 0 {width} {height}"
		class="h-16 w-full rounded-xl border-2 border-ink bg-sand"
		preserveAspectRatio="none"
		role="img"
		aria-label={m.warroom_curve_title()}
		dir="ltr"
	>
		<path
			d={stability}
			class="curve"
			pathLength="1"
			fill="none"
			stroke="#e5484d"
			stroke-width="2"
		/>
		<path
			d={regions}
			class="curve"
			pathLength="1"
			fill="none"
			stroke="#2f7fb8"
			stroke-width="2.5"
		/>
	</svg>
	<p class="flex justify-center gap-3 text-[0.65rem] font-bold">
		<span class="text-[#2f7fb8]">{m.warroom_stat_regions()}</span>
		<span class="text-tie-red">{m.warroom_hud_stability()}</span>
	</p>
</figure>

<style>
	.curve {
		stroke-dasharray: 1;
		stroke-dashoffset: 1;
		animation: draw 1.2s ease-out 0.3s forwards;
		vector-effect: non-scaling-stroke;
	}
	@keyframes draw {
		to {
			stroke-dashoffset: 0;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.curve {
			animation: none;
			stroke-dashoffset: 0;
		}
	}
</style>
