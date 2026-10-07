<!-- Three-star rating drawn as shapes: filled stars earned, outlined stars not (never color alone) -->
<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';

	let { stars, class: className = 'size-5' }: { stars: number; class?: string } = $props();
</script>

<span
	class="inline-flex items-center gap-0.5"
	role="img"
	aria-label={m.parking_level_stars({ stars })}
>
	{#each [1, 2, 3] as index (index)}
		<svg viewBox="0 0 24 24" class={className} aria-hidden="true">
			<path
				d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z"
				fill={index <= stars ? 'var(--color-explosion-yellow)' : 'var(--color-paper)'}
				stroke="var(--color-ink)"
				stroke-width="2"
				stroke-linejoin="round"
				stroke-dasharray={index <= stars ? undefined : '3 2'}
			/>
		</svg>
	{/each}
</span>
