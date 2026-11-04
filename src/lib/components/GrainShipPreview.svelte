<!-- A small portrait of a grain ship for the ship picker, drawn with the game's own renderer -->
<script lang="ts">
	import { drawShip } from '#lib/game/grain/drawScene.js';
	import type { ShipId } from '#lib/game/grain/config.js';

	let { shipId, class: className = '' }: { shipId: ShipId; class?: string } = $props();

	let canvas: HTMLCanvasElement | undefined = $state();

	$effect(() => {
		const context = canvas?.getContext('2d');
		if (!canvas || !context) return;
		const ratio = window.devicePixelRatio || 1;
		canvas.width = Math.round(56 * ratio);
		canvas.height = Math.round(88 * ratio);
		context.setTransform(ratio, 0, 0, ratio, 0, 0);
		context.clearRect(0, 0, 56, 88);
		drawShip(context, shipId, 28, 44, 0, 0, 0.6, true, true);
	});
</script>

<canvas bind:this={canvas} class={['h-[88px] w-[56px]', className]} aria-hidden="true"></canvas>
