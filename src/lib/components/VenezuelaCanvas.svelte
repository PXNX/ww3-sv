<!--
	El Presidente playfield: a crisp high-DPI canvas driven by the fixed-step loop, with the touch
	controls under it. The left half of the move strip runs left, the right half runs right (a
	finger can slide between them); holding one side builds up into a sprint. The round jump button
	is held for a higher jump and tapped again in the air for the mustache twirl; the slam button
	(or a swipe down from the jump button) dives onto whatever is below. Each finger is tracked on
	its own, so running and jumping work at the same time. Arrow keys or A/D run, Space, Up or W
	jump, Down or S slam. The playfield never mirrors in right-to-left languages and never scrolls
	(touch-action: none).
-->
<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import { m } from '#lib/paraglide/messages.js';
	import { createFixedLoop, onAppHidden } from '#lib/game/loop.js';
	import { VIEW_H, VIEW_W } from '#lib/game/venezuela/config.js';
	import { KEY_ACTIONS, type Action } from '#lib/game/venezuela/input.js';
	import { drawScene } from '#lib/game/venezuela/render.js';
	import type { VenezuelaGame } from '#lib/stores/venezuelaGame.svelte.js';
	import PauseOverlay from './PauseOverlay.svelte';
	import IconArrowLeft from '~icons/lucide/arrow-left';
	import IconArrowRight from '~icons/lucide/arrow-right';
	import IconChevronsDown from '~icons/lucide/chevrons-down';
	import IconChevronsUp from '~icons/lucide/chevrons-up';
	import IconList from '~icons/lucide/list';
	import IconPlay from '~icons/lucide/play';
	import IconRotate from '~icons/lucide/rotate-ccw';

	let { game, levelName }: { game: VenezuelaGame; levelName: string } = $props();

	let canvas: HTMLCanvasElement | undefined = $state();
	let context: CanvasRenderingContext2D | null = null;
	/** CSS pixels per tile */
	let scale = 1;

	function draw() {
		if (!canvas || !context) return;
		const ratio = window.devicePixelRatio || 1;
		context.setTransform(scale * ratio, 0, 0, scale * ratio, 0, 0);
		drawScene(context, game.world, game.sceneExtras());
	}

	function resize() {
		if (!canvas) return;
		const ratio = window.devicePixelRatio || 1;
		const width = canvas.clientWidth;
		scale = width / VIEW_W;
		canvas.width = Math.round(width * ratio);
		canvas.height = Math.round(width * (VIEW_H / VIEW_W) * ratio);
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
			game.input.clear();
		};
	});

	$effect(() => {
		if (game.status === 'playing') loop.start();
		else loop.pause();
		// Redraw when the state changes while the loop is stopped (ready, pause, a new level, results)
		void game.status;
		void game.levelIndex;
		draw();
	});

	// Touch: each pointer holds one action; the move strip switches between left and right
	const held = new SvelteMap<number, Action>();
	let leftOn = $state(false);
	let rightOn = $state(false);
	let jumpOn = $state(false);
	let slamOn = $state(false);
	let moveStrip: HTMLDivElement | undefined = $state();

	function showHeld() {
		const actions = [...held.values()];
		leftOn = actions.includes('left');
		rightOn = actions.includes('right');
		jumpOn = actions.includes('jump');
		slamOn = actions.includes('slam');
	}

	function press(pointerId: number, action: Action) {
		const previous = held.get(pointerId);
		if (previous === action) return;
		if (previous) game.setHeld(`ptr:${pointerId}`, previous, false);
		held.set(pointerId, action);
		game.setHeld(`ptr:${pointerId}`, action, true);
		showHeld();
	}

	function release(pointerId: number) {
		const previous = held.get(pointerId);
		if (!previous) return;
		held.delete(pointerId);
		game.setHeld(`ptr:${pointerId}`, previous, false);
		showHeld();
	}

	function sideOf(event: PointerEvent): Action {
		const rect = moveStrip?.getBoundingClientRect();
		if (!rect) return 'right';
		return event.clientX < rect.left + rect.width / 2 ? 'left' : 'right';
	}

	function onStripDown(event: PointerEvent) {
		if (event.pointerType === 'mouse' && event.button !== 0) return;
		event.preventDefault();
		try {
			(event.currentTarget as Element).setPointerCapture(event.pointerId);
		} catch {
			// The pointer is already gone
		}
		press(event.pointerId, sideOf(event));
	}

	function onStripMove(event: PointerEvent) {
		if (held.has(event.pointerId)) press(event.pointerId, sideOf(event));
	}

	/** Pixels a finger on the jump button has to slide down to turn into a slam */
	const SWIPE_SLAM_PX = 28;
	/** Where each finger on the jump button went down */
	const jumpStartY = new Map<number, number>();

	function onButtonDown(event: PointerEvent, action: Action) {
		if (event.pointerType === 'mouse' && event.button !== 0) return;
		event.preventDefault();
		try {
			(event.currentTarget as Element).setPointerCapture(event.pointerId);
		} catch {
			// The pointer is already gone
		}
		if (action === 'jump') jumpStartY.set(event.pointerId, event.clientY);
		press(event.pointerId, action);
	}

	// A swipe down from the jump button slams, so the thumb never has to leave it
	function onJumpMove(event: PointerEvent) {
		const startY = jumpStartY.get(event.pointerId);
		if (startY === undefined || event.clientY - startY < SWIPE_SLAM_PX) return;
		jumpStartY.delete(event.pointerId);
		press(event.pointerId, 'slam');
	}

	const onUp = (event: PointerEvent) => {
		jumpStartY.delete(event.pointerId);
		release(event.pointerId);
	};

	// Letting go of everything when the level stops running, so nothing stays held
	$effect(() => {
		if (game.status !== 'playing') {
			untrack(() => {
				for (const id of [...held.keys()]) release(id);
			});
		}
	});

	const isTextInput = (target: EventTarget | null) =>
		target instanceof HTMLElement &&
		target.closest('input, select, textarea, [contenteditable]') !== null;

	function onKeyDown(event: KeyboardEvent) {
		if (event.ctrlKey || event.metaKey || event.altKey) return;
		if (event.code === 'Escape') {
			if (game.status === 'playing') game.pause();
			return;
		}
		if (event.code === 'KeyP' && !event.repeat && !isTextInput(event.target)) {
			game.togglePause();
			return;
		}
		const action = KEY_ACTIONS[event.code];
		if (!action || game.status !== 'playing' || isTextInput(event.target)) return;
		event.preventDefault();
		// A focused button (the pause button, say) must not also react to the same key
		if (document.activeElement instanceof HTMLButtonElement) document.activeElement.blur();
		game.setHeld(`key:${event.code}`, action, true);
	}

	function onKeyUp(event: KeyboardEvent) {
		const action = KEY_ACTIONS[event.code];
		if (action) game.setHeld(`key:${event.code}`, action, false);
	}
