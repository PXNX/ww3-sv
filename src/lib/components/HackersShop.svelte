<!--
	Hermit Hackers software shop: the five fictional tools are bought with the DogeLite in the bank.
	The three stage tools make the breach, the keylogger and the relay panel easier; the miner runs
	on the player's own machine and pays every second; the siphon drains the target's wallet once a
	day, but only after access is gained. The game keeps running while the shop is open.
-->
<script lang="ts">
	import {
		minerIncome,
		siphonShare,
		SIPHON_DAY_MS,
		TOOL_SPECS,
		breachReliefPercent,
		keylogSlowdownPercent,
		relayReliefPercent,
		upgradeCost,
		type ToolId
	} from '#lib/game/hackers/software.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { HackersGame } from '#lib/stores/hackersGame.svelte.js';

	let { game }: { game: HackersGame } = $props();

	const TOOL_NAMES: Record<ToolId, () => string> = {
		breach: m.hackers_tool_breach,
		keylog: m.hackers_tool_keylog,
		relays: m.hackers_tool_relays,
		miner: m.hackers_tool_miner,
		siphon: m.hackers_tool_siphon
	};

	const daySeconds = SIPHON_DAY_MS / 1000;

	function effect(tool: ToolId): string {
		switch (tool) {
			case 'breach':
				return m.hackers_tool_breach_effect({
					attempts: game.upgrades.breach,
					relief: breachReliefPercent(game.upgrades)
				});
			case 'keylog':
				return m.hackers_tool_keylog_effect({
					pct: keylogSlowdownPercent(game.upgrades)
				});
			case 'relays':
				return m.hackers_tool_relays_effect({
					pct: relayReliefPercent(game.upgrades)
				});
			case 'miner':
				return m.hackers_tool_miner_effect({
					rate: minerIncome(game.upgrades, game.hardware)
				});
			case 'siphon':
				return m.hackers_tool_siphon_effect({
					pct: Math.round(siphonShare(game.upgrades, game.hardware) * 100),
					seconds: daySeconds
				});
		}
	}
</script>

<section
	class="flex flex-col gap-2 rounded-[14px_8px_16px_10px] border-3 border-ink bg-paper p-2 shadow-[4px_4px_0_var(--color-ink)]"
	aria-label={m.hackers_shop_title()}
>
	<div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
		<h2 class="font-display text-sm font-bold tracking-wide uppercase">{m.hackers_shop_title()}</h2>
		<span class="font-display text-xs font-bold tabular-nums">
			{m.hackers_income_rate({ rate: game.incomePerSecond })}
		</span>
	</div>

	<p class="text-xs leading-snug">{m.hackers_shop_hint()}</p>

	<div class="flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-bold">
		<span>{m.hackers_wallet({ left: game.wallet, total: game.walletStart })}</span>
		{#if game.siphonRate > 0}
			<span class="opacity-80">
				{game.stage === 'breach'
					? m.hackers_siphon_access()
					: m.hackers_siphon_next({
							seconds: Math.ceil((1 - game.siphonProgress) * daySeconds)
						})}
			</span>
		{/if}
	</div>

	<ul class="grid gap-1.5 sm:grid-cols-2">
		{#each TOOL_SPECS as tool (tool.id)}
			{@const level = game.upgrades[tool.id]}
			{@const cost = upgradeCost(tool.id, level)}
			<li class="flex flex-col gap-1 rounded-[8px_4px_10px_6px] border-2 border-ink bg-sand p-1.5">
				<div class="flex items-baseline justify-between gap-2">
					<span class="font-display text-sm leading-tight font-bold">{TOOL_NAMES[tool.id]()}</span>
					<span class="shrink-0 text-[10px] font-bold opacity-70">
						{m.hackers_shop_level({ level, max: tool.maxLevel })}
					</span>
				</div>
				<p class="flex-1 text-[11px] leading-snug">{effect(tool.id)}</p>
				<button
					type="button"
					class="w-full rounded border-2 border-ink px-2 py-1 text-xs font-bold tabular-nums shadow-[2px_2px_0_var(--color-ink)] transition active:translate-y-px active:shadow-none disabled:opacity-40"
					class:bg-explosion-yellow={cost !== null && game.score >= cost}
					class:bg-paper={cost === null || game.score < cost}
					disabled={cost === null || game.score < cost}
					onclick={() => game.buy(tool.id)}
				>
					{#if cost === null}
						{m.hackers_shop_max()}
					{:else if level === 0 && (tool.id === 'miner' || tool.id === 'siphon')}
						{m.hackers_shop_install({ cost })}
					{:else}
						{m.hackers_shop_buy({ cost })}
					{/if}
				</button>
			</li>
		{/each}
	</ul>
</section>
