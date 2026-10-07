<!--
	Run Comrade playfield: a crisp high-DPI canvas driven by the fixed-step loop. A swipe sideways
	changes lane, a swipe up jumps and a swipe down ducks; a tap above the runner's feet jumps and a
	tap on or below them ducks (the shared PointerDrag helper tracks the finger). Arrow keys, WASD
	and Space do the same from a keyboard. The playfield never mirrors in right-to-left languages and
	never scrolls (touch-action: none).
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { createFixedLoop, onAppHidden } from '#lib/game/loop.js';
	import { PointerDrag, type Rect } from '#lib/game/pointerDrag.js';
	import { WORLD_HEIGHT, WORLD_WIDTH } from '#lib/game/runcomrade/config.js';
	import { createGesture, type Gesture } from '#lib/game/runcomrade/input.js';
	import { drawScene } from '#lib/game/runcomrade/render.js';
	import type { Command } from '#lib/game/runcomrade/step.js';
	import type { RunComradeGame } from '#lib/stores/runcomradeGame.svelte.js';
	import PauseOverlay from './PauseOverlay.svelte';
	import IconPlay from '~icons/lucide/play';

	let { game }: { game: RunComradeGame } = $props();

	let canvas: HTMLCanvasElement | undefined = $state();
	let context: CanvasRenderingContext2D | null = null;
	/** CSS pixels per world unit */
	let scale = 1;

	function draw() {
		if (!canvas || !context) return;
		const ratio = window.devicePixelRatio || 1;
		context.setTransform(scale * ratio, 0, 0, scale * ratio, 0, 0);
		drawScene(context, game.state, game.sceneExtras());
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

	const loop = createFixedLoop({ update: (dtMs) => game.update(dtMs), render: draw });

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
			drag.abort();
		};
	});

	$effect(() => {
		if (game.status === 'playing') {
			loop.start();
		} else {
			loop.pause();
		}
		// Redraw when the state changes while the loop is stopped (pause, a new game, game over)
		void game.status;
		draw();
	});

	/** The drawn area in viewport pixels (inside the border) */
	function fieldRect(): Rect | null {
		if (!canvas) return null;
		const rect = canvas.getBoundingClientRect();
		return {
			left: rect.left + canvas.clientLeft,
			top: rect.top + canvas.clientTop,
			width: canvas.clientWidth,
			height: canvas.clientHeight
		};
	}

	let gesture: Gesture = createGesture();

	const drag = new PointerDrag({
		onStart: () => {
			gesture = createGesture();
		},
		onMove: (session) => {
			const action = gesture.move(
				session.pointer.x - session.start.x,
				session.pointer.y - session.start.y
			);
			if (action) game.command(action);
		},
		onEnd: (session) => {
			const rect = fieldRect();
			const share = rect && rect.height > 0 ? (session.pointer.y - rect.top) / rect.height : 0;
			const action = gesture.release(
				session.pointer.x - session.start.x,
				session.pointer.y - session.start.y,
				share
			);
			if (action) game.command(action);
		}
	});

	function onCanvasDown(event: PointerEvent) {
		if (game.status !== 'playing') return;
		if (drag.begin(event, { capture: canvas })) event.preventDefault();
	}

	const isInteractive = (target: EventTarget | null) =>
		target instanceof HTMLElement &&
		target.closest('button, a, input, select, textarea, [contenteditable]') !== null;

	const KEY_COMMANDS: Record<string, Command> = {
		ArrowLeft: 'left',
		KeyA: 'left',
		ArrowRight: 'right',
		KeyD: 'right',
		ArrowUp: 'jump',
		KeyW: 'jump',
		Space: 'jump',
		ArrowDown: 'duck',
		KeyS: 'duck'
	};

	function onKey(event: KeyboardEvent) {
		if (game.status === 'over' || event.ctrlKey || event.metaKey || event.altKey) return;
		if (event.code === 'Escape') {
			if (game.status === 'playing') game.pause();
		} else if (event.code === 'KeyP' && !event.repeat && !isInteractive(event.target)) {
			game.togglePause();
		} else if (game.status === 'playing' && !isInteractive(event.target)) {
			const action = KEY_COMMANDS[event.code];
			if (action) {
				event.preventDefault();
				if (!event.repeat) game.command(action);
			}
		}
	}
</script>

<svelte:window onkeydown={onKey} />

<div data-playfield class="flex w-full flex-col gap-3 select-none">
	<div class="relative">
		<canvas
			bind:this={canvas}
			class="block aspect-[36/56] w-full touch-none rounded-[14px_8px_16px_10px] border-3 border-ink shadow-[4px_4px_0_var(--color-ink)]"
			style:touch-action="none"
			aria-label={m.runcomrade_playfield_label()}
			onpointerdown={onCanvasDown}
			onpointermove={(event) => drag.pointerMove(event)}
			onpointerup={(event) => drag.pointerUp(event)}
			onpointercancel={(event) => drag.pointerCancel(event)}
			oncontextmenu={(event) => event.preventDefault()}
		></canvas>

		<!-- A red flash around the field whenever a heart is lost -->
		{#key game.hurtCount}
			{#if game.hurtCount > 0 && game.status === 'playing'}
				<div
					class="hurt pointer-events-none absolute inset-0 rounded-[14px_8px_16px_10px] border-8 border-tie-red"
				></div>
			{/if}
		{/key}

		{#if game.status === 'ready'}
			<div
				class="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-[14px_8px_16px_10px] bg-ink/35 p-4"
			>
				<div
					class="sticker pop-in flex w-full max-w-xs flex-col items-center gap-3 p-4 text-center"
					style:--tilt="-1.5deg"
				>
					<p dir="auto" class="text-sm leading-snug font-semibold">{m.runcomrade_ready_hint()}</p>
					{#if game.best !== null}
						<p class="text-sm font-semibold">{m.runcomrade_best({ score: game.best })}</p>
					{/if}
					<button type="button" class="btn-chunky bg-tie-red text-xl" onclick={() => game.start()}>
						<IconPlay class="size-5" aria-hidden="true" />
						{m.runcomrade_start()}
					</button>
				</div>
			</div>
		{:else if game.status === 'paused'}
			<PauseOverlay onResume={() => game.resume()} />
		{/if}
	</div>
</div>

<style>
	.hurt {
		animation: hurt 420ms ease-out forwards;
	}

	@keyframes hurt {
		from {
			opacity: 0.85;
		}
		to {
			opacity: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.hurt {
			animation-duration: 1ms;
		}
	}
</style>
