<!--
	Supply against demand over the last game day. The demand is the thick dark line with a green
	band around it (the tolerance), the supply is the red line; where they part the grid is out of
	balance. The playfield stays left to right.
-->
<script lang="ts">
	import { TOLERANCE } from '#lib/game/energiewende/grid.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { HistoryPoint } from '#lib/stores/energiewendeGame.svelte.js';

	let {
		history,
		demand,
		supply,
		class: className = ''
	}: { history: HistoryPoint[]; demand: number; supply: number; class?: string } = $props();

	const WIDTH = 240;
	const HEIGHT = 84;
	const LOW = 20;
	const HIGH = 100;

	const first = $derived(history.length > 0 ? history[0].hour : 0);
	const last = $derived(history.length > 0 ? history[history.length - 1].hour : 1);
	// A full day of room: the chart fills from the left and then scrolls
	const span = $derived(Math.max(last - first, 6));

	function x(hour: number): number {
		return ((hour - first) / span) * WIDTH;
	}

	function y(power: number): number {
		const clamped = Math.min(HIGH, Math.max(LOW, power));
		return HEIGHT - ((clamped - LOW) / (HIGH - LOW)) * HEIGHT;
	}

	const demandLine = $derived(
		history.map((p) => `${x(p.hour).toFixed(1)},${y(p.demand).toFixed(1)}`).join(' ')
	);
	const supplyLine = $derived(
		history.map((p) => `${x(p.hour).toFixed(1)},${y(p.supply).toFixed(1)}`).join(' ')
	);
	const band = $derived(
		history.length > 1
			? [
					...history.map(
						(p) => `${x(p.hour).toFixed(1)},${y(p.demand * (1 + TOLERANCE)).toFixed(1)}`
					),
					...[...history]
						.reverse()
						.map((p) => `${x(p.hour).toFixed(1)},${y(p.demand * (1 - TOLERANCE)).toFixed(1)}`)
				].join(' ')
			: ''
	);
</script>

<svg
	viewBox="0 0 {WIDTH} {HEIGHT}"
	class="block w-full {className}"
	role="img"
	aria-label={m.energiewende_chart_label({
		supply: supply.toFixed(0),
		demand: demand.toFixed(0)
	})}
	preserveAspectRatio="none"
>
	{#each [40, 60, 80] as level (level)}
		<line
			x1="0"
			x2={WIDTH}
			y1={y(level)}
			y2={y(level)}
			stroke="var(--color-ink)"
			stroke-opacity="0.15"
		/>
	{/each}
	{#if band}
		<polygon points={band} fill="var(--color-khaki)" fill-opacity="0.45" />
	{/if}
	{#if history.length > 1}
		<polyline
			points={demandLine}
			fill="none"
			stroke="var(--color-ink)"
			stroke-width="3"
			stroke-linejoin="round"
			vector-effect="non-scaling-stroke"
		/>
		<polyline
			points={supplyLine}
			fill="none"
			stroke="var(--color-tie-red)"
			stroke-width="2.5"
			stroke-linejoin="round"
			vector-effect="non-scaling-stroke"
		/>
	{/if}
</svg>
