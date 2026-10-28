<!--
	APP-6 style division symbol: a friendly frame is a rectangle, a hostile one a diamond, and the
	glyph inside says infantry (saltire), armour (oval), artillery (filled circle) or mechanised
	(both saltire and oval). Drawn as plain shapes so it scales and needs no image files.
-->
<script lang="ts">
	import type { Owner, TemplateId } from '#lib/game/warroom/config.js';

	let {
		kind,
		side = 'player',
		class: className = 'h-4 w-6'
	}: { kind: TemplateId; side?: Owner; class?: string } = $props();

	const clip = $props.id();
</script>

<svg viewBox="0 0 32 24" class={className} aria-hidden="true">
	<defs>
		<clipPath id={clip}>
			{#if side === 'enemy'}
				<polygon points="16,1 31,12 16,23 1,12" />
			{:else}
				<rect x="1" y="1" width="30" height="22" />
			{/if}
		</clipPath>
	</defs>
	{#if side === 'enemy'}
		<polygon
			points="16,1 31,12 16,23 1,12"
			fill="#f6b7b9"
			stroke="var(--color-ink)"
			stroke-width="2"
			stroke-linejoin="round"
		/>
	{:else}
		<rect
			x="1"
			y="1"
			width="30"
			height="22"
			fill="#bfe3f5"
			stroke="var(--color-ink)"
			stroke-width="2"
		/>
	{/if}
	<g clip-path="url(#{clip})">
		{#if kind === 'armour' || kind === 'mech'}
			<ellipse
				cx="16"
				cy="12"
				rx="9"
				ry="4.6"
				fill="none"
				stroke="var(--color-ink)"
				stroke-width="1.8"
			/>
		{/if}
		{#if kind === 'infantry' || kind === 'mech'}
			<path
				d="M4.5 4.5 27.5 19.5M27.5 4.5 4.5 19.5"
				stroke="var(--color-ink)"
				stroke-width="1.8"
				fill="none"
			/>
		{/if}
		{#if kind === 'artillery'}
			<circle cx="16" cy="12" r="4.6" fill="var(--color-ink)" />
		{/if}
	</g>
</svg>
