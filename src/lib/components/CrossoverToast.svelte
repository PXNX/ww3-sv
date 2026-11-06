<!--
	A toast for gifts that arrived from another game: which game sent it and what it is. It closes
	itself after a few seconds, or with a tap.
-->
<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { GIFTS, type GiftGame, type GiftId } from '#lib/game/crossover/gifts.js';
	import { modeById } from '#lib/modes/registry.js';
	import { crossover } from '#lib/stores/crossover.svelte.js';
	import IconGift from '~icons/lucide/gift';

	const gifts = crossover();

	const TEXT: Record<GiftId, () => string> = {
		'prigo-hammer': m.crossover_gift_prigo_hammer,
		'raid-veteran': m.crossover_gift_raid_veteran,
		'hackers-archive': m.crossover_gift_hackers_archive,
		'hackers-network': m.crossover_gift_hackers_network
	};

	const gameName = (game: GiftGame): string =>
		game === 'career' ? m.crossover_from_career() : modeById(game).name();

	$effect(() => {
		if (gifts.received.length === 0) return;
		const timer = setTimeout(() => gifts.dismiss(), 7000);
		return () => clearTimeout(timer);
	});
</script>

<div role="status" class="contents">
	{#if gifts.received.length > 0}
		<button
			type="button"
			class="sticker fixed inset-x-3 top-[calc(0.75rem+var(--top-inset))] z-[60] mx-auto flex max-w-md items-start gap-3 bg-explosion-yellow p-3 text-start"
			style:--tilt="-0.6deg"
			onclick={() => gifts.dismiss()}
		>
			<IconGift class="mt-0.5 size-7 shrink-0" aria-hidden="true" />
			<span class="flex flex-col gap-1">
				{#each gifts.received as id (id)}
					{@const gift = GIFTS.find((entry) => entry.id === id)}
					<span class="text-xs font-bold tracking-wide uppercase opacity-80">
						{m.crossover_from({ game: gift ? gameName(gift.from) : '' })}
					</span>
					<span class="leading-snug font-bold">{TEXT[id]()}</span>
				{/each}
			</span>
		</button>
	{/if}
</div>
