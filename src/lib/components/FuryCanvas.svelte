<!--
	Magyar's Birds playing field: high-DPI canvas rendering, slingshot input (touch and mouse drag,
	or the keyboard), the bird squad and the tap ability. The field stays left-to-right in every
	language; the surrounding chrome mirrors.
-->
<script lang="ts" module>
	import type { BirdKind } from '#lib/game/fury/birds.js';
	import { m } from '#lib/paraglide/messages.js';

	const BIRD_NAMES: Record<BirdKind, () => string> = {
		flamingo: m.fury_bird_flamingo,
		pelican: m.fury_bird_pelican,
		stork: m.fury_bird_stork,
		goose: m.fury_bird_goose,
		falcon: m.fury_bird_falcon,
		phoenix: m.fury_bird_phoenix,
		parrot: m.fury_bird_parrot
	};

	const BIRD_HINTS: Record<BirdKind, () => string> = {
		flamingo: m.fury_bird_flamingo_hint,
		pelican: m.fury_bird_pelican_hint,
		stork: m.fury_bird_stork_hint,
		goose: m.fury_bird_goose_hint,
		falcon: m.fury_bird_falcon_hint,
		phoenix: m.fury_bird_phoenix_hint,
		parrot: m.fury_bird_parrot_hint
	};

	export function birdName(kind: BirdKind): string {
		return BIRD_NAMES[kind]();
	}

	export function birdHint(kind: BirdKind): string {
		return BIRD_HINTS[kind]();
	}
</script>

