<!--
	The raid's minimap: the battlefield with the markers that matter (bosses, super and mega enemies,
	enemy support, the enemies an open quest asks for, the player's own drones and nests) and the
	player. Live, it redraws a few times a second (the small one in the HUD); otherwise it draws once
	(the big one in the map overlay, while the raid stands still).
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import type { Archetype } from '#lib/game/raid/config.js';
	import { drawMinimap } from '#lib/game/raid/render.js';
	import type { RaidState } from '#lib/game/raid/state.js';

	let {
		raid,
		width,
		height,
		markScale = 1,
		live = false,
		questTargets,
		label,
		class: className = ''
	}: {
		/** Read on every redraw, so a new raid's state is picked up */
		raid: () => RaidState;
		width: number;
		height: number;
		markScale?: number;
		live?: boolean;
		/** The enemy types an open daily quest still asks to be killed, read on every redraw */
		questTargets?: () => readonly Archetype[];
		label: string;
		class?: string;
	} = $props();

	let canvas: HTMLCanvasElement | undefined = $state();

	function draw() {
		const context = canvas?.getContext('2d');
		if (!canvas || !context) return;
		const ratio = window.devicePixelRatio || 1;
		canvas.width = Math.round(width * ratio);
		canvas.height = Math.round(height * ratio);
		context.setTransform(ratio, 0, 0, ratio, 0, 0);
		drawMinimap(context, raid(), width, height, markScale, questTargets?.() ?? []);
	}

	onMount(() => {
		draw();
		if (!live) return;
		const timer = setInterval(draw, 120);
		return () => clearInterval(timer);
	});
</script>

<span role="img" aria-label={label} class="block {className}">
	<canvas
		bind:this={canvas}
		class="block rounded-[inherit]"
		style:width="{width}px"
		style:height="{height}px"
	></canvas>
</span>
