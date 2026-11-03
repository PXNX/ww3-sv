<!-- A small drawn picture of a troop, a mine or gun, or a home building at a level, for the upgrade tiles and windows -->
<script lang="ts">
	import { drawBuildingPreview, previewSize } from '#lib/game/beachhead/baseArt.js';
	import type { LayoutKey } from '#lib/game/beachhead/baseLayout.js';
	import type { BuildingKind, TroopKind } from '#lib/game/beachhead/config.js';
	import { drawDefensePortrait, drawTroopPortrait } from '#lib/game/beachhead/render.js';

	let {
		type,
		kind,
		level = 1,
		max = 1,
		size = 64,
		animated = false,
		class: className = ''
	}: {
		type: 'troop' | 'defense' | 'building';
		kind: TroopKind | BuildingKind | LayoutKey;
		level?: number;
		max?: number;
		size?: number;
		/** Troops act out their attack and ability in a loop, like the weapon detail of a shooter */
		animated?: boolean;
		class?: string;
	} = $props();
	let canvas: HTMLCanvasElement | undefined = $state();

	let clock = $state(0);
	$effect(() => {
		if (!animated || type !== 'troop') return;
		let frame = 0;
		const tick = (now: number) => {
			clock = now;
			frame = requestAnimationFrame(tick);
		};
		frame = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(frame);
	});

	$effect(() => {
		if (!canvas) return;
		const time = animated ? clock : 0;
		const ratio = Math.min(2, window.devicePixelRatio || 1);
		const width = size;
		let height = size;
		if (type === 'building') {
			const box = previewSize(kind as LayoutKey);
			height = Math.round((size * box.height) / box.width);
		}
		canvas.width = Math.round(width * ratio);
		canvas.height = Math.round(height * ratio);
		canvas.style.width = `${width}px`;
		canvas.style.height = `${height}px`;
		const context = canvas.getContext('2d');
		if (!context) return;
		context.setTransform(ratio, 0, 0, ratio, 0, 0);
		context.clearRect(0, 0, width, height);
		if (type === 'troop') drawTroopPortrait(context, kind as TroopKind, level, size, time);
		else if (type === 'defense') drawDefensePortrait(context, kind as BuildingKind, size);
		else drawBuildingPreview(context, kind as LayoutKey, level, max, size);
	});
</script>

<canvas bind:this={canvas} class={className} aria-hidden="true"></canvas>
