<!--
	One of the two critics of Energiewende Panic as a HUD reaction: the portrait in its current
	pose (calm, annoyed or outraged), the figure it is watching and a short quote. The portraits
	are original caricature archetypes in static/assets/cameos/.
-->
<script lang="ts">
	import type { Mood } from '#lib/game/energiewende/reactions.js';
	import { cameoFile } from '#lib/game/energiewende/reactions.js';
	import { cameoAsset } from '#lib/theme/cameos.js';

	let {
		kind,
		mood,
		name,
		alt,
		figure,
		quote,
		loud = false
	}: {
		kind: 'businessman' | 'woman';
		mood: Mood;
		name: string;
		alt: string;
		/** The number this cameo watches, already formatted: the price or the emissions */
		figure: string;
		quote: string;
		/** True while this cameo is the more upset one */
		loud?: boolean;
	} = $props();

	const border = $derived(
		mood === 'outraged' ? 'bg-tie-red' : mood === 'annoyed' ? 'bg-explosion-yellow' : 'bg-paper'
	);
</script>

<figure
	class="flex min-w-0 items-center gap-2 rounded-[12px_6px_14px_8px] border-3 border-ink bg-paper p-1.5 shadow-[3px_3px_0_var(--color-ink)] {loud
		? 'cameo-loud'
		: ''}"
>
	<img
		src={cameoAsset(cameoFile(kind, mood))}
		{alt}
		class="size-14 shrink-0 rounded-lg border-3 border-ink object-cover sm:size-16 {border}"
		width="64"
		height="64"
	/>
	<figcaption class="flex min-w-0 flex-col gap-0.5 text-start">
		<span class="flex items-baseline gap-2 font-display leading-none font-bold">
			<span dir="auto" class="truncate text-xs">{name}</span>
			<span dir="auto" class="text-sm tabular-nums">{figure}</span>
		</span>
		<span dir="auto" class="text-xs leading-tight font-semibold sm:text-sm">{quote}</span>
	</figcaption>
</figure>

<style>
	.cameo-loud {
		animation: cameo-shake 600ms ease-in-out infinite alternate;
	}

	@keyframes cameo-shake {
		from {
			rotate: -1deg;
		}
		to {
			rotate: 1deg;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.cameo-loud {
			animation: none;
		}
	}
</style>
