<!--
	Stage A canvas: the wafer stacker. A crisp high-DPI canvas that the parent's fixed-step loop
	redraws through the exported draw(). A tap or click anywhere on the field drops the layer; the
	keyboard works from the page (Space or Enter). The playfield never mirrors in right-to-left
	languages and never scrolls (touch-action: none).
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { drawStacker, WORLD_HEIGHT, WORLD_WIDTH } from '#lib/game/chipfab/render.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { ChipFabGame } from '#lib/stores/chipfabGame.svelte.js';

	let { game }: { game: ChipFabGame } = $props();

	let canvas: HTMLCanvasElement | undefined = $state();
	let context: CanvasRenderingContext2D | null = null;
	/** CSS pixels per world unit */
	let scale = 1;

	export function draw() {
		if (!canvas || !context) return;
		const ratio = window.devicePixelRatio || 1;
		context.setTransform(scale * ratio, 0, 0, scale * ratio, 0, 0);
		drawStacker(context, game.state.stacker, game.sceneExtras());
	}

	function resize() {
		if (!canvas) return;
		const ratio = window.devicePixelRatio || 1;
		const width = canvas.clientWidth;
		scale = width / WORLD_WIDTH;
		canvas.width = Math.round(width * ratio);
		canvas.height = Math.round(((width * WORLD_HEIGHT) / WORLD_WIDTH) * ratio);
		draw();
	}

	onMount(() => {
		if (!canvas) return;
		context = canvas.getContext('2d');
		const observer = new ResizeObserver(resize);
		observer.observe(canvas);
		return () => observer.disconnect();
	});

	function onDown(event: PointerEvent) {
		if (event.pointerType === 'mouse' && event.button !== 0) return;
		event.preventDefault();
		game.drop();
	}
</script>

<canvas
	bind:this={canvas}
	class="absolute inset-0 block size-full touch-none"
	style:touch-action="none"
	aria-label={m.chipfab_playfield_label_stack()}
	onpointerdown={onDown}
	oncontextmenu={(event) => event.preventDefault()}
></canvas>
