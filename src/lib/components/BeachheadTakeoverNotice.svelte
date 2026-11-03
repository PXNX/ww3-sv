<!--
	A notice for the islands the enemy retook while the player was away. It stays until dismissed,
	so the lost income and the harder defences do not come as a surprise.
-->
<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { ISLAND_IDS } from '#lib/game/beachhead/config.js';
	import type { BeachheadGame } from '#lib/stores/beachheadGame.svelte.js';
	import { islandName } from './beachheadText';
	import IconSkull from '~icons/lucide/skull';
	import IconX from '~icons/lucide/x';

	let { game }: { game: BeachheadGame } = $props();

	const lost = $derived(
		game.takeoverNotice
			.map((islandId) => ISLAND_IDS.indexOf(islandId))
			.filter((index) => index >= 0)
	);
</script>

{#if lost.length > 0}
	<div
		class="sticker flex items-start gap-3 border-tie-red bg-tie-red p-3 text-paper"
		style:--tilt="0.7deg"
		role="status"
	>
		<IconSkull class="mt-0.5 size-7 shrink-0" aria-hidden="true" />
		<div class="flex-1">
			<p class="font-bold">{m.beachhead_takeback_title()}</p>
			<ul class="text-sm font-semibold">
				{#each lost as index (index)}
					<li>{m.beachhead_takeback_banner({ island: islandName(index) })}</li>
				{/each}
			</ul>
		</div>
		<button
			type="button"
			class="btn-chunky px-2 py-1 text-sm"
			aria-label={m.beachhead_takeback_dismiss()}
			title={m.beachhead_takeback_dismiss()}
			onclick={() => game.dismissTakeovers()}
		>
			<IconX class="size-4" aria-hidden="true" />
		</button>
	</div>
{/if}
