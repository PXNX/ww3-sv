<!--
	Convoy Runner playfield: draws the strait on a canvas (crisp on high-density screens). The tanker
	is held with a finger or the mouse and follows it 1:1 sideways (shared PointerDrag helper); a tap
	beside it, arrow keys, and A and D change lane. Left and right are always physical, also in
	right-to-left languages.
-->
<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { m } from '$lib/paraglide/messages';
	import { FIELD_HEIGHT, FIELD_WIDTH, SIDE_MARGIN } from '$lib/game/convoy/constants';
	import { drawScene, loadConvoySprites } from '$lib/game/convoy/drawScene';
	import { shipRange } from '$lib/game/convoy/runnerStep';
	import { createFixedLoop, onAppHidden } from '$lib/game/loop';
	import { PointerDrag, clampToBounds, clientToLocal } from '$lib/game/pointerDrag';
	import type { ConvoyGame } from '$lib/stores/convoyGame.svelte';

	let {
		game,
		children
	}: {
		game: ConvoyGame;
		/** Overlays shown on top of the field, such as the start or pause card */
		children?: Snippet;
	} = $props();

	const STEP_MS = 1000 / 60;
	/** Share of the viewport height the field may take, leaving room for the header */
	const MAX_HEIGHT_SHARE = 0.68;
	/** Below this much total movement, a touch is a tap rather than a drag */
	const TAP_PX = 24;
	/** A press this close to the tanker (in lanes) only grabs it; a tap further away steers towards it */
	const TAP_ON_SHIP_LANES = 0.6;

	let wrapper: HTMLDivElement | undefined = $state();
	let canvas: HTMLCanvasElement | undefined = $state();
	let cssWidth = $state(0);
	let cssHeight = $state(0);
	let alpha = 0;

	function draw() {
		const context = canvas?.getContext('2d');
		if (!canvas || !context || cssWidth === 0) return;
		const ratio = window.devicePixelRatio || 1;
		context.setTransform(ratio, 0, 0, ratio, 0, 0);
		context.clearRect(0, 0, cssWidth, cssHeight);
		const scrollAhead =
			game.status === 'running' ? (game.runner.speed * alpha * STEP_MS) / 1000 : 0;
		drawScene(context, game.runner, {
			width: cssWidth,
			height: cssHeight,
			scrollAhead,
			effects: game.effects,
			shakeMs: game.shakeMs,
			reducedMotion: game.reducedMotion,
			timeMs: performance.now()
		});
	}

	function resize() {
		if (!wrapper || !canvas) return;
		const width = Math.min(
			wrapper.clientWidth,
			(window.innerHeight * MAX_HEIGHT_SHARE * FIELD_WIDTH) / FIELD_HEIGHT
		);
		cssWidth = Math.max(1, Math.floor(width));
		cssHeight = Math.floor((cssWidth * FIELD_HEIGHT) / FIELD_WIDTH);
		const ratio = window.devicePixelRatio || 1;
		canvas.width = Math.round(cssWidth * ratio);
		canvas.height = Math.round(cssHeight * ratio);
		draw();
	}

	const loop = createFixedLoop({
		stepMs: STEP_MS,
		update: (stepMs) => game.update(stepMs),
		render: (fraction) => {
			alpha = fraction;
			draw();
		}
	});

	onMount(() => {
		resize();
		loadConvoySprites().then(draw);
		const observer = new ResizeObserver(resize);
		if (wrapper) observer.observe(wrapper);
		window.addEventListener('resize', resize);
		const stopHidden = onAppHidden(() => game.pause());
		return () => {
			loop.pause();
			observer.disconnect();
			window.removeEventListener('resize', resize);
			stopHidden();
		};
	});

	// The loop only runs during play; any other state change still redraws once
	$effect(() => {
		if (game.status === 'running') {
			loop.start();
		} else {
			loop.pause();
			alpha = 0;
			draw();
		}
	});

	function onKeydown(event: KeyboardEvent) {
		if (event.ctrlKey || event.metaKey || event.altKey) return;
		if (event.code === 'KeyP' && !event.repeat) {
			game.togglePause();
			return;
		}
		if (game.status !== 'running' || event.repeat) {
			if (game.status === 'running' && event.key.startsWith('Arrow')) event.preventDefault();
			return;
		}
		if (event.key === 'ArrowLeft' || event.code === 'KeyA') {
			event.preventDefault();
			game.steer(-1);
		} else if (event.key === 'ArrowRight' || event.code === 'KeyD') {
			event.preventDefault();
			game.steer(1);
		}
	}

	/** Field units from the left edge of the field to the center of lane 0 */
	const LANE_ORIGIN = SIDE_MARGIN + 0.5;
	const FIELD = { width: FIELD_WIDTH, height: FIELD_HEIGHT };

	/** Viewport x of a sideways position given in lanes (rect: the canvas, measured fresh) */
	function clientXOfLane(rect: DOMRect, lane: number): number {
		return rect.left + ((LANE_ORIGIN + lane) / FIELD_WIDTH) * rect.width;
	}

	/** Sideways position in lanes under a viewport x */
	function laneAtClientX(rect: DOMRect, clientX: number): number {
		return clientToLocal(rect, { x: clientX, y: 0 }, FIELD).x - LANE_ORIGIN;
	}

	/** The way a tap steers; 0 when the press was on the tanker itself, which only grabs it */
	let tapDirection: -1 | 0 | 1 = 0;

	// The tanker follows the pointer 1:1 on x: pos = pointer + grab offset, no smoothing. The same
	// press-and-drag works for touch and mouse; a quick tap beside the tanker still changes lane.
	const drag = new PointerDrag({
		// The tanker stays inside the open water (the banks move in and out), in viewport pixels
		constrain: (position) => {
			if (!canvas) return position;
			const rect = canvas.getBoundingClientRect();
			const { min, max } = shipRange(game.runner);
			return clampToBounds(position, {
				minX: clientXOfLane(rect, min),
				maxX: clientXOfLane(rect, max),
				minY: Number.NEGATIVE_INFINITY,
				maxY: Number.POSITIVE_INFINITY
			});
		},
		onMove: (session) => {
			if (!canvas) return;
			const rect = canvas.getBoundingClientRect();
			if (game.runner.dragX === null) {
				// An oil slick or the keyboard moved the tanker: take hold again where it is now
				if (!game.grabShip()) return;
				drag.regrab({ x: clientXOfLane(rect, game.runner.x), y: session.pointer.y });
			}
			game.dragShipTo(laneAtClientX(rect, session.position.x));
		},
		onEnd: (session) => {
			game.releaseShip();
			if (tapDirection !== 0 && session.travelled < TAP_PX) game.steer(tapDirection);
		},
		onCancel: () => game.releaseShip()
	});

	function onPointerDown(event: PointerEvent) {
		if (game.status !== 'running' || !canvas) return;
		const rect = canvas.getBoundingClientRect();
		const shipX = game.runner.x;
		const began = drag.begin(event, {
			origin: { x: clientXOfLane(rect, shipX), y: event.clientY },
			capture: canvas
		});
		if (!began) return;
		const gap = laneAtClientX(rect, event.clientX) - shipX;
		tapDirection = Math.abs(gap) <= TAP_ON_SHIP_LANES ? 0 : gap < 0 ? -1 : 1;
		game.grabShip();
	}

	// Pausing, game over or a restart ends any hold
	$effect(() => {
		if (game.status !== 'running') drag.abort();
	});
</script>

<svelte:window onkeydown={onKeydown} />

<div data-playfield class="flex flex-col items-center gap-3">
	<div bind:this={wrapper} class="flex w-full justify-center">
		<div
			class="relative overflow-hidden rounded-[14px_8px_16px_10px] border-3 border-ink shadow-[4px_4px_0_var(--color-ink)]"
			style:width="{cssWidth}px"
			style:height="{cssHeight}px"
		>
			<canvas
				bind:this={canvas}
				class="block size-full touch-none select-none"
				aria-label={m.convoy_playfield_label()}
				onpointerdown={onPointerDown}
				onpointermove={(event) => drag.pointerMove(event)}
				onpointerup={(event) => drag.pointerUp(event)}
				onpointercancel={(event) => drag.pointerCancel(event)}
				oncontextmenu={(event) => event.preventDefault()}
			></canvas>
			{#if children}
				<div class="pointer-events-none absolute inset-0 flex items-center justify-center p-3">
					{@render children()}
				</div>
			{/if}
		</div>
	</div>
</div>
