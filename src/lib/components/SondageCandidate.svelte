<!--
	La Candidate in the HUD: the rival bloc's leader, an original caricature with a navy sash. Her
	pose follows the poll and she says one of two quotes per mood. While she is picking her rally
	the portrait wobbles (skipped for reduced motion).
-->
<script lang="ts">
	import { cameoAsset } from '#lib/theme/cameos.js';
	import { candidateFile, type CandidateMood } from '#lib/game/sondage/candidate.js';

	let {
		pose,
		name,
		alt,
		quote,
		thinking = false
	}: {
		pose: CandidateMood;
		name: string;
		alt: string;
		quote: string;
		/** True while she is counting votes before her rally */
		thinking?: boolean;
	} = $props();
</script>

<figure
	class="flex min-w-0 items-center gap-2 rounded-[12px_6px_14px_8px] border-3 border-ink bg-paper p-1.5 shadow-[3px_3px_0_var(--color-ink)]"
>
	<img
		src={cameoAsset(candidateFile(pose))}
		{alt}
		class="size-14 shrink-0 rounded-md border-2 border-ink bg-paper object-cover sm:size-16 {thinking
			? 'thinking'
			: ''}"
	/>
	<figcaption class="flex min-w-0 flex-col gap-0.5">
		<span dir="auto" class="font-display text-sm leading-none font-bold">{name}</span>
		<span dir="auto" class="text-xs leading-tight font-semibold sm:text-sm">{quote}</span>
	</figcaption>
</figure>

<style>
	.thinking {
		animation: wobble 700ms ease-in-out infinite;
	}

	@keyframes wobble {
		0%,
		100% {
			transform: rotate(-3deg);
		}
		50% {
			transform: rotate(3deg);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.thinking {
			animation: none;
		}
	}
</style>
