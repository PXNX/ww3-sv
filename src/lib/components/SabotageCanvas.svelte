<!--
	Gig Saboteur playfield: a crisp high-DPI canvas driven by the fixed-step loop. The whole map fits
	the canvas, whatever its shape. While a job is on, the keys steer (WASD or the arrows, Shift to
	run, Ctrl or C to sneak, Space or E to sabotage, F to arm the phone, P or Escape to pause); with
	the phone armed a tap on the map throws it there. Overlays (job card, pause, results) are passed
	in as children and sit on top. The playfield never mirrors in right-to-left languages and never
	scrolls (touch-action: none).
-->
<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { createFixedLoop, onAppHidden } from '#lib/game/loop.js';
	import { createSabotage } from '#lib/game/sabotage/state.js';
	import { fitView, screenToTile, drawScene, type View } from '#lib/game/sabotage/render.js';
	import { SABOTAGE_TEXT } from '#lib/game/sabotage/text.js';
	import { isMoveKey, type SabotageGame } from '#lib/stores/sabotageGame.svelte.js';

	let { game, children }: { game: SabotageGame; children?: Snippet } = $props();

	let canvas: HTMLCanvasElement | undefined = $state();
	let context: CanvasRenderingContext2D | null = null;
	let width = 0;
	let height = 0;
	let view: View = { tile: 24, ox: 0, oy: 0 };

	// While no job is running the canvas shows the job's map as it will start
	const preview = $derived(game.sim ? null : createSabotage(game.level));

	const GAME_KEYS = new Set([
		'ShiftLeft',
		'ShiftRight',
		'ControlLeft',
		'ControlRight',
		'KeyC',
		'Space',
		'KeyE'
	]);

	function draw() {
		const sim = game.sim ?? preview;
		if (!canvas || !context || !sim || width === 0) return;
		const ratio = window.devicePixelRatio || 1;
		context.setTransform(ratio, 0, 0, ratio, 0, 0);
		drawScene(
			context,
			sim,
			{ time: sim.time, shake: game.shake, phoneArmed: game.phoneArmed, effects: game.effects },
			view,
			width,
			height
		);
	}

	function resize() {
		if (!canvas) return;
		const ratio = window.devicePixelRatio || 1;
		width = canvas.clientWidth;
		height = canvas.clientHeight;
		canvas.width = Math.round(width * ratio);
		canvas.height = Math.round(height * ratio);
		view = fitView(width, height, game.level.grid);
		draw();
	}

	const loop = createFixedLoop({
		update: (dtMs) => game.update(dtMs),
		render: () => {
			draw();
			// After a bust or a clear the loop only runs on until the shake and the explosions are gone
			if (game.screen !== 'playing' && game.effects.length === 0 && game.shake === 0) loop.pause();
		}
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
		if (game.screen === 'playing' || game.screen === 'busted' || game.screen === 'cleared') {
			loop.start();
		} else {
			loop.pause();
		}
		// Every level has its own size
		void game.levelIndex;
		void game.screen;
		resize();
	});

	function onPointerDown(event: PointerEvent) {
		if (!canvas || !game.phoneArmed) return;
		const rect = canvas.getBoundingClientRect();
		const spot = screenToTile(view, event.clientX - rect.left, event.clientY - rect.top);
		if (game.throwAt(spot.x, spot.y)) event.preventDefault();
	}

	const isTyping = (target: EventTarget | null) =>
		target instanceof HTMLElement &&
		target.closest('input, textarea, select, [contenteditable]') !== null;

	function onKeyDown(event: KeyboardEvent) {
		if (event.altKey || event.metaKey || isTyping(event.target)) return;
		if (event.code === 'Escape' || (event.code === 'KeyP' && !event.repeat)) {
			if (game.screen === 'playing') {
				game.pause();
				event.preventDefault();
			}
			return;
		}
		if (game.screen !== 'playing') return;
		if (isMoveKey(event.code) || GAME_KEYS.has(event.code)) {
			game.setKey(event.code, true);
			event.preventDefault();
		} else if (event.code === 'KeyF' && !event.repeat) {
			game.armPhone();
			event.preventDefault();
		}
	}

	function onKeyUp(event: KeyboardEvent) {
		if (isMoveKey(event.code) || GAME_KEYS.has(event.code)) game.setKey(event.code, false);
	}
</script>

<svelte:window onkeydown={onKeyDown} onkeyup={onKeyUp} />

<div data-playfield dir="ltr" class="relative min-h-0 flex-1 overflow-hidden select-none">
	<canvas
		bind:this={canvas}
		class="absolute inset-0 block size-full touch-none"
		style:touch-action="none"
		aria-label={SABOTAGE_TEXT.playfieldLabel}
		onpointerdown={onPointerDown}
		oncontextmenu={(event) => event.preventDefault()}
	></canvas>

	<!-- A red flash around the field whenever the player is busted -->
	{#key game.bustCount}
		{#if game.bustCount > 0 && game.screen !== 'select'}
			<div class="bust pointer-events-none absolute inset-0 border-8 border-tie-red"></div>
		{/if}
	{/key}

	{@render children?.()}
</div>

<style>
	.bust {
		animation: bust 520ms ease-out forwards;
	}

	@keyframes bust {
		from {
			opacity: 1;
		}
		to {
			opacity: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.bust {
			animation: none;
			opacity: 0;
		}
	}
</style>
