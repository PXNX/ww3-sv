<!--
	Remaining lives as deep red hearts: a filled Fluent heart per life left, an outlined heart per
	life lost. When lives drop, the lost heart pops and fades away once (skipped for reduced motion).

	Direction: the bar follows the document direction, so in Persian the first heart sits on the
	right. Only the bar mirrors; playfields keep data-playfield and stay left to right.
-->
<script lang="ts">
	import { heartStates, lostHearts } from '#lib/game/lives.js';
	import { m } from '#lib/paraglide/messages.js';
	import IconHeartFilled from '~icons/fluent/heart-24-filled';
	import IconHeartOutline from '~icons/fluent/heart-24-regular';

	let {
		lives,
		max,
		class: className = ''
	}: {
		lives: number;
		max: number;
		/** Extra classes for the bar, for example to change the heart size (sized in em, default text-xl) */
		class?: string;
	} = $props();

	const hearts = $derived(heartStates(lives, max));
	const remaining = $derived(hearts.filter((state) => state === 'full').length);

	/** Hearts currently playing the lose animation */
	let losing = $state<number[]>([]);
	let previous: number | undefined;
	let timer: ReturnType<typeof setTimeout> | undefined;

	$effect(() => {
		const now = remaining;
		const lost = previous === undefined ? [] : lostHearts(previous, now, max);
		previous = now;
		clearTimeout(timer);
		if (lost.length > 0) {
			losing = lost;
			timer = setTimeout(() => (losing = []), 700);
		} else {
			losing = [];
		}
	});

	$effect(() => () => clearTimeout(timer));
</script>

<span
	class="lives-bar inline-flex items-center gap-0.5 leading-none {className || 'text-xl'}"
	role="img"
	aria-label={m.lives_label({ lives: remaining, max: hearts.length })}
>
	{#each hearts as state, index (index)}
		<span class="heart relative inline-flex" aria-hidden="true">
			{#if state === 'full'}
				<IconHeartFilled class="heart-fill" />
				<IconHeartOutline class="heart-edge absolute inset-0" />
			{:else}
				<IconHeartOutline class="heart-empty" />
				{#if losing.includes(index)}
					<span class="heart-lose absolute inset-0 inline-flex">
						<IconHeartFilled class="heart-fill" />
						<IconHeartOutline class="heart-edge absolute inset-0" />
					</span>
				{/if}
			{/if}
		</span>
	{/each}
</span>

<style>
	.heart :global(svg) {
		width: 1em;
		height: 1em;
	}

	.heart :global(.heart-fill) {
		color: var(--color-heart);
	}

	.heart :global(.heart-edge) {
		color: var(--color-heart-outline);
	}

	.heart :global(.heart-empty) {
		color: var(--color-heart-outline);
		opacity: 0.55;
	}

	.heart-lose {
		animation: heart-lose 650ms ease-out both;
		pointer-events: none;
	}

	@keyframes heart-lose {
		0% {
			scale: 1;
			rotate: 0deg;
			opacity: 1;
		}
		25% {
			scale: 1.4;
			rotate: -12deg;
		}
		50% {
			rotate: 10deg;
		}
		100% {
			scale: 0.6;
			rotate: 0deg;
			opacity: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.heart-lose {
			display: none;
		}
	}
</style>
