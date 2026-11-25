<!--
	A Beachhead commander rendered in Blender: a horizontal sheet of frames that steps through the
	idle-and-attack loop. The sheet has a transparent background so it sits on the lit hero tile.
-->
<script lang="ts">
	import { HERO_SPRITE_FRAMES, heroSprite, isHeroKind } from './beachheadHeroArt.js';

	let {
		kind,
		size = 168,
		animated = false,
		class: className = ''
	}: {
		kind: string;
		size?: number;
		animated?: boolean;
		class?: string;
	} = $props();

	const src = $derived(heroSprite(isHeroKind(kind) ? kind : 'azov'));
</script>

<div
	class="beachhead-hero-sprite {className}"
	class:animated
	style:width="{size}px"
	style:height="{size}px"
	style:background-image="url({src})"
	style:background-size="{size * HERO_SPRITE_FRAMES}px {size}px"
	style:--sheet-width="{size * HERO_SPRITE_FRAMES}px"
	role="img"
	aria-label={kind}
></div>

<style>
	.beachhead-hero-sprite {
		background-repeat: no-repeat;
		background-position: 0 0;
		image-rendering: auto;
	}

	.animated {
		animation: hero-frames 1.2s steps(12) infinite;
	}

	@keyframes hero-frames {
		from {
			background-position-x: 0;
		}
		to {
			background-position-x: calc(-1 * var(--sheet-width));
		}
	}
</style>
