<!--
	Hermit Hackers easter egg for the `matrix` command: green glyph rain over the terminal for a few
	seconds, then it fades. A tap ends it early. With reduced motion it shows one still frame briefly.
-->
<script lang="ts">
	import { onMount } from 'svelte';

	let { onDone }: { onDone: () => void } = $props();

	let canvas: HTMLCanvasElement | undefined = $state();
	const GLYPHS = 'アカサタナハマヤラワ01ドージライト$€¥◆★▲●';
	const DURATION_MS = 4500;

	onMount(() => {
		const node = canvas;
		const context = node?.getContext('2d');
		if (!node || !context) {
			onDone();
			return;
		}
		const ratio = window.devicePixelRatio || 1;
		node.width = node.clientWidth * ratio;
		node.height = node.clientHeight * ratio;
		context.scale(ratio, ratio);
		const size = 14;
		const columns = Math.ceil(node.clientWidth / size);
		const drops = Array.from({ length: columns }, () => Math.random() * -40);
		const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
		const start = performance.now();
		let frame = 0;

		const draw = (now: number) => {
			context.fillStyle = 'rgb(1 10 4 / 0.18)';
			context.fillRect(0, 0, node.clientWidth, node.clientHeight);
			context.font = `${size}px monospace`;
			for (let column = 0; column < columns; column++) {
				const glyph = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
				const y = drops[column] * size;
				context.fillStyle = Math.random() < 0.08 ? '#d8ffe2' : '#39ff6a';
				context.fillText(glyph, column * size, y);
				drops[column] = y > node.clientHeight && Math.random() > 0.97 ? 0 : drops[column] + 1;
			}
			if (now - start < (reduced ? 1500 : DURATION_MS)) {
				if (!reduced) frame = requestAnimationFrame(draw);
				else frame = window.setTimeout(() => onDone(), 1500);
			} else onDone();
		};
		frame = requestAnimationFrame(draw);
		return () => {
			cancelAnimationFrame(frame);
			clearTimeout(frame);
		};
	});
</script>

<button
	type="button"
	class="absolute inset-0 z-20 block cursor-pointer bg-[#010a04]"
	aria-label="Matrix"
	onclick={onDone}
>
	<canvas bind:this={canvas} class="size-full" aria-hidden="true"></canvas>
</button>
