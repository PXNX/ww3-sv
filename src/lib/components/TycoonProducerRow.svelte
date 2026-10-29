<!--
	One producer in the shop: icon with the number owned, name and a line of flavor text, what it
	pumps per second and when the next cycle pays out, a bar that fills as the cycle runs, and a buy
	button with the price for the chosen amount (1, 10 or as many as affordable). Once the most that
	can be owned is reached the button says so and buys nothing.
-->
<script lang="ts">
	import { MAX_OWNED, type ProducerId } from '#lib/game/tycoon/config.js';
	import { maxAffordable, producerCost, producerDef } from '#lib/game/tycoon/economy.js';
	import { formatBig, formatCount, formatCycle, formatDuration } from '#lib/game/tycoon/format.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { TycoonGame } from '#lib/stores/tycoonGame.svelte.js';
	import TycoonProducerIcon from './TycoonProducerIcon.svelte';
	import { producerFlavor, producerName } from './tycoonText.js';

	let { game, id }: { game: TycoonGame; id: ProducerId } = $props();

	const locale = getLocale();
	const def = $derived(producerDef(id));
	const owned = $derived(game.owned[id]);
	// Nothing more can be bought once the most is owned
	const maxed = $derived(owned >= MAX_OWNED);
	// "Max" buys what the barrels allow, but always shows the price of at least one unit; no amount
	// goes beyond what is still allowed, so the price shown is the price paid
	const count = $derived(
		Math.min(
			MAX_OWNED - owned,
			game.buyAmount === 'max'
				? Math.max(1, maxAffordable(def, owned, game.barrels, game.pricing))
				: game.buyAmount
		)
	);
	const cost = $derived(producerCost(def, owned, count, game.pricing));
	const affordable = $derived(!maxed && game.barrels >= cost);
	const sanctioned = $derived(game.cut.includes(id));
	const upgradeReady = $derived(game.availableIds.some((uid) => uid.startsWith(id + '_')));
	const name = $derived(producerName(id));
	const cycle = $derived(game.cycles[id]);
	// What one cycle pays: for all owned units, or for the first one before any is bought
	const payout = $derived((game.eachOutput[id] * Math.max(1, owned) * cycle) / 1000);
	// What the owned units pump per second on average (nothing while sanctioned)
	const rate = $derived(sanctioned ? 0 : game.eachOutput[id] * owned);
	const progress = $derived(owned > 0 ? game.progress[id] : 0);
	const remainingMs = $derived(Math.max(0, cycle * (1 - progress)));
	const nextText = $derived(
		remainingMs >= 60_000 ? formatDuration(remainingMs, locale) : formatCycle(remainingMs, locale)
	);
</script>

<li class="tycoon-row">
	<div
		class="flex items-center gap-3 rounded-2xl border-3 border-ink px-3 py-2 {maxed
			? 'bg-khaki'
			: 'bg-paper'}"
		class:ring-4={upgradeReady}
		class:ring-success={upgradeReady}
	>
		<span class="relative shrink-0">
			<span
				class="grid size-12 place-items-center rounded-xl border-3 border-ink {sanctioned
					? 'bg-tie-red'
					: 'bg-explosion-yellow'}"
			>
				<TycoonProducerIcon {id} class="size-6" />
			</span>
			<span
				class="absolute -end-2 -bottom-2 min-w-6 rounded-full border-2 border-ink bg-paper px-1 text-center font-display text-[0.7rem] leading-5 font-bold text-ink tabular-nums"
				dir="ltr"
				title={m.tycoon_producer_owned({ count: formatCount(owned, locale) })}
			>
				{formatCount(owned, locale)}
			</span>
		</span>

		<span class="flex min-w-0 flex-1 flex-col gap-0.5">
			<span dir="auto" class="truncate font-display text-base leading-tight font-bold">
				{name}
				{#if sanctioned}
					<span class="text-tie-red">({m.tycoon_producer_sanctioned()})</span>
				{/if}
			</span>
			<span dir="auto" class="truncate text-xs leading-tight opacity-80">{producerFlavor(id)}</span>
			{#if owned > 0}
				<span
					class="flex flex-wrap gap-x-3 font-display text-xs leading-tight font-bold tabular-nums"
					dir="auto"
				>
					<span>{m.tycoon_producer_rate({ amount: formatBig(rate, locale, 1) })}</span>
					{#if !sanctioned}
						<span>{m.tycoon_producer_next({ time: nextText })}</span>
					{/if}
				</span>
				<span
					class="mt-0.5 h-1.5 overflow-hidden rounded-full bg-ink/15"
					aria-hidden="true"
					dir="ltr"
				>
					<span
						class="block h-full w-full origin-left rounded-full {sanctioned
							? 'bg-tie-red'
							: 'bg-ink'}"
						style:transform="scaleX({progress})"
					></span>
				</span>
			{:else}
				<span dir="auto" class="text-xs leading-tight font-semibold tabular-nums">
					{m.tycoon_producer_cycle({
						amount: formatBig(payout, locale, 1),
						time: formatCycle(cycle, locale)
					})}
				</span>
			{/if}
		</span>

		<button
			type="button"
			class="btn-chunky shrink-0 flex-col gap-0 px-3 py-1.5 leading-tight {maxed
				? 'bg-paper'
				: 'bg-explosion-yellow'}"
			class:opacity-50={!affordable}
			disabled={!affordable}
			aria-label={maxed
				? `${name}: ${m.tycoon_perk_maxed()}`
				: m.tycoon_buy_label({ count, name, cost: formatBig(cost, locale) })}
			onclick={() => game.buy(id)}
			dir="ltr"
		>
			{#if maxed}
				<span class="text-sm">{m.tycoon_perk_maxed()} ★</span>
			{:else}
				<span class="text-xs">{m.tycoon_buy_count({ count: formatCount(count, locale) })}</span>
				<span class="text-base tabular-nums">{formatBig(cost, locale)}</span>
			{/if}
		</button>
	</div>
</li>

<style>
	/* Rows far off screen are not laid out or painted, which keeps a long list light */
	.tycoon-row {
		content-visibility: auto;
		contain-intrinsic-size: auto 84px;
	}
</style>