</script>

<svelte:window onkeydown={onKeyDown} onkeyup={onKeyUp} />

<div data-playfield class="flex w-full flex-col gap-3 select-none">
	<div class="relative">
		<canvas
			bind:this={canvas}
			class="block aspect-[14/10] w-full touch-none rounded-[14px_8px_16px_10px] border-3 border-ink shadow-[4px_4px_0_var(--color-ink)]"
			style:touch-action="none"
			aria-label={m.venezuela_playfield_label()}
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
				class="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-[14px_8px_16px_10px] bg-ink/35 p-3"
			>
				<div
					class="sticker pop-in flex w-full max-w-xs flex-col items-center gap-2 p-4 text-center"
					style:--tilt="-1.5deg"
				>
					<h2 dir="auto" class="font-display text-2xl leading-tight font-bold">{levelName}</h2>
					<p dir="auto" class="text-sm leading-snug font-semibold">{m.venezuela_ready_hint()}</p>
					{#if game.best !== null}
						<p class="text-sm font-semibold">{m.venezuela_level_best({ score: game.best })}</p>
					{/if}
					<!-- svelte-ignore a11y_autofocus -->
					<button
						type="button"
						class="btn-chunky bg-tie-red text-xl"
						autofocus
						onclick={() => game.start()}
					>
						<IconPlay class="size-5" aria-hidden="true" />
						{m.venezuela_start()}
					</button>
				</div>
			</div>
		{:else if game.status === 'paused'}
			<PauseOverlay onResume={() => game.resume()}>
				<button type="button" class="btn-chunky min-w-44" onclick={() => game.retry()}>
					<IconRotate class="size-5" aria-hidden="true" />
					{m.venezuela_restart()}
				</button>
				<button type="button" class="btn-chunky min-w-44" onclick={() => game.backToSelect()}>
					<IconList class="size-5" aria-hidden="true" />
					{m.venezuela_back_to_levels()}
				</button>
			</PauseOverlay>
		{/if}
	</div>

	<div class="flex items-stretch justify-between gap-3">
		<div
			bind:this={moveStrip}
			class="flex h-20 flex-1 touch-none overflow-hidden rounded-[14px_8px_16px_10px] border-3 border-ink bg-paper shadow-[3px_3px_0_var(--color-ink)] sm:max-w-sm"
			style:touch-action="none"
			role="group"
			aria-label={m.venezuela_ctrl_move()}
			onpointerdown={onStripDown}
			onpointermove={onStripMove}
			onpointerup={onUp}
			onpointercancel={onUp}
			oncontextmenu={(event) => event.preventDefault()}
		>
			<span
				class="flex flex-1 items-center justify-center border-e-3 border-ink {leftOn
					? 'bg-explosion-yellow'
					: 'bg-sand'}"
			>
				<IconArrowLeft class="size-9" aria-hidden="true" />
				<span class="sr-only">{m.venezuela_ctrl_left()}</span>
			</span>
			<span
				class="flex flex-1 items-center justify-center {rightOn
					? 'bg-explosion-yellow'
					: 'bg-sand'}"
			>
				<IconArrowRight class="size-9" aria-hidden="true" />
				<span class="sr-only">{m.venezuela_ctrl_right()}</span>
			</span>
		</div>

		<button
			type="button"
			class="btn-chunky size-16 shrink-0 touch-none flex-col self-end rounded-full p-0 text-xs {slamOn
				? 'bg-explosion-yellow'
				: 'bg-banner-slate text-paper'}"
			style:touch-action="none"
			aria-label={m.venezuela_ctrl_slam()}
			onpointerdown={(event) => onButtonDown(event, 'slam')}
			onpointerup={onUp}
			onpointercancel={onUp}
			oncontextmenu={(event) => event.preventDefault()}
		>
			<IconChevronsDown class="size-7" aria-hidden="true" />
			<span class="font-display font-bold">{m.venezuela_ctrl_slam()}</span>
		</button>

		<button
			type="button"
			class="btn-chunky size-20 shrink-0 touch-none flex-col rounded-full p-0 text-sm {jumpOn
				? 'bg-explosion-yellow'
				: 'bg-tie-red'}"
			style:touch-action="none"
			aria-label={m.venezuela_ctrl_jump()}
			onpointerdown={(event) => onButtonDown(event, 'jump')}
			onpointermove={onJumpMove}
			onpointerup={onUp}
			onpointercancel={onUp}
			oncontextmenu={(event) => event.preventDefault()}
		>
			<IconChevronsUp class="size-9" aria-hidden="true" />
			<span class="font-display font-bold">{m.venezuela_ctrl_jump()}</span>
		</button>
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
