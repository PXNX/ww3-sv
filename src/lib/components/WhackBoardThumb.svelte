<!--
	A small picture of one Whack board (backdrop and a row of podiums) for the board picker. It uses
	the same drawing code as the playfield, so the picture always matches the real board.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import type { BoardId } from '#lib/game/whack/config.js';
	import { drawBoardThumbnail } from '#lib/game/whack/render.js';

	let { board, class: className = 'h-10 w-18' }: { board: BoardId; class?: string } = $props();

	const WIDTH = 72;
	const HEIGHT = 40;

	let canvas: HTMLCanvasElement | undefined = $state();

	onMount(() => {
		const context = canvas?.getContext('2d');
		if (!canvas || !context) return;
		const ratio = window.devicePixelRatio || 1;
		canvas.width = WIDTH * ratio;
		canvas.height = HEIGHT * ratio;
		context.scale(ratio, ratio);
		drawBoardThumbnail(context, board, WIDTH, HEIGHT);
	});
</script>

<canvas
	bind:this={canvas}
	class="{className} rounded-[6px_4px_7px_5px] border-2 border-ink"
	aria-hidden="true"
></canvas>
