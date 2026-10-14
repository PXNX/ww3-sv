<!--
	What the player sees over the board once the star is burning: a slim strip over the bottom of
	the board with the tiny horned conductor and the "Ritual Complete" title in the riddle font, so
	the glow stays in view. The score and the buttons are in the result sheet that slides up under it.
-->
<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import PurrConductor from './PurrConductor.svelte';

	let {
		banner,
		calm
	}: {
		/** How far the banner has faded in (0 to 1) */
		banner: number;
		calm: boolean;
	} = $props();
</script>

{#if banner > 0}
	<div
		class="absolute inset-x-1.5 bottom-1.5 z-10 flex items-center justify-center gap-2 rounded-[14px_8px_16px_10px] border-3 border-[#4a1580] bg-[#12061f]/80 px-2 py-1 text-paper backdrop-blur-sm"
		style:opacity={banner}
		role="status"
	>
		<PurrConductor {calm} class="size-12 shrink-0 sm:size-16" />
		<h2 dir="auto" class="ritual-title min-w-0 text-center text-2xl leading-tight sm:text-4xl">
			{m.purr_ritual_complete()}
		</h2>
	</div>
{/if}
