<!--
	One Whack figure (a target or a decoy) as a small static picture, for the how-to-play legend.
	It uses the same drawing code as the playfield, so the legend always matches.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { isDecoy, type MoleKind } from '#lib/game/whack/config.js';
	import { CALM_POSE, drawFigure } from '#lib/game/whack/art.js';

	let { kind, class: className = 'size-12' }: { kind: MoleKind; class?: string } = $props();

	let canvas: HTMLCanvasElement | undefined = $state();

	onMount(() => {
		const context = canvas?.getContext('2d');
		if (!canvas || !context) return;
		const ratio = window.devicePixelRatio || 1;
		canvas.width = 48 * ratio;
		canvas.height = 48 * ratio;
		// The figures are about 64 x 82 units: shrink them to fit, feet near the bottom edge
		context.scale(ratio, ratio);
		context.translate(24, 45);
		context.scale(0.52, 0.52);
		drawFigure(context, kind, {
			...CALM_POSE,
			talking: !isDecoy(kind)
		});
	});
</script>

<canvas bind:this={canvas} class={className} aria-hidden="true"></canvas>
