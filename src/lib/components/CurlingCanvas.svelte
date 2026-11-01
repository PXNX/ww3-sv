<!--
	Canvas for Iceberg Curling: a crisp high-DPI canvas driven by the fixed-step loop.
	Aim by dragging back to set power and angle, release to throw the stone.
	Sweep by holding the sweep button during sliding.
	Stone travels across the ice sheet toward the house ("For Sale" sign at center).
	Seals appear randomly and bounce when hit.
	A lost penguin drifts across the background.
	The playfield never mirrors in right-to-left languages.
-->
<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { createFixedLoop, onAppHidden } from '#lib/game/loop.js';
	import { stepCurl } from '#lib/game/curling/state.js';
	import { drawIceSheet, drawHouse, drawStone, drawSeal, drawPenguin } from '#lib/game/curling/render.js';
	import { createRandom, randomSeed, type Random } from '#lib/game/random.js';
	import { m } from '#lib/paraglide/messages.js';
	import { haptic } from '#lib/haptic/haptic.svelte.js';
	import { soundManager } from '#lib/sound/soundManager.svelte.js';

	let { game, children }: { game: any; children?: Snippet } = $props();

	let canvas: HTMLCanvasElement | undefined = $state();
	let context: CanvasRenderingContext2D | null = null;
	let scale = 1;
	let dragging = false;
	let dragStartX = 0;
	let dragStartY = 0;

	const random = createRandom(seedFromString('curling'));

	function draw() {
		if (!canvas || !context) return;
		const ratio = window.devicePixelRatio || 1;
		context.setTransform(scale * ratio, 0, 0, scale * ratio, 0, 0);

		drawIceSheet(context, canvas.width, canvas.height);
		drawHouse(context, canvas.width, canvas.height);
		
		drawStone(context, game.state, canvas.width, canvas.height);
		
		for (let i = 0; i < game.state.sealsHit; i++) {
			const x = game.sealPositions[i]?.x ?? 0.5 + (Math.random() - 0.5) * 0.3;
			const y = game.sealPositions[i]?.y ?? 0.3 + (Math.random() - 0.5) * 0.1;
			drawSeal(context, x, y, canvas.width, canvas.height);
		}
		
		drawPenguin(context, 0.1, 0.3, canvas.width, canvas.height, game.state.penguinLost);
		
		drawScoreCounter(context, game.state, canvas.width, canvas.height);
		
		drawPowerIndicator(context, game.power, canvas.width, canvas.height);
	}

	function drawPowerIndicator(context: CanvasRenderingContext2D, power: number, width: number, height: number) {
		if (game.cState !== 'aiming') return;
		context.save();
		context.fillStyle = 'rgba(0,0,0,0.6)';
		context.fillRect(10, height - 60, 120, 20);
		context.fillStyle = '#ff6b6b';
		context.fillRect(10, height - 60, (power / 100) * 120, 20);
		context.strokeStyle = '#fff';
		context.strokeRect(10, height - 60, 120, 20);
		context.fillStyle = '#fff';
		context.font = 'bold 16px sans-serif';
		context.textAlign = 'center';
		context.fillText(`${power}%`, 70, height - 40);
		context.restore();
	}

	function drawScoreCounter(context: CanvasRenderingContext2D, state: any, width: number, height: number) {
		context.fillStyle = 'rgba(0,0,0,0.8)';
		context.font = 'bold 24px system-ui, sans-serif';
		context.textAlign = 'center';
		context.fillText(`End ${state.ends + 1}/8`, width / 2, height / 2 - 20);
		context.fillText(`${Math.round(state.score)} pts`, width / 2, height / 2 + 20);
	}

	function resize() {
		if (!canvas) return;
		const ratio = window.devicePixelRatio || 1;
		const width = canvas.clientWidth;
		const height = canvas.clientHeight;
		scale = width / 640;
		canvas.width = Math.round(width * ratio);
		canvas.height = Math.round(height * ratio);
		draw();
	}

	const loop = createFixedLoop({
		update: (dtMs: number) => game.update(dtMs),
		render: () => draw()
	});

	onMount(() => {
		if (!canvas) return;
		context = canvas.getContext('2d');
		const observer = new ResizeObserver(resize);
		observer.observe(canvas);
		const stopHidden = onAppHidden(() => game.pause());
		return () => {
			loop.pause();
			observer.disconnect();
			stopHidden();
		};
	});

	$effect(() => {
		if (game.status === 'playing') {
			loop.start();
		} else {
			loop.pause();
			draw();
		}
	});

	function worldPoint(event: PointerEvent) {
		const rect = canvas!.getBoundingClientRect();
		return {
			x: ((event.clientX - rect.left) / rect.width) * 640,
			y: ((event.clientY - rect.top) / rect.height) * 420
		};
	}

	function onDown(event: PointerEvent) {
		if (game.status !== 'playing') return;
		const point = worldPoint(event);
		
		if (game.cState === 'aiming' && !game.sweeping) {
			dragging = true;
			dragStartX = point.x;
			dragStartY = point.y;
			dragPower = game.power;
			dragAngle = game.angle;
		}
	}

	function onMove(event: PointerEvent) {
		if (!dragging || !game.sweeping || game.status !== 'playing') return;
		const point = worldPoint(event);
		// Sweep logic: update stone velocity based on drag direction
		const dx = point.x - dragStartX;
		const dy = point.y - dragStartY;
		const angle = Math.atan2(dy, dx);
		const power = Math.sqrt(dx * dx + dy * dy);
		if (power > 5) {
			dragging = false;
			dragStartX = 0;
			dragStartY = 0;
			game.sweep(true);
		}
	}

	function onUp(event: PointerEvent) {
		if (game.status !== 'playing') return;
		const point = worldPoint(event);
		if (dragging && game.cState === 'aiming' && !game.sweeping) {
			dragging = false;
			const dx = point.x - dragStartX;
			const dy = point.y - dragStartY;
			const distance = Math.sqrt(dx * dx + dy * dy);
			const angle = Math.atan2(dy, dx);
			game.power = Math.min(80, Math.max(20, distance));
			game.angle = (angle * 180) / Math.PI;
			game.throwStone();
		}
	}

	const isInteractive = (target: EventTarget | null) =>
		target instanceof HTMLElement &&
		target.closest('button, a, input, select, textarea, [contenteditable]') !== null;

	function onKey(event: KeyboardEvent) {
		if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
		event.preventDefault();
		if (game.status !== 'playing') return;
		
		if (event.code === 'KeyR' && game.cState === 'aiming') {
			dragging = true;
			dragStartX = 640 / 2;
			dragStartY = 420 / 2;
			dragPower = game.power;
			dragAngle = game.angle;
			distance = Math.random() * 50;
			angle = (Math.random() * Math.PI - Math.PI / 2) * 0.8;
		}
	}

	let dragPower = 0;
	let dragAngle = 0;
	let distance = 0;
	let angle = 0;
</script>

<svelte:window onkeydown={onKey} />

<div class="relative w-full select-none">
	<canvas
		bind:this={canvas}
		class="block aspect-[640/420] w-full touch-none rounded-[14px_8px_16px_10px] border-3 border-ink shadow-[4px_4px_0_var(--color-ink)]"
		aria-label="Iceberg Curling"
		onpointerdown={onDown}
		onpointermove={onMove}
		onpointerup={onUp}
		onpointercancel={() => (dragging = false)}
		oncontextmenu={(event) => event.preventDefault()}
	></canvas>
	
	{#if game.fenceArmed && game.status === 'playing'}
		<p
			class="pointer-events-none absolute inset-x-0 bottom-3 mx-auto w-fit rounded-md border-2 border-ink bg-explosion-yellow px-2 py-0.5 font-display text-sm font-bold"
		>
			Drag to arm sweep
		</p>
	{/if}
</div>