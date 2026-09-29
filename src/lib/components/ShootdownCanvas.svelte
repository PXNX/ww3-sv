<!--
	Shahed Shootdown playfield: a crisp high-DPI canvas driven by the fixed-step loop, plus the
	touch controls (drag on the ground band to steer, tap the sky to fire) and keyboard controls
	(arrow keys or A and D, Space, P). The playfield never mirrors in right-to-left languages.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { m } from '$lib/paraglide/messages';
	import { createFixedLoop, onAppHidden } from '$lib/game/loop';
	import { LAUNCHER_TOP, WORLD_HEIGHT, WORLD_WIDTH } from '$lib/game/shootdown/shootdownStep';
	import { drawScene, loadSceneSprites } from '$lib/game/shootdown/render';
	import type { ShootdownGame } from '$lib/stores/shootdownGame.svelte';
	import IconPlay from '~icons/lucide/play';

	let { game, showTutorial = false }: { game: ShootdownGame; showTutorial?: boolean } = $props();

	let canvas: HTMLCanvasElement | undefined = $state();
	let context: CanvasRenderingContext2D | null = null;
	/** CSS pixels per world unit */
	let scale = 1;
	let dragPointer: number | null = null;

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
		void loadSceneSprites().then(draw);
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
			x: ((event.clientX - rect.left) / rect.width) * WORLD_WIDTH,
			y: ((event.clientY - rect.top) / rect.height) * WORLD_HEIGHT
		};
	}

	function onCanvasDown(event: PointerEvent) {
		if (game.status !== 'playing') return;
		const point = worldPoint(event);
		if (point.y >= LAUNCHER_TOP - 20) {
			// The ground band (and the launcher on it) is the drag area
			dragPointer = event.pointerId;
			canvas!.setPointerCapture(event.pointerId);
			game.dragTo(point.x);
		} else {
			game.pressFire();
		}
	}

	function onCanvasMove(event: PointerEvent) {
		if (event.pointerId === dragPointer) game.dragTo(worldPoint(event).x);
	}

	function onCanvasUp(event: PointerEvent) {
		if (event.pointerId !== dragPointer) return;
		dragPointer = null;
		game.dragTo(null);
	}

	const isInteractive = (target: EventTarget | null) =>
		target instanceof HTMLElement &&
		target.closest('button, a, input, select, textarea, [contenteditable]') !== null;

	function onKey(event: KeyboardEvent, pressed: boolean) {
		if (game.status === 'over' || event.ctrlKey || event.metaKey || event.altKey) return;
		// Physical keys, so the controls work with any keyboard layout
		switch (event.code) {
			case 'ArrowLeft':
			case 'KeyA':
				game.steer(-1, pressed);
				break;
			case 'ArrowRight':
			case 'KeyD':
				game.steer(1, pressed);
				break;
			case 'Space':
				// A focused button handles Space itself
				if (isInteractive(event.target) || game.status !== 'playing') return;
				game.holdFire(pressed);
				break;
			case 'KeyP':
			case 'Escape':
				if (pressed && !event.repeat) {
					if (event.code === 'Escape') game.pause();
					else game.togglePause();
				}
				break;
			default:
				return;
		}
		if (game.status === 'playing') event.preventDefault();
	}
</script>

<svelte:window onkeydown={(event) => onKey(event, true)} onkeyup={(event) => onKey(event, false)} />

<div
	data-playfield
	class="flex w-full flex-col gap-3 select-none"
	style:max-width="max(17rem, min(100%, calc((100dvh - 17rem) * 0.6)))"
>
	<div class="relative">
		<canvas
			bind:this={canvas}
			class="block aspect-[3/5] w-full touch-none rounded-[14px_8px_16px_10px] border-3 border-ink shadow-[4px_4px_0_var(--color-ink)]"
			aria-label={m.shootdown_playfield_label()}
			onpointerdown={onCanvasDown}
			onpointermove={onCanvasMove}
			onpointerup={onCanvasUp}
			onpointercancel={onCanvasUp}
			oncontextmenu={(event) => event.preventDefault()}
		></canvas>

		<!-- Wave and hit announcements, also read out by screen readers -->
		<div
			class="pointer-events-none absolute inset-x-0 top-[38%] flex justify-center px-4"
			aria-live="polite"
		>
			{#if game.banner && game.status === 'playing'}
				{#key game.banner}
					<p
						class="pop-in rounded-[10px_6px_12px_8px] border-3 border-ink px-3 py-1 text-center font-display text-xl font-bold shadow-[3px_3px_0_var(--color-ink)] {game
							.banner.kind === 'hit'
							? 'bg-tie-red'
							: 'bg-paper'}"
						style:rotate="-2deg"
					>
						{#if game.banner.kind === 'incoming'}
							{game.banner.boss
								? m.shootdown_boss_incoming({ wave: game.banner.wave })
								: m.shootdown_wave_incoming({ wave: game.banner.wave })}
						{:else if game.banner.kind === 'cleared'}
							{m.shootdown_wave_cleared({ bonus: game.banner.bonus })}
						{:else}
							{m.shootdown_launcher_hit()}
						{/if}
					</p>
				{/key}
			{/if}
		</div>

		{#if game.status === 'ready' || game.status === 'paused'}
			<div
				class="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-[14px_8px_16px_10px] bg-ink/35 p-5"
			>
				<div
					class="sticker pop-in flex max-w-xs flex-col items-center gap-3 p-4 text-center"
					style:--tilt="-1.5deg"
				>
					{#if game.status === 'ready'}
						{#if showTutorial}
							<p class="leading-snug font-semibold">{m.shootdown_how_to()}</p>
							<p class="hidden text-sm sm:block">{m.shootdown_keyboard_hint()}</p>
						{/if}
						<button
							type="button"
							class="btn-chunky bg-tie-red text-xl"
							onclick={() => game.start()}
						>
							<IconPlay class="size-5" aria-hidden="true" />
							{m.shootdown_start()}
						</button>
					{:else}
						<p class="font-display text-2xl font-bold">{m.game_paused()}</p>
						<button
							type="button"
							class="btn-chunky bg-explosion-yellow text-xl"
							onclick={() => game.resume()}
						>
							<IconPlay class="size-5" aria-hidden="true" />
							{m.game_resume()}
						</button>
					{/if}
				</div>
			</div>
		{/if}
	</div>
</div>