<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { createFixedLoop, onAppHidden, prefersReducedMotion } from '#lib/game/loop.js';
	import { loadFurySprites, type FurySprites } from '#lib/game/fury/assets.js';
	import { BIRDS } from '#lib/game/fury/birds.js';
	import {
		BIRD_LOOKS,
		drawScene,
		fitCamera,
		screenToWorld,
		type Camera
	} from '#lib/game/fury/furyRender.js';
	import {
		KEY_ANGLE_STEP,
		KEY_POWER_STEP,
		POUCH,
		STEP_SECONDS,
		aimFromPull,
		launchVelocity,
		previewSeconds,
		trajectoryPoints,
		type Vec
	} from '#lib/game/fury/launch.js';
	import type { FuryGame } from '#lib/stores/furyGame.svelte.js';
	import IconSparkles from '~icons/lucide/sparkles';

	let { game, showTutorial = false }: { game: FuryGame; showTutorial?: boolean } = $props();

	let canvas: HTMLCanvasElement | undefined = $state();
	let size = { width: 0, height: 0, dpr: 1 };
	let sprites: FurySprites = {};
	let reducedMotion = false;
	let shake = 0;
	let shakeTime = 0;
	/** Pointer drag: where it started, and whether the pouch is grabbed directly */
	let drag: { pointerId: number; start: Vec; direct: boolean } | null = null;

	/** Pointer grabs within this distance of the pouch move it directly; elsewhere the drag is relative */
	const GRAB_RADIUS = 1.6;

	function camera(): Camera {
		return fitCamera(size.width, size.height, game.level.width);
	}

	function render() {
		const context = canvas?.getContext('2d');
		const match = game.match;
		if (!canvas || !context || !match || size.width === 0) return;
		context.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
		const bird = game.currentBird;
		const aim = game.aim;
		const preview =
			bird && aim
				? trajectoryPoints(
						POUCH,
						launchVelocity(aim, BIRDS[bird].speedFactor),
						previewSeconds(game.settings.longPreview)
					)
				: [];
		const offset =
			shake > 0.2
				? { x: Math.sin(shakeTime * 1.7) * shake, y: Math.cos(shakeTime * 2.3) * shake }
				: undefined;
		drawScene(context, camera(), {
			world: match.world,
			birdOnSling: bird,
			aim,
			preview,
			time: game.steps * STEP_SECONDS,
			reducedMotion,
			sprites,
			shake: offset,
			backdrop: game.backdrop
		});
	}

	function update() {
		game.update();
		if (reducedMotion) return;
		for (const event of game.lastEvents) {
			if (event.type === 'impact') shake = Math.min(7, Math.max(shake, event.strength * 0.25));
			if (event.type === 'dome-destroyed') shake = Math.max(shake, 4);
		}
		shake *= 0.86;
		shakeTime++;
	}

	const loop = createFixedLoop({ update, render });

	$effect(() => {
		const running = game.screen === 'play' && !game.paused && game.match !== null;
		if (running) loop.start();
		else {
			loop.pause();
			// Draw the paused frame without subscribing this effect to per-step state
			untrack(render);
		}
	});

	onMount(() => {
		reducedMotion = prefersReducedMotion();
		loadFurySprites().then((loaded) => (sprites = loaded));
		const observer = new ResizeObserver(() => resize());
		if (canvas) observer.observe(canvas);
		resize();
		const stopHidden = onAppHidden(() => game.setPaused(true));
		window.addEventListener('pointerdown', onOutsidePointerDown);
		return () => {
			window.removeEventListener('pointerdown', onOutsidePointerDown);
			observer.disconnect();
			stopHidden();
			loop.pause();
		};
	});

	function resize() {
		if (!canvas) return;
		const rect = canvas.getBoundingClientRect();
		const dpr = Math.min(3, window.devicePixelRatio || 1);
		size = { width: rect.width, height: rect.height, dpr };
		canvas.width = Math.max(1, Math.round(rect.width * dpr));
		canvas.height = Math.max(1, Math.round(rect.height * dpr));
		render();
	}

	function worldPoint(event: PointerEvent): Vec {
		const rect = canvas!.getBoundingClientRect();
		return screenToWorld(camera(), { x: event.clientX - rect.left, y: event.clientY - rect.top });
	}

	function onPointerDown(event: PointerEvent) {
		if (game.paused || !canvas) return;
		if (game.phase === 'flying') {
			game.useAbility();
			return;
		}
		if (game.phase !== 'aiming' || !game.currentBird) return;
		const point = worldPoint(event);
		const direct = Math.hypot(point.x - POUCH.x, point.y - POUCH.y) <= GRAB_RADIUS;
		drag = { pointerId: event.pointerId, start: point, direct };
		canvas.setPointerCapture(event.pointerId);
		canvas.focus({ preventScroll: true });
		onPointerMove(event);
	}

	// On desktop the slingshot is often pulled with the mouse beyond the canvas, so the next click
	// (the bird's ability) lands outside it too. Mouse only: a touch outside the canvas is a scroll.
	function onOutsidePointerDown(event: PointerEvent) {
		if (event.pointerType !== 'mouse' || event.button !== 0) return;
		if (game.paused || game.phase !== 'flying') return;
		const target = event.target;
		if (!(target instanceof Element) || target === canvas) return;
		if (target.closest('button, a, input, select, textarea, label, dialog, [role="button"]')) return;
		game.useAbility();
	}

	function onPointerMove(event: PointerEvent) {
		if (!drag || drag.pointerId !== event.pointerId) return;
		const point = worldPoint(event);
		const origin = drag.direct ? POUCH : drag.start;
		game.setAim(aimFromPull({ x: point.x - origin.x, y: point.y - origin.y }));
	}

	function onPointerUp(event: PointerEvent) {
		if (!drag || drag.pointerId !== event.pointerId) return;
		drag = null;
		game.release();
	}

	function onPointerCancel() {
		drag = null;
		game.setAim(null);
	}

	function onKeyDown(event: KeyboardEvent) {
		const keys: Record<string, [number, number]> = {
			ArrowUp: [KEY_ANGLE_STEP, 0],
			ArrowDown: [-KEY_ANGLE_STEP, 0],
			ArrowRight: [0, KEY_POWER_STEP],
			ArrowLeft: [0, -KEY_POWER_STEP]
		};
		const step = keys[event.key];
		if (step) {
			event.preventDefault();
			const fast = event.shiftKey ? 5 : 1;
			game.nudgeAim(step[0] * fast, step[1] * fast);
		} else if (event.key === ' ' || event.key === 'Enter') {
			event.preventDefault();
			if (!event.repeat) game.primaryAction();
		} else if (event.key === 'Escape' && game.aim) {
			event.preventDefault();
			game.setAim(null);
		}
	}

	const aimText = $derived(
		game.aim
			? m.fury_aim_status({
					angle: Math.round((game.aim.angle * 180) / Math.PI),
					power: Math.round(game.aim.power * 100)
				})
			: ''
	);

	const announcementText = $derived.by(() => {
		const note = game.announcement;
		if (!note) return '';
		return note.kind === 'ready'
			? m.fury_status_ready({ bird: birdName(note.bird) })
			: m.fury_status_dome({ count: note.remaining });
	});
