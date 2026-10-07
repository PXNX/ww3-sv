<!--
	The tankers waiting on the Gulf side (the lives). The tanker at the front of the queue, nearest
	the strait, is the next to go; a sunk tanker tips over and settles with a few bubbles.
-->
<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { spriteSrc } from '#lib/theme/sprites.js';

	let { total, afloat }: { total: number; afloat: number } = $props();
</script>

<section
	class="sticker flex items-center gap-3 px-3 py-2"
	style:--tilt="-0.6deg"
	aria-label={m.minefield_tankers_label()}
>
	<span class="shrink-0 font-display text-sm leading-tight font-bold">
		{m.minefield_west_label()}
	</span>
	<ol
		data-playfield
		class="relative flex flex-1 items-end justify-end gap-2 overflow-hidden rounded-[8px_4px_10px_6px] border-3 border-ink bg-flag-blue px-2 pt-2"
	>
		{#each Array.from({ length: total }, (_, index) => index) as index (index)}
			{@const sunk = index >= afloat}
			<li class="relative w-1/4 max-w-20">
				<span class="sr-only">
					{sunk
						? m.minefield_tanker_sunk({ number: index + 1 })
						: m.minefield_tanker_afloat({ number: index + 1 })}
				</span>
				{#if sunk}
					<img src={spriteSrc('tanker')} alt="" class="sunk w-full" draggable="false" />
					<span class="bubble" style:--x="30%" style:--delay="200ms" aria-hidden="true"></span>
					<span class="bubble" style:--x="60%" style:--delay="500ms" aria-hidden="true"></span>
				{:else}
					<img src={spriteSrc('tanker')} alt="" class="bob w-full" draggable="false" />
				{/if}
			</li>
		{/each}
	</ol>
</section>

<style>
	.bob {
		animation: bob 2.4s ease-in-out infinite;
	}

	.sunk {
		rotate: 24deg;
		translate: 0 45%;
		opacity: 0.5;
		filter: grayscale(1);
		animation: sink 900ms var(--ease-spring) both;
	}

	.bubble {
		position: absolute;
		inset-inline-start: var(--x);
		top: 10%;
		width: 9px;
		height: 9px;
		border: 2px solid var(--color-ink);
		border-radius: 50%;
		background: var(--color-paper);
		animation: bubble 1.4s var(--delay) ease-out both;
	}

	@keyframes bob {
		50% {
			translate: 0 -3px;
		}
	}

	@keyframes sink {
		from {
			rotate: 0deg;
			translate: 0 0;
			opacity: 1;
			filter: grayscale(0);
		}
		40% {
			rotate: -14deg;
		}
	}

	@keyframes bubble {
		from {
			translate: 0 30px;
			opacity: 1;
		}
		to {
			translate: 0 -12px;
			opacity: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.bob,
		.sunk {
			animation: none;
		}

		.bubble {
			display: none;
		}
	}
</style>
