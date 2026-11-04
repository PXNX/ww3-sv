<!--
	The council panel: one standing directive a day, each at a price, plus a plain reading of what
	the home front and the Pact are doing.
-->
<script lang="ts">
	import { DIRECTIVES } from '#lib/game/warroom/council.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { WarRoomGame } from '#lib/stores/warroomGame.svelte.js';
	import { directiveName, directiveNote, effectLabel, resourceCost } from './warroomText.js';
	import IconStamp from '~icons/lucide/stamp';

	let { game }: { game: WarRoomGame } = $props();
</script>

<section
	class="flex flex-col gap-2 rounded-2xl border-3 border-ink bg-paper p-2 shadow-[3px_3px_0_var(--color-ink)]"
>
	<div class="flex flex-col gap-0.5">
		<h2 dir="auto" class="font-display text-lg leading-tight font-bold">
			{m.warroom_council_title()}
		</h2>
		<p dir="auto" class="text-xs leading-snug font-semibold opacity-80">
			{game.directiveUsed ? m.warroom_council_used() : m.warroom_council_hint()}
		</p>
	</div>
	<ul class="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
		{#each DIRECTIVES as directive (directive.id)}
			<li class="flex flex-col gap-1 rounded-xl border-2 border-ink bg-sand p-1.5">
				<p dir="auto" class="font-display text-sm leading-tight font-bold">
					{directiveName(directive.id)}
				</p>
				<p dir="auto" class="text-xs leading-snug font-semibold opacity-80">
					{directiveNote(directive.id)}
				</p>
				<span class="flex flex-wrap gap-1">
					{#each directive.effects as effect, index (index)}
						<span
							dir="auto"
							class="rounded-full border border-ink bg-paper px-1.5 py-0.5 text-[0.65rem] leading-none font-semibold"
						>
							{effectLabel(effect)}
						</span>
					{/each}
				</span>
				<button
					type="button"
					class="btn-chunky justify-center bg-explosion-yellow px-2 py-1 text-xs disabled:opacity-50"
					disabled={!game.canUseDirective(directive.id)}
					onclick={() => game.useDirective(directive.id)}
				>
					<IconStamp class="size-3.5" aria-hidden="true" />
					<span dir="auto">{m.warroom_directive_issue()}</span>
					{#if Object.keys(directive.cost).length > 0}
						<span dir="auto" class="font-semibold">({resourceCost(directive.cost)})</span>
					{/if}
				</button>
			</li>
		{/each}
	</ul>
	{#if game.intelDays > 0}
		<p dir="auto" class="text-xs font-bold text-[#1d6b34]">
			{m.warroom_council_intel({ days: game.intelDays })}
		</p>
	{/if}
</section>
