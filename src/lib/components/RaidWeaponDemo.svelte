<!--
	A small looping example of a weapon's base attack or one of its skills, drawn by the raid's own
	renderer on a staged mini raid. It only runs while on screen; with reduced motion it plays once
	and waits for the replay button.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import type { WeaponKind } from '#lib/game/raid/config.js';
	import {
		createDemo,
		DEMO_CENTER_OFFSET,
		DEMO_MS,
		stepDemo,
		type Demo,
		type DemoAction
	} from '#lib/game/raid/demo.js';
	import { avatar } from '#lib/game/avatar/store.svelte.js';
	import { drawRaid, raiderLook } from '#lib/game/raid/render.js';
	import IconRotate from '~icons/lucide/rotate-ccw';

	let {
		kind,
		action,
		label,
		reducedMotion = false
	}: { kind: WeaponKind; action: DemoAction; label: string; reducedMotion?: boolean } = $props();

	const STEP = 1000 / 60;

	const avatarState = avatar();
	const look = $derived(raiderLook(avatarState.shown));
	let canvas: HTMLCanvasElement | undefined = $state();
	let demo: Demo | null = null;
	let elapsed = 0;
	let frame = 0;
	let last = 0;
	let visible = false;
	let finished = $state(false);

	let start = { x: 0, y: 0 };

	function restart() {
		demo = createDemo(kind, action);
		start = { x: demo.state.player.x, y: demo.state.player.y };
		elapsed = 0;
		finished = false;
	}

	function draw() {
		if (!canvas || !demo) return;
		const context = canvas.getContext('2d');
		if (!context) return;
		const ratio = window.devicePixelRatio || 1;
		const width = canvas.clientWidth;
		const height = canvas.clientHeight;
		if (canvas.width !== Math.round(width * ratio)) canvas.width = Math.round(width * ratio);
		if (canvas.height !== Math.round(height * ratio)) canvas.height = Math.round(height * ratio);
		context.setTransform(ratio, 0, 0, ratio, 0, 0);
		drawRaid(context, demo.state, width, height, {
			effects: demo.effects,
			reducedMotion: false,
			zoom: 1.5,
			look,
			// Where the player stood at the start, so a dash moves the player and not the view
			center: { x: start.x + DEMO_CENTER_OFFSET, y: start.y }
		});
	}

	function tick(now: number) {
		frame = requestAnimationFrame(tick);
		if (!visible || !demo) {
			last = now;
			return;
		}
		// Fixed steps, at most a few per frame so a background tab does not fast-forward
		let budget = Math.min(100, now - (last || now));
		last = now;
		while (budget >= STEP && !finished) {
			budget -= STEP;
			elapsed += STEP;
			stepDemo(demo, STEP, elapsed);
			if (elapsed >= DEMO_MS) {
				if (reducedMotion) finished = true;
				else restart();
			}
		}
		draw();
	}

	onMount(() => {
		restart();
		const observer = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting));
		if (canvas) observer.observe(canvas);
		frame = requestAnimationFrame(tick);
		return () => {
			cancelAnimationFrame(frame);
			observer.disconnect();
		};
	});
</script>

<div class="relative">
	<canvas
		bind:this={canvas}
		class="block aspect-video w-full rounded-lg border-3 border-ink bg-sand"
		aria-label={label}
	></canvas>
	{#if finished}
		<button
			type="button"
			class="btn-chunky absolute right-2 bottom-2 px-2 py-1 text-xs"
			onclick={restart}
		>
			<IconRotate class="size-3.5" aria-hidden="true" />
			{m.raid_details_replay()}
		</button>
	{/if}
</div>
