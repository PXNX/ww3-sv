<!--
	One producer in the shop: icon, name, a line of flavor text, how many are owned and what their
	cycle pays, a bar that fills as the cycle runs, and a buy button with the price for the chosen
	amount (1, 10 or as many as affordable).
-->
<script lang="ts">
	import type { ProducerId } from '#lib/game/tycoon/config.js';
	import { maxAffordable, producerCost, producerDef } from '#lib/game/tycoon/economy.js';
	import { formatBig, formatCount, formatCycle } from '#lib/game/tycoon/format.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { TycoonGame } from '#lib/stores/tycoonGame.svelte.js';
	import TycoonProducerIcon from './TycoonProducerIcon.svelte';
	import { producerFlavor, producerName } from './tycoonText.js';

	let { game, id }: { game: TycoonGame; id: ProducerId } = $props();

	const locale = getLocale();
	const def = $derived(producerDef(id));
	const owned = $derived(game.owned[id]);
	// "Max" buys what the barrels allow, but always shows the price of at least one unit
	const count = $derived(
		game.buyAmount === 'max'
			? Math.max(1, maxAffordable(def, owned, game.barrels, game.pricing))
			: game.buyAmount
	);
	const cost = $derived(producerCost(def, owned, count, game.pricing));
	const affordable = $derived(game.barrels >= cost);
	const sanctioned = $derived(game.cut.includes(id));
	const upgradeReady = $derived(game.availableIds.some((uid) => uid.startsWith(id + '_')));
	const name = $derived(producerName(id));
	const cycle = $derived(game.cycles[id]);
	// What one cycle pays: for all owned units, or for the first one before any is bought
	const payout = $derived((game.eachOutput[id] * Math.max(1, owned) * cycle) / 1000);
	const progress = $derived(owned > 0 ? game.progress[id] : 0);
</script>

<li>
	<button
		type="button"
		class="btn-chunky flex w-full items-center gap-3 bg-paper px-3 py-2 text-start"
		class:opacity-60={!affordable}
		class:ring-3={upgradeReady}
		class:ring-success={upgradeReady}
		disabled={!affordable}
		aria-label={m.tycoon_buy_label({ count, name, cost: formatBig(cost, locale) })}
		onclick={() => game.buy(id)}
	>
		<span
			class="grid size-11 shrink-0 place-items-center rounded-lg border-3 border-ink {sanctioned
				? 'bg-tie-red'
				: 'bg-explosion-yellow'}"
		>
			<TycoonProducerIcon {id} class="size-6" />
		</span>
		<span class="flex min-w-0 flex-1 flex-col">
			<span dir="auto" class="truncate font-display text-base leading-tight font-bold">
				{name}
				{#if sanctioned}
					<span class="text-tie-red">({m.tycoon_producer_sanctioned()})</span>
				{/if}
			</span>
			<span dir="auto" class="truncate text-xs leading-tight">{producerFlavor(id)}</span>
			<span dir="auto" class="text-xs leading-tight font-semibold tabular-nums">
				{m.tycoon_producer_owned({ count: formatCount(owned, locale) })}
				·
				{m.tycoon_producer_cycle({
					amount: formatBig(payout, locale, 1),
					time: formatCycle(cycle, locale)
				})}
			</span>
			<span
				class="mt-1 h-2 overflow-hidden rounded-full border-2 border-ink bg-sand"
				aria-hidden="true"
				dir="ltr"
			>
				<span
					class="block h-full rounded-full {sanctioned ? 'bg-tie-red' : 'bg-khaki'}"
					style:width="{progress * 100}%"
				></span>
			</span>
		</span>
		<span class="flex shrink-0 flex-col items-end font-display leading-tight font-bold" dir="ltr">
			<span class="text-xs">{m.tycoon_buy_count({ count: formatCount(count, locale) })}</span>
			<span class="text-base tabular-nums">{formatBig(cost, locale)}</span>
		</span>
	</button>
</li>
