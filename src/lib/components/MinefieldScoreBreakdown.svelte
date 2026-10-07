<!-- The parts of a Minefield score, shown on the victory and game-over screens -->
<script lang="ts">
	import type { ScoreBreakdown } from '#lib/game/minefield/scoring.js';
	import { m } from '#lib/paraglide/messages.js';

	let { score }: { score: ScoreBreakdown } = $props();

	const rows = $derived(
		[
			{ label: m.minefield_stat_revealed(), value: score.revealed },
			{ label: m.minefield_stat_flags(), value: score.flags },
			{ label: m.minefield_stat_win(), value: score.win },
			{ label: m.minefield_stat_time(), value: score.time },
			{ label: m.minefield_stat_tankers(), value: score.tankers },
			{ label: m.minefield_stat_submarines(), value: score.submarines },
			{ label: m.minefield_stat_perfect(), value: score.perfect }
		].filter((row, index) => index < 2 || row.value > 0)
	);
</script>

<dl
	class="grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 rounded-[10px_6px_12px_8px] border-3 border-ink bg-sand px-3 py-2 text-start text-sm"
>
	{#each rows as row (row.label)}
		<dt>{row.label}</dt>
		<dd class="text-end font-display font-bold tabular-nums">+{row.value}</dd>
	{/each}
	<dt>{m.minefield_stat_multiplier()}</dt>
	<dd class="text-end font-display font-bold tabular-nums">× {score.multiplier}</dd>
</dl>
