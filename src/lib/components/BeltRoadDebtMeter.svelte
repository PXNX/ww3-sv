<!--
	The debt meter: it rises with every move. The bar runs to the two-star limit (double par); the tick
	marks the last move that still earns three stars. Past the end the bar stays full and the level can
	still be finished for one star. The amount is always printed, so the bar never carries the
	information alone.
-->
<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { debtFor, movesForStars } from '#lib/game/beltroad/board.js';

	let { moves, par }: { moves: number; par: number } = $props();

	const three = $derived(movesForStars(par, 3));
	const two = $derived(movesForStars(par, 2));
	const fill = $derived(Math.min(1, moves / two));
	const tick = $derived(three / two);
	const tone = $derived(
		moves <= three ? 'bg-khaki' : moves <= two ? 'bg-explosion-yellow' : 'bg-tie-red'
	);
	const amount = $derived(debtFor(moves));
</script>

<div class="flex w-full flex-col gap-0.5">
	<div class="flex items-baseline justify-between gap-2 font-display font-bold">
		<span class="text-xs tracking-wide uppercase">{m.beltroad_debt()}</span>
		<span class="text-lg leading-none tabular-nums">{m.beltroad_debt_amount({ amount })}</span>
	</div>
	<div
		role="meter"
		aria-label={m.beltroad_debt_meter({ amount, moves })}
		aria-valuemin={0}
		aria-valuemax={two}
		aria-valuenow={Math.min(moves, two)}
		aria-valuetext={m.beltroad_debt_meter({ amount, moves })}
		class="relative h-4 w-full overflow-hidden rounded-full border-2 border-ink bg-sand"
	>
		<div
			class="h-full border-r-2 border-ink transition-[width] duration-150 {tone}"
			style:width="{fill * 100}%"
		></div>
		<div class="absolute inset-y-0 w-0.5 bg-ink" style:left="{tick * 100}%"></div>
	</div>
	<p class="text-xs">{m.beltroad_star_limits({ three, two })}</p>
</div>
