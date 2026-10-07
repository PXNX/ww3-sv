<!--
	One Run Comrade thing (an obstacle, a pickup, the drone or the runner) as a small static picture
	for the how-to-play legend. It uses the same drawing code as the playfield, so the legend always
	matches.
-->
<script lang="ts" module>
	export type RunComradeIconKind =
		'ditch' | 'arm' | 'mine' | 'helmet' | 'rice' | 'drone' | 'sunflower' | 'runner';
</script>

<script lang="ts">
	import { onMount } from 'svelte';
	import {
		IDLE_POSE,
		drawDitch,
		drawDrone,
		drawHelmet,
		drawMine,
		drawRiceBowl,
		drawRunner,
		drawSunflower,
		drawTractorArm
	} from '#lib/game/runcomrade/art.js';

	let { kind, class: className = 'size-12' }: { kind: RunComradeIconKind; class?: string } =
		$props();

	let canvas: HTMLCanvasElement | undefined = $state();

	onMount(() => {
		const context = canvas?.getContext('2d');
		if (!canvas || !context) return;
		const ratio = window.devicePixelRatio || 1;
		canvas.width = 48 * ratio;
		canvas.height = 48 * ratio;
		context.scale(ratio, ratio);
		switch (kind) {
			case 'ditch':
				drawDitch(context, 24, 32, 0.42);
				break;
			case 'arm':
				drawTractorArm(context, 22, 44, 0.5);
				break;
			case 'mine':
				drawMine(context, 20, 40, 0.8, true);
				break;
			case 'helmet':
				drawHelmet(context, 24, 38, 1.05, 1);
				break;
			case 'rice':
				drawRiceBowl(context, 24, 42, 0.95, 0);
				break;
			case 'drone':
				drawDrone(context, 24, 22, 0.55, 0.2);
				break;
			case 'sunflower':
				drawSunflower(context, 24, 46, 1.1, 30, 0);
				break;
			case 'runner':
				drawRunner(context, 24, 46, 0.5, IDLE_POSE);
				break;
		}
	});
</script>

<canvas bind:this={canvas} class={className} aria-hidden="true"></canvas>