</script>

<div class="flex flex-col gap-3">
	<div
		data-playfield
		class="relative overflow-hidden rounded-[14px_8px_16px_10px] border-3 border-ink shadow-[4px_4px_0_var(--color-ink)]"
	>
		<canvas
			bind:this={canvas}
			class="block aspect-[10/7] w-full touch-none bg-sky select-none focus-visible:outline-3 focus-visible:outline-offset-[-6px] focus-visible:outline-tie-red focus-visible:outline-dashed"
			style:max-height="min(68dvh, calc(100dvh - 15rem))"
			tabindex="0"
			aria-label={m.fury_canvas_label()}
			onpointerdown={onPointerDown}
			onpointermove={onPointerMove}
			onpointerup={onPointerUp}
			onpointercancel={onPointerCancel}
			onkeydown={onKeyDown}
		></canvas>
		{#if aimText}
			<p
				class="pointer-events-none absolute top-2 left-2 rounded-md border-2 border-ink bg-paper px-2 py-0.5 text-sm font-bold tabular-nums"
			>
				{aimText}
			</p>
		{/if}
	</div>

	<div class="flex flex-wrap items-center justify-between gap-3">
		<div class="flex flex-col gap-1">
			<span class="text-xs font-bold uppercase">{m.fury_squad_label()}</span>
			<ol
				class="flex flex-wrap items-center gap-1.5"
				aria-label={m.fury_birds_left({ count: game.squad.length })}
			>
				{#each game.squad as bird, index (index)}
					<li
						class="flex items-center gap-1 rounded-md border-2 border-ink px-1.5 py-0.5 text-sm font-bold {index ===
							0 && game.phase === 'aiming'
							? 'rotate-[-3deg] bg-explosion-yellow'
							: 'bg-paper'}"
					>
						<span
							class="inline-block size-3 rounded-full border-2 border-ink"
							style:background={BIRD_LOOKS[bird].body}
							aria-hidden="true"
						></span>
						{birdName(bird)}
					</li>
				{:else}
					<li class="text-sm">{m.fury_birds_left({ count: 0 })}</li>
				{/each}
			</ol>
		</div>

		<p class="rounded-md border-2 border-ink bg-paper px-2 py-1 font-display font-bold">
			{m.fury_domes_left({ count: game.domesRemaining })}
		</p>

		{#if game.canUseAbility}
			<button
				type="button"
				class="pop-in btn-chunky min-h-12 bg-explosion-yellow"
				onclick={() => game.useAbility()}
			>
				<IconSparkles class="size-5" aria-hidden="true" />
				{m.fury_ability_button()}
			</button>
		{/if}
	</div>

	{#if game.currentBird}
		<p class="font-semibold">{birdName(game.currentBird)}: {birdHint(game.currentBird)}</p>
	{/if}
	{#if showTutorial}
		<p class="text-sm">{m.fury_controls_hint()}</p>
		<p class="text-sm">{m.fury_keyboard_hint()}</p>
	{/if}
	<p class="sr-only" role="status" aria-live="polite">{announcementText}</p>
</div>
