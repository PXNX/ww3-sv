<!--
	The wire: the newest headlines scroll past like a news ticker. With reduced motion it shows the
	latest headline as plain text instead.
-->
<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import type { WarRoomGame } from '#lib/stores/warroomGame.svelte.js';

	let { game }: { game: WarRoomGame } = $props();

	const items = $derived(game.headlines);
</script>

<div
	class="flex items-stretch overflow-hidden rounded-xl border-2 border-ink bg-ink text-paper"
	role="log"
	aria-label={m.warroom_ticker_label()}
>
	<span
		dir="auto"
		class="shrink-0 bg-tie-red px-2 py-1 font-display text-[0.65rem] font-bold tracking-wide uppercase"
	>
		{m.warroom_ticker_label()}
	</span>
	<div class="ticker-window relative min-w-0 flex-1 overflow-hidden py-1">
		{#if items.length === 0}
			<p dir="auto" class="truncate px-2 text-xs font-semibold opacity-80">
				{m.warroom_ticker_idle()}
			</p>
		{:else}
			{#key items[0].id}
				<div
					class="ticker-track flex w-max items-center gap-6 px-2 text-xs font-semibold whitespace-nowrap"
					style:--count={items.length}
				>
					{#each items as item (item.id)}
						<span
							dir="auto"
							class={item.tone === 'bad'
								? 'text-[#ff8a8f]'
								: item.tone === 'good'
									? 'text-[#8fe0a4]'
									: ''}
						>
							{item.text}
						</span>
					{/each}
				</div>
			{/key}
			<p dir="auto" class="ticker-static truncate px-2 text-xs font-semibold">
				{items[0].text}
			</p>
		{/if}
	</div>
</div>

<style>
	.ticker-static {
		display: none;
	}
	.ticker-track {
		animation:
			ticker-in 0.5s ease-out,
			ticker-scroll calc(var(--count) * 7s) linear 0.5s infinite;
	}
	@keyframes ticker-in {
		from {
			transform: translateX(40%);
			opacity: 0;
		}
	}
	@keyframes ticker-scroll {
		to {
			transform: translateX(-100%);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.ticker-track {
			display: none;
		}
		.ticker-static {
			display: block;
		}
	}
</style>
