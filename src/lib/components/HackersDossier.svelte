<!--
	The dossier of another hermit, the CV a hacker pulls up before going in: their avatar (or
	Telegram photo) behind a scanline, their name and the address their rig answers on, the DogeLite
	in their bank, how thick their firewall is and how many rigs they broke into. A red tag says when
	they hacked you lately, and the button then reads HACK BACK. Everything shown is fictional game
	data plus the name the player has on Telegram.
-->
<script lang="ts">
	import Avatar from '#lib/components/Avatar.svelte';
	import { MAX_FIREWALL } from '#lib/game/hackers/pvp.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { HackerCard } from '#lib/services/rivals.js';
	import IconX from '~icons/lucide/x';

	let {
		card,
		busy = false,
		onhack,
		onclose
	}: { card: HackerCard; busy?: boolean; onhack: () => void; onclose: () => void } = $props();
</script>

<article
	class="dossier hk-panel relative mt-2 flex flex-col gap-2 p-3"
	aria-label={m.hackers_dossier_title()}
>
	<header class="flex items-center gap-2 text-xs font-bold tracking-widest">
		<span class="opacity-60">//</span>
		{m.hackers_dossier_title()}
		<button
			type="button"
			class="hk-btn hk-btn-sm ms-auto"
			aria-label={m.hackers_dossier_close()}
			title={m.hackers_dossier_close()}
			onclick={onclose}
		>
			<IconX class="size-4" aria-hidden="true" />
		</button>
	</header>

	<div class="flex gap-3">
		<div
			class="portrait relative size-24 shrink-0 overflow-hidden rounded-sm border border-(--hk-green)"
		>
			{#if card.photoUrl}
				<img src={card.photoUrl} alt="" class="size-full object-cover grayscale" />
			{:else if card.look}
				<Avatar look={card.look} size={96} expression="neutral" label={card.name} />
			{:else}
				<span class="flex size-full items-center justify-center text-4xl" aria-hidden="true">?</span
				>
			{/if}
			<span class="scan" aria-hidden="true"></span>
		</div>

		<dl class="grid min-w-0 flex-1 grid-cols-[auto_1fr] content-start gap-x-2 gap-y-0.5 text-xs">
			<dt class="opacity-60">{m.hackers_dossier_name()}</dt>
			<dd class="truncate font-bold" dir="auto">{card.name}</dd>
			<dt class="opacity-60">IP</dt>
			<dd class="tabular-nums">{card.ip}</dd>
			<dt class="opacity-60">{m.hackers_dossier_bank()}</dt>
			<dd class="tabular-nums">{m.hackers_dogelite({ amount: card.bank })}</dd>
			<dt class="opacity-60">{m.hackers_dossier_firewall()}</dt>
			<dd class="flex items-center gap-1">
				<span class="flex gap-px" aria-hidden="true">
					{#each { length: MAX_FIREWALL }, i (i)}
						<span
							class="h-2.5 w-1.5 {i < card.firewall
								? card.firewall >= 7
									? 'bg-(--hk-red)'
									: card.firewall >= 4
										? 'bg-(--hk-amber)'
										: 'bg-(--hk-green)'
								: 'bg-(--hk-green-faint)'}"
						></span>
					{/each}
				</span>
				<span class="tabular-nums">{card.firewall}/{MAX_FIREWALL}</span>
			</dd>
			<dt class="opacity-60">{m.hackers_dossier_hacks()}</dt>
			<dd class="tabular-nums">{card.hacks}</dd>
		</dl>
	</div>

	{#if card.revenge}
		<p
			class="revenge rounded-sm border border-(--hk-red) px-2 py-1 text-xs font-bold text-(--hk-red)"
		>
			⚠ {m.hackers_dossier_revenge()}
		</p>
	{/if}

	<button
		type="button"
		class="hk-btn hk-btn-solid justify-center text-sm"
		disabled={busy}
		onclick={onhack}
	>
		{card.revenge ? m.hackers_hack_back() : m.hackers_term_hack()}
	</button>
</article>

<style>
	.dossier {
		animation: dossier-in 220ms ease-out;
	}

	.portrait {
		background: var(--hk-panel-hi);
	}

	/* A bright line sweeps down the photo, like a scanner reading it */
	.scan {
		position: absolute;
		inset-inline: 0;
		top: 0;
		height: 18%;
		background: linear-gradient(transparent, rgb(57 255 106 / 0.35), transparent);
		animation: scan 2.4s linear infinite;
	}

	.revenge {
		animation: blink 1.2s steps(2, jump-none) infinite;
	}

	@keyframes dossier-in {
		from {
			opacity: 0;
			transform: translateY(6px);
		}
	}

	@keyframes scan {
		from {
			transform: translateY(-100%);
		}
		to {
			transform: translateY(560%);
		}
	}

	@keyframes blink {
		50% {
			opacity: 0.55;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.dossier,
		.scan,
		.revenge {
			animation: none;
		}
	}
</style>
