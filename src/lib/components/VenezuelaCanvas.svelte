<!--
	El Presidente playfield, made for a phone held sideways: the stage fills whatever space the page
	gives it and the crisp high-DPI canvas inside is as wide as the screen allows (a wide screen
	just shows more of the level, always ten tiles tall). The thumb controls float over the stage:
	big left and right arrows in the bottom-left corner (slide a thumb between them to turn around;
	holding one side builds up into a sprint) and, in the bottom-right corner, a jump pad that
	reacts to a tap anywhere on it, with a smaller slam button beside it (a swipe down on the jump
	pad slams too, so the thumb never has to leave it). The jump is held for a higher jump and tapped
	again in the air for the mustache twirl. Each finger is tracked on its own, so running and
	jumping work at the same time. Arrow keys or A/D run, Space, Up or W jump, Down or S slam. The
	touch controls only show on devices with a touch screen. A small HUD (barrels, hearts and the
	timers of the boosters running) floats at the top. The playfield never mirrors in right-to-left
	languages and never scrolls (touch-action: none).
-->
<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import { m } from '#lib/paraglide/messages.js';
	import { createFixedLoop, onAppHidden } from '#lib/game/loop.js';
	import { BOOST_SECONDS, type TimedBoost } from '#lib/game/venezuela/boosters.js';
	import { STARTING_HEARTS, VIEW_H, VIEW_W, VIEW_W_MAX } from '#lib/game/venezuela/config.js';
	import { KEY_ACTIONS, type Action } from '#lib/game/venezuela/input.js';
	import { drawScene } from '#lib/game/venezuela/render.js';
	import type { VenezuelaGame } from '#lib/stores/venezuelaGame.svelte.js';
	import LivesBar from './LivesBar.svelte';
	import PauseOverlay from './PauseOverlay.svelte';
	import VenezuelaIcon from './VenezuelaIcon.svelte';
	import IconArrowLeft from '~icons/lucide/arrow-left';
	import IconArrowRight from '~icons/lucide/arrow-right';
	import IconChevronsDown from '~icons/lucide/chevrons-down';
	import IconChevronsUp from '~icons/lucide/chevrons-up';
	import IconList from '~icons/lucide/list';
	import IconPlay from '~icons/lucide/play';
	import IconRotate from '~icons/lucide/rotate-ccw';

	let { game, levelName }: { game: VenezuelaGame; levelName: string } = $props();

	let stage: HTMLDivElement | undefined = $state();
	let canvas: HTMLCanvasElement | undefined = $state();
	let context: CanvasRenderingContext2D | null = null;
	/** CSS pixels per tile */
	let scale = 1;

	const BOOSTS: readonly TimedBoost[] = ['turbo', 'boots', 'star'];
	const boostLabels: Record<TimedBoost, () => string> = {
		turbo: m.venezuela_turbo_name,
		boots: m.venezuela_boots_name,
		star: m.venezuela_star_name
	};

	function draw() {
		if (!canvas || !context) return;
		const ratio = window.devicePixelRatio || 1;
		context.setTransform(scale * ratio, 0, 0, scale * ratio, 0, 0);
		drawScene(context, game.world, game.sceneExtras());
	}

	// The canvas is ten tiles tall and as wide as the stage allows, between 14 and 20 tiles; what
	// does not fit (a very wide or a very tall stage) is left as a dark border
	function resize() {
		if (!stage || !canvas) return;
		const width = stage.clientWidth;
		const height = stage.clientHeight;
		if (width === 0 || height === 0) return;
		const viewW = Math.min(VIEW_W_MAX, Math.max(VIEW_W, (width / height) * VIEW_H));
		scale = Math.min(width / viewW, height / VIEW_H);
		const ratio = window.devicePixelRatio || 1;
		canvas.style.width = `${viewW * scale}px`;
		canvas.style.height = `${VIEW_H * scale}px`;
		canvas.width = Math.round(viewW * scale * ratio);
		canvas.height = Math.round(VIEW_H * scale * ratio);
		game.setView(viewW);
		draw();
	}

	const loop = createFixedLoop({ update: (dtMs) => game.update(dtMs), render: draw });

	onMount(() => {
		if (!stage || !canvas) return;
		context = canvas.getContext('2d');
		const observer = new ResizeObserver(resize);
		observer.observe(stage);
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

	// Touch: each pointer holds one action; the move pad switches between left and right
	const held = new SvelteMap<number, Action>();
	let leftOn = $state(false);
	let rightOn = $state(false);
	let jumpOn = $state(false);
	let slamOn = $state(false);
	let movePad: HTMLDivElement | undefined = $state();

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
		const rect = movePad?.getBoundingClientRect();
		if (!rect) return 'right';
		return event.clientX < rect.left + rect.width / 2 ? 'left' : 'right';
	}

	function capture(event: PointerEvent) {
		if (event.pointerType === 'mouse' && event.button !== 0) return false;
		event.preventDefault();
		try {
			(event.currentTarget as Element).setPointerCapture(event.pointerId);
		} catch {
			// The pointer is already gone
		}
		return true;
	}

	function onPadDown(event: PointerEvent) {
		if (capture(event)) press(event.pointerId, sideOf(event));
	}

	function onPadMove(event: PointerEvent) {
		if (held.has(event.pointerId)) press(event.pointerId, sideOf(event));
	}

	/** Pixels a finger on the jump pad has to slide down to turn into a slam */
	const SWIPE_SLAM_PX = 28;
	/** Where each finger on the jump pad went down */
	// eslint-disable-next-line svelte/prefer-svelte-reactivity -- bookkeeping only, never rendered
	const jumpStartY = new Map<number, number>();

	function onJumpDown(event: PointerEvent) {
		if (!capture(event)) return;
		jumpStartY.set(event.pointerId, event.clientY);
		press(event.pointerId, 'jump');
	}

	function onSlamDown(event: PointerEvent) {
		if (capture(event)) press(event.pointerId, 'slam');
	}

	// A swipe down from the jump pad slams, so the thumb never has to leave it
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

<div
	bind:this={stage}
	data-playfield
	class="relative flex min-h-0 flex-1 touch-none items-center justify-center overflow-hidden bg-ink select-none"
	style:touch-action="none"
>
	<canvas
		bind:this={canvas}
		class="block touch-none"
		style:touch-action="none"
		aria-label={m.venezuela_playfield_label()}
		oncontextmenu={(event) => event.preventDefault()}
	></canvas>

	<!-- A red flash around the field whenever a heart is lost -->
	{#key game.hurtCount}
		{#if game.hurtCount > 0 && game.status === 'playing'}
			<div class="hurt pointer-events-none absolute inset-0 border-8 border-tie-red"></div>
		{/if}
	{/key}

	<!-- Barrels, hearts and the boosters that are running: top left, out of the way of the jumps -->
	<div
		class="pointer-events-none absolute top-(--hud-top) left-(--hud-left) z-10 flex max-w-[60%] flex-wrap items-center gap-1.5"
	>
		<div
			class="flex items-center gap-3 rounded-[12px_6px_14px_8px] border-3 border-ink bg-paper px-3 py-0.5 shadow-[3px_3px_0_var(--color-ink)]"
		>
			<span class="flex items-center gap-1">
				<VenezuelaIcon kind="barrel" class="size-6 shrink-0" />
				<span
					class="font-display text-lg font-bold tabular-nums"
					aria-label={m.venezuela_hud_barrels({ count: game.barrels, total: game.barrelsTotal })}
				>
					{game.barrels}/{game.barrelsTotal}
				</span>
			</span>
			<LivesBar lives={game.hearts} max={STARTING_HEARTS} class="shrink-0 text-xl" />
		</div>
		{#each BOOSTS as kind (kind)}
			{#if game.boosts[kind] > 0}
				<div
					class="flex items-center gap-1 rounded-full border-3 border-ink bg-paper py-0.5 ps-1 pe-2"
					role="img"
					aria-label={boostLabels[kind]()}
				>
					<VenezuelaIcon {kind} class="size-6 shrink-0" />
					<span class="h-2.5 w-12 overflow-hidden rounded-full border-2 border-ink bg-sand">
						<span
							class="block h-full bg-explosion-yellow transition-[width] duration-100 ease-linear"
							style:width="{Math.min(100, (game.boosts[kind] / BOOST_SECONDS[kind]) * 100)}%"
						></span>
					</span>
				</div>
			{/if}
		{/each}
	</div>

	<!-- The thumb controls, only on devices with a touch screen -->
	<div
		class="pointer-events-none absolute inset-x-0 bottom-0 z-10 hidden items-end justify-between pr-[max(0.75rem,env(safe-area-inset-right))] pb-[max(0.5rem,env(safe-area-inset-bottom))] pl-[max(0.75rem,env(safe-area-inset-left))] [@media(any-pointer:coarse)]:flex"
	>
		<div
			bind:this={movePad}
			class="pointer-events-auto flex h-[clamp(4.5rem,25vh,6.5rem)] w-[clamp(11rem,30vw,16rem)] touch-none gap-2"
			style:touch-action="none"
			role="group"
			aria-label={m.venezuela_ctrl_move()}
			onpointerdown={onPadDown}
			onpointermove={onPadMove}
			onpointerup={onUp}
			onpointercancel={onUp}
			oncontextmenu={(event) => event.preventDefault()}
		>
			<span
				class="flex flex-1 items-center justify-center rounded-2xl border-3 border-ink shadow-[3px_3px_0_var(--color-ink)] {leftOn
					? 'bg-explosion-yellow'
					: 'bg-paper/75'}"
			>
				<IconArrowLeft class="size-10" aria-hidden="true" />
				<span class="sr-only">{m.venezuela_ctrl_left()}</span>
			</span>
			<span
				class="flex flex-1 items-center justify-center rounded-2xl border-3 border-ink shadow-[3px_3px_0_var(--color-ink)] {rightOn
					? 'bg-explosion-yellow'
					: 'bg-paper/75'}"
			>
				<IconArrowRight class="size-10" aria-hidden="true" />
				<span class="sr-only">{m.venezuela_ctrl_right()}</span>
			</span>
		</div>

		<div class="relative h-[clamp(7rem,44vh,11rem)] w-[clamp(9rem,26vw,13rem)]">
			<!-- A tap anywhere on the pad jumps; the round button only shows where the thumb rests -->
			<div
				class="pointer-events-auto absolute inset-0 touch-none"
				style:touch-action="none"
				role="button"
				tabindex="-1"
				aria-label={m.venezuela_ctrl_jump()}
				onpointerdown={onJumpDown}
				onpointermove={onJumpMove}
				onpointerup={onUp}
				onpointercancel={onUp}
				oncontextmenu={(event) => event.preventDefault()}
			></div>
			<span
				class="btn-chunky pointer-events-none absolute right-0 bottom-0 size-[clamp(4.5rem,25vh,6.5rem)] flex-col rounded-full p-0 text-sm {jumpOn
					? 'bg-explosion-yellow'
					: 'bg-tie-red'}"
				aria-hidden="true"
			>
				<IconChevronsUp class="size-9" aria-hidden="true" />
				<span class="font-display font-bold">{m.venezuela_ctrl_jump()}</span>
			</span>
			<button
				type="button"
				class="btn-chunky absolute bottom-0 left-0 size-[clamp(3.25rem,15vh,4.25rem)] touch-none flex-col rounded-full p-0 text-xs {slamOn
					? 'bg-explosion-yellow'
					: 'bg-banner-slate text-paper'}"
				style:touch-action="none"
				aria-label={m.venezuela_ctrl_slam()}
				onpointerdown={onSlamDown}
				onpointerup={onUp}
				onpointercancel={onUp}
				oncontextmenu={(event) => event.preventDefault()}
			>
				<IconChevronsDown class="size-6" aria-hidden="true" />
				<span class="font-display font-bold">{m.venezuela_ctrl_slam()}</span>
			</button>
		</div>
	</div>

	{#if game.status === 'ready'}
		<div
			class="absolute inset-0 z-20 flex items-center justify-center bg-ink/35 p-3 pt-[calc(0.5rem+var(--top-inset))]"
		>
			<div
				class="sticker pop-in flex max-h-full w-full max-w-md flex-col items-center gap-2 overflow-y-auto p-4 text-center"
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
