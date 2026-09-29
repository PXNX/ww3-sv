<!--
	Flamingo Flight playing field: a crisp high-DPI canvas driven by the fixed-timestep loop, with
	tap, Space and Up arrow input and small overlays for the start hint, progress and pause.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';
	import { createFixedLoop, prefersReducedMotion, type FixedLoop } from '$lib/game/loop';
	import { suppliedFlamingoAssets } from '$lib/game/flamingo/assets';
	import { WORLD_WIDTH } from '$lib/game/flamingo/physics';
	import {
		FlamingoEffects,
		drawScene,
		type RenderAssets,
		type RenderLabels
	} from '$lib/game/flamingo/render';
	import { explosionFrames, loadImage } from '$lib/theme/sprites';
	import type { FlamingoGame } from '$lib/stores/flamingoGame.svelte';
	import IconPlay from '~icons/lucide/play';

	let { game, showTutorial = false }: { game: FlamingoGame; showTutorial?: boolean } = $props();

	let canvas: HTMLCanvasElement | undefined = $state();
	let context: CanvasRenderingContext2D | null = null;
	let loop: FixedLoop | undefined;
	let reducedMotion = false;
	let effects = new FlamingoEffects(false);
	const assets: RenderAssets = { explosion: [], supplied: {} };

	const labels: RenderLabels = {
		refineryNames: [
			m.flamingo_refinery_0(),
			m.flamingo_refinery_1(),
			m.flamingo_refinery_2(),
			m.flamingo_refinery_3(),
			m.flamingo_refinery_4(),
			m.flamingo_refinery_5()
		],
		biggest: m.flamingo_biggest_label(),
		strikeBiggest: m.flamingo_strike_biggest(),
		strikeTanks: (count) => m.flamingo_strike_tanks({ count }),
		slogan: m.flamingo_strike_slogan(),
		direction: getLocale() === 'fa' ? 'rtl' : 'ltr'
	};

	function render() {
		if (!canvas || !context) return;
		const scale = canvas.width / WORLD_WIDTH;
		context.setTransform(scale, 0, 0, scale, 0, 0);
		drawScene(context, game.sim, effects, assets, labels);
	}

	function update(stepMs: number) {
		const dt = stepMs / 1000;
		if (!game.update(dt)) return;
		effects.handle(game.sim.events, game.sim, labels);
		effects.update(dt, game.sim);
	}

	function resize() {
		if (!canvas) return;
		const rect = canvas.getBoundingClientRect();
		const ratio = window.devicePixelRatio || 1;
		canvas.width = Math.max(1, Math.round(rect.width * ratio));
		canvas.height = Math.max(1, Math.round(rect.height * ratio));
		render();
	}

	onMount(() => {
		if (!canvas) return;
		context = canvas.getContext('2d');
		reducedMotion = prefersReducedMotion();
		effects = new FlamingoEffects(reducedMotion, game.sim.seed);
		loop = createFixedLoop({ update, render });

		Promise.all(explosionFrames().map(loadImage)).then((frames) => {
			assets.explosion = frames.filter((frame): frame is HTMLImageElement => frame !== null);
		});
		for (const [id, src] of suppliedFlamingoAssets()) {
			loadImage(src).then((image) => {
				if (image) assets.supplied[id] = image;
			});
		}

		const observer = new ResizeObserver(resize);
		observer.observe(canvas);
		resize();
		return () => {
			observer.disconnect();
			loop?.pause();
		};
	});

	// A new round starts with fresh effects
	$effect(() => {
		void game.round;
		effects = new FlamingoEffects(reducedMotion, game.sim.seed);
		render();
	});

	// The loop only runs while there is something to animate
	$effect(() => {
		const active = game.status === 'ready' || game.status === 'playing';
		if (!loop) return;
		if (active) loop.start();
		else {
			loop.pause();
			render();
		}
	});

	function onPointerDown(event: PointerEvent) {
		if (game.status !== 'ready' && game.status !== 'playing') return;
		if (event.button !== 0) return;
		event.preventDefault();
		game.flap();
	}

	function onKeyDown(event: KeyboardEvent) {
		if (event.code !== 'Space' && event.key !== 'ArrowUp') return;
		const target = event.target as HTMLElement | null;
		if (target?.closest('button, a, input, select, textarea, dialog')) return;
		if (game.status !== 'ready' && game.status !== 'playing') return;
		event.preventDefault();
		if (!event.repeat) game.flap();
	}
</script>

<svelte:window onkeydown={onKeyDown} />

<div
	data-playfield
	class="relative mx-auto aspect-[9/16] w-full max-w-[calc((100dvh-10rem)*9/16)] min-w-64 touch-none overflow-hidden rounded-[16px_8px_14px_10px] border-3 border-ink bg-sky shadow-[4px_4px_0_var(--color-ink)] select-none"
	role="application"
	aria-label={m.flamingo_playfield_label()}
	onpointerdown={onPointerDown}
>
	<canvas bind:this={canvas} class="block size-full" aria-hidden="true"></canvas>

	{#if game.status === 'playing' || game.status === 'paused'}
		<div class="pointer-events-none absolute inset-x-0 top-2 flex justify-center px-2">
			{#if game.stage === 'approach'}
				<p
					dir="auto"
					class="pop-in rounded-md border-3 border-ink bg-explosion-yellow px-2 py-0.5 text-sm font-bold"
					aria-live="polite"
				>
					{m.flamingo_approach()}
				</p>
			{:else}
				<p dir="auto" class="rounded-md border-2 border-ink bg-paper px-2 py-0.5 text-sm font-bold">
					{m.flamingo_gaps_left({ count: game.gapsLeft })}
				</p>
			{/if}
		</div>
	{/if}

	{#if game.status === 'ready'}
		<div
			class="pointer-events-none absolute inset-x-3 bottom-24 flex flex-col items-center gap-2 text-center"
		>
			<p
				dir="auto"
				class="pop-in sticker px-4 py-1 font-display text-2xl font-bold"
				style:--tilt="-2deg"
			>
				{m.flamingo_tap_to_start()}
			</p>
			{#if showTutorial}
				<p
					dir="auto"
					class="rounded-md border-2 border-ink bg-paper px-2 py-1 text-sm leading-snug"
				>
					{m.flamingo_controls_hint()}
				</p>
			{/if}
		</div>
	{/if}

	{#if game.status === 'paused'}
		<div class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink/40">
			<p dir="auto" class="sticker px-4 py-1 font-display text-3xl font-bold" style:--tilt="1.5deg">
				{m.game_paused()}
			</p>
			<button
				type="button"
				class="btn-chunky bg-explosion-yellow text-lg"
				onclick={() => game.resume()}
			>
				<IconPlay class="size-5" aria-hidden="true" />
				{m.game_resume()}
			</button>
		</div>
	{/if}
</div>
