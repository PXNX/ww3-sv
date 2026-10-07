<!--
	One Radar Slice silhouette (a threat or a decoy) as a small static picture, for the how-to-play
	legend. It uses the same drawing code as the playfield, so the legend always matches.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { drawSilhouette } from '#lib/game/slice/art.js';
	import type { FlyerKind } from '#lib/game/slice/config.js';

	let { kind, class: className = 'size-12' }: { kind: FlyerKind; class?: string } = $props();

	/** Radius and offset that center each shape in the 48 x 48 picture */
	const FIT: Record<FlyerKind, { r: number; dx: number; dy: number }> = {
		zircon: { r: 11, dx: 5, dy: 0 },
		kinzhal: { r: 12, dx: 3, dy: 0 },
		geran: { r: 14, dx: 0, dy: 0 },
		kalibr: { r: 12, dx: 3, dy: 0 },
		tanker: { r: 17, dx: 0, dy: 3 },
		balloon: { r: 12, dx: 0, dy: -6 },
		gull: { r: 16, dx: 0, dy: 2 }
	};

	let canvas: HTMLCanvasElement | undefined = $state();

	onMount(() => {
		const context = canvas?.getContext('2d');
		if (!canvas || !context) return;
		const ratio = window.devicePixelRatio || 1;
		canvas.width = 48 * ratio;
		canvas.height = 48 * ratio;
		const fit = FIT[kind];
		context.scale(ratio, ratio);
		context.translate(24 + fit.dx, 24 + fit.dy);
		drawSilhouette(context, kind, fit.r, { seconds: 0, calm: true });
	});
</script>

<canvas bind:this={canvas} class={className} aria-hidden="true"></canvas>
