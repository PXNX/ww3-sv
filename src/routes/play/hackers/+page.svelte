<!--
	Hermit Hackers play page: North Korea / Kim. Retro terminal interface.
	The player sees a list of IP targets, each a crypto wallet system.
	Click an IP to open its wallet (Mastermind guess) and breaker panel (Lights Out toggle).
-->
<script lang="ts">
	import GameShell from '#lib/components/GameShell.svelte';
	import { m } from '#lib/paraglide/messages.js';
	const modeName = 'Hermit Hackers';
</script>

<GameShell title={modeName} score={0} best={null}>
	<div class="max-w-xl mx-auto p-6 space-y-6 text-paper">
		<div class="rounded-xl border-3 border-ink bg-banner-slate p-4 shadow-[3px_3px_0_var(--color-ink)]">
			<h2 class="font-display text-xl font-bold mb-3 text-paper">IP Targets</h2>
			<div class="grid grid-cols-2 gap-3">
				{#each ['10.0.17.44','192.168.77.13','172.31.200.5','10.10.4.88','192.168.215.33','172.16.99.7'] as ip}
					<button type="button" class="btn-chunky bg-paper text-ink text-xs font-mono text-center px-2 py-2 rounded-md shadow-[2px_2px_0_var(--color-ink)] hover:scale-[1.02] active:scale-[0.98] transition-transform" onclick={() => alert('Opening ' + ip)}>
						{ip}
					</button>
				{/each}
			</div>
		</div>

		<div class="rounded-xl border-3 border-ink bg-tie-red/20 p-4 shadow-[3px_3px_0_var(--color-ink)]">
			<h2 class="font-display text-xl font-bold mb-2 text-paper">Breaker Panel</h2>
			<div class="grid grid-cols-3 gap-2 w-fit mx-auto">
				{#each Array(9) as _, idx}
					<button type="button" class="w-10 h-10 rounded-md border-2 border-ink bg-sand shadow-[2px_2px_0_var(--color-ink)] hover:scale-105 active:scale-95 transition-transform" onclick={() => alert('Toggle breaker ' + (idx + 1))} aria-label="Breaker {idx + 1}"></button>
				{/each}
			</div>
		</div>

		<div class="rounded-xl border-3 border-ink bg-khaki p-4 shadow-[3px_3px_0_var(--color-ink)]">
			<h2 class="font-display text-xl font-bold mb-2 text-ink">Wallet Access Code</h2>
			<p class="text-sm font-display text-ink/80">Brute-force crack: guess the 4-digit access key. Each wrong guess raises the trace meter.</p>
		</div>

		<div class="rounded-xl border-3 border-ink bg-paper p-3 shadow-[3px_3px_0_var(--color-ink)]">
			<p class="font-display text-sm font-bold text-ink">Quota: 3 wallets · Trace: 0% · Time: 120s</p>
		</div>
	</div>
</GameShell>
