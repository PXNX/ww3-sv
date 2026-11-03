<!-- A resource picture (logs, rock, iron ingots, gold coins) as a small inline SVG -->
<script lang="ts">
	import {
		ICON_INK,
		ICON_STROKE,
		RESOURCE_SHAPES,
		type ResourceId
	} from '#lib/game/beachhead/resourceIcons.js';

	let { kind, class: className = 'size-5' }: { kind: ResourceId; class?: string } = $props();
</script>

<svg class={className} viewBox="0 0 24 24" aria-hidden="true" stroke-linejoin="round">
	{#each RESOURCE_SHAPES[kind] as shape, index (index)}
		<path
			d={shape.d}
			fill={shape.fill}
			stroke={shape.soft ? 'none' : ICON_INK}
			stroke-width={ICON_STROKE}
		/>
	{/each}
</svg>
