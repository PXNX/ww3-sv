<!--
	The recruit tab: the four division templates with their attack, defence, morale and supply
	cost, the equipment they need and the training queue that turns equipment into divisions.
-->
<script lang="ts">
	import { TEMPLATES, templateDef } from '#lib/game/warroom/config.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { WarRoomGame } from '#lib/stores/warroomGame.svelte.js';
	import NatoSymbol from './NatoSymbol.svelte';
	import { equipmentCost, templateName, templateNote } from './warroomText.js';
	import IconHourglass from '~icons/lucide/hourglass';
	import IconPlus from '~icons/lucide/plus';

	let { game }: { game: WarRoomGame } = $props();

	const playing = $derived(game.status === 'playing');
</script>

<section
	class="flex flex-col gap-2 rounded-2xl border-3 border-ink bg-paper p-2 shadow-[3px_3px_0_var(--color-ink)]"
>
	<div class="flex flex-col gap-0.5">
		<h2 dir="auto" class="font-display text-lg leading-tight font-bold">
			{m.warroom_recruit_title()}
		</h2>
		<p dir="auto" class="text-xs leading-snug font-semibold opacity-80">
			{m.warroom_recruit_hint()}
		</p>
	</div>

	<div class="rounded-xl border-2 border-ink bg-sand px-2 py-1">
		<h3 dir="auto" class="font-display text-sm font-bold">{m.warroom_recruit_queue_title()}</h3>
		{#if game.training.length === 0}
			<p dir="auto" class="text-xs font-semibold opacity-70">{m.warroom_recruit_queue_empty()}</p>
		{:else}
			<ul class="flex flex-col gap-0.5">
				{#each game.training as item (item.id)}
					<li class="flex items-center justify-between gap-2 text-xs font-semibold">
						<span dir="auto" class="inline-flex min-w-0 items-center gap-1">
							<IconHourglass class="size-3 shrink-0" aria-hidden="true" />
							<span class="truncate">
								{item.daysLeft === 1
									? m.warroom_recruit_in_training_one({ template: templateName(item.template) })
									: m.warroom_recruit_in_training({
											template: templateName(item.template),
											days: item.daysLeft
										})}
							</span>
						</span>
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	<ul class="grid grid-cols-1 gap-2 sm:grid-cols-2">
		{#each TEMPLATES as template (template.id)}
			{@const def = templateDef(template.id)}
			{@const affordable = game.canTrain(template.id)}
			<li class="flex flex-col gap-1 rounded-xl border-2 border-ink bg-sand px-2 py-1.5">
				<div class="flex items-center gap-2">
					<NatoSymbol kind={template.id} side="player" class="h-6 w-8 shrink-0" />
					<div class="flex min-w-0 flex-col">
						<h3 dir="auto" class="truncate font-display text-sm leading-tight font-bold">
							{templateName(template.id)}
						</h3>
						<p dir="auto" class="text-[0.7rem] leading-tight opacity-80">
							{templateNote(template.id)}
						</p>
					</div>
				</div>

				<dl class="grid grid-cols-4 gap-1 text-center">
					<div class="rounded border border-ink bg-paper px-0.5 py-0.5">
						<dt class="text-[0.7rem] font-bold uppercase opacity-70">{m.warroom_stat_attack()}</dt>
						<dd class="font-display text-sm leading-none font-bold tabular-nums" dir="ltr">
							{def.attack}
						</dd>
					</div>
					<div class="rounded border border-ink bg-paper px-0.5 py-0.5">
						<dt class="text-[0.7rem] font-bold uppercase opacity-70">{m.warroom_stat_defence()}</dt>
						<dd class="font-display text-sm leading-none font-bold tabular-nums" dir="ltr">
							{def.defence}
						</dd>
					</div>
					<div class="rounded border border-ink bg-paper px-0.5 py-0.5">
						<dt class="text-[0.7rem] font-bold uppercase opacity-70">{m.warroom_stat_morale()}</dt>
						<dd class="font-display text-sm leading-none font-bold tabular-nums" dir="ltr">
							{def.morale}
						</dd>
					</div>
					<div class="rounded border border-ink bg-paper px-0.5 py-0.5">
						<dt class="text-[0.7rem] font-bold uppercase opacity-70">
							{m.warroom_stat_supply_use()}
						</dt>
						<dd class="font-display text-sm leading-none font-bold tabular-nums" dir="ltr">
							{def.supplyUse}
						</dd>
					</div>
				</dl>

				<p dir="auto" class="text-[0.7rem] font-semibold tabular-nums">
					{m.warroom_recruit_cost({ cost: equipmentCost(def.cost) })}
				</p>
				<div class="flex items-center justify-between gap-2">
					<span class="inline-flex items-center gap-1 text-[0.7rem] font-semibold">
						<IconHourglass class="size-3" aria-hidden="true" />
						{def.trainDays === 1
							? m.warroom_recruit_time_one()
							: m.warroom_recruit_time({ days: def.trainDays })}
					</span>
					<button
						type="button"
						class="btn-chunky px-2 py-1 text-xs disabled:opacity-50"
						disabled={!playing || !affordable}
						onclick={() => game.train(template.id)}
					>
						<IconPlus class="size-3.5" aria-hidden="true" />
						{m.warroom_recruit_train()}
					</button>
				</div>
			</li>
		{/each}
	</ul>
</section>
