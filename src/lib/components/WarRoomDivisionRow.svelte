<!--
	One division in a list: its APP-6 symbol, what it is, its attack and defence, and the morale
	bar that actually decides how hard it fights.
-->
<script lang="ts">
	import type { Owner } from '#lib/game/warroom/config.js';
	import { templateDef } from '#lib/game/warroom/config.js';
	import type { Division } from '#lib/game/warroom/types.js';
	import { m } from '#lib/paraglide/messages.js';
	import NatoSymbol from './NatoSymbol.svelte';
	import { templateName } from './warroomText.js';

	let { division, side = 'player' }: { division: Division; side?: Owner } = $props();

	const template = $derived(templateDef(division.template));
	const level = $derived(division.experience ?? 1);
	const factor = $derived(1 + Math.max(0, level - 1) * 0.08);
	const attack = $derived(Math.round(template.attack * factor));
	const defence = $derived(Math.round(template.defence * factor));
	const tone = $derived(
		division.morale >= 70 ? 'bg-[#8fd19e]' : division.morale >= 40 ? 'bg-[#e8c46a]' : 'bg-tie-red'
	);
</script>

<li class="flex items-center gap-2 rounded-xl border-2 border-ink bg-paper px-2 py-1">
	<NatoSymbol kind={division.template} {side} class="h-5 w-7 shrink-0" />
	<span class="flex min-w-0 flex-1 flex-col">
		<span class="flex items-baseline justify-between gap-2">
			<span dir="auto" class="truncate font-display text-sm leading-tight font-bold">
				{templateName(division.template)}
			</span>
			<span
				class="shrink-0 rounded-full border border-ink bg-sand px-1 text-[0.7rem] font-bold tabular-nums"
			>
				{m.warroom_division_level({ level })}
			</span>
			<span class="shrink-0 text-[0.75rem] font-semibold tabular-nums" dir="ltr">
				{m.warroom_division_stats({ attack, defence })}
			</span>
		</span>
		<span class="flex items-center gap-1">
			<span class="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full border border-ink bg-sand">
				<span class="block h-full {tone}" style:width="{division.morale}%"></span>
			</span>
			<span class="shrink-0 text-[0.7rem] font-bold tabular-nums" dir="ltr">
				{m.warroom_stat_morale()}
				{division.morale}
			</span>
		</span>
	</span>
</li>
