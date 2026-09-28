<!--
	One Pipeline Panic pipe tile drawn as inline SVG: generic placeholder pipes with thick ink
	outlines, a dark oil core while oil flows, and a crack, a leak and an oversized wrench badge
	while the tile is broken. The pipe shape turns with a springy quarter turn.
-->
<script lang="ts">
	import { untrack } from 'svelte';
	import { openings, type Direction, type Rotation, type TileKind } from '$lib/game/pipeline/tiles';
	import PipelineWrench from './PipelineWrench.svelte';

	let {
		kind,
		rotation,
		filled,
		broken,
		repair,
		repairing,
		reducedMotion
	}: {
		kind: TileKind;
		rotation: Rotation;
		filled: boolean;
		broken: boolean;
		repair: number;
		repairing: boolean;
		reducedMotion: boolean;
	} = $props();

	// Count whole turns so a turn from 270 to 0 degrees keeps spinning forward
	let turns = $state(untrack(() => rotation));
	let last = untrack(() => rotation);
	$effect.pre(() => {
		const next = rotation;
		turns += (next - last + 4) % 4;
		last = next;
	});

	const ENDS: Record<Direction, [number, number]> = {
		0: [50, 0],
		1: [100, 50],
		2: [50, 100],
		3: [0, 50]
	};
	const arms = $derived(openings(kind, 0).map((direction) => ENDS[direction]));
	const ringLength = 2 * Math.PI * 42;
</script>

<svg viewBox="0 0 100 100" class="pointer-events-none size-full" aria-hidden="true">
	<g
		class="pipe"
		class:animated={!reducedMotion}
		style:transform="rotate({turns * 90}deg)"
		style:transform-origin="50px 50px"
	>
		{#each arms as [x, y], index (index)}
			<line x1="50" y1="50" x2={x} y2={y} stroke="#111111" stroke-width="36" />
		{/each}
		<circle cx="50" cy="50" r="18" fill="#111111" />
		{#each arms as [x, y], index (index)}
			<line
				x1="50"
				y1="50"
				x2={x}
				y2={y}
				stroke={filled ? '#2b2f36' : '#ffffff'}
				stroke-width="24"
			/>
		{/each}
		<circle cx="50" cy="50" r="12" fill={filled ? '#2b2f36' : '#ffffff'} />
		{#if filled && !broken}
			{#each arms as [x, y], index (index)}
				<line
					x1="50"
					y1="50"
					x2={x}
					y2={y}
					class="flow"
					class:moving={!reducedMotion}
					stroke="#ddb93c"
					stroke-width="6"
					stroke-dasharray="6 12"
				/>
			{/each}
		{/if}
	</g>

	{#if broken}
		<!-- Leak puddle and drips, then the crack across the pipe -->
		<ellipse cx="66" cy="84" rx="22" ry="9" fill="#2b2f36" stroke="#111111" stroke-width="4" />
		<path d="M58 62 q4 8 0 12 q-4 -4 0 -12 Z" fill="#2b2f36" stroke="#111111" stroke-width="3" />
		<path
			d="M22 30 L38 44 L30 52 L50 60 L44 70 L64 78"
			fill="none"
			stroke="#e5484d"
			stroke-width="7"
			stroke-linejoin="round"
		/>
		<path
			d="M22 30 L38 44 L30 52 L50 60 L44 70 L64 78"
			fill="none"
			stroke="#111111"
			stroke-width="3"
			stroke-linejoin="round"
		/>
		<g class:wiggle={repairing && !reducedMotion} style:transform-origin="78px 22px">
			<PipelineWrench x={58} y={2} size={40} />
		</g>
		{#if repair > 0}
			<circle
				cx="50"
				cy="50"
				r="42"
				fill="none"
				stroke="#111111"
				stroke-width="10"
				stroke-dasharray="{ringLength * repair} {ringLength}"
				transform="rotate(-90 50 50)"
			/>
			<circle
				cx="50"
				cy="50"
				r="42"
				fill="none"
				stroke="#f5c83a"
				stroke-width="5"
				stroke-dasharray="{ringLength * repair} {ringLength}"
				transform="rotate(-90 50 50)"
			/>
		{/if}
	{/if}
</svg>

<style>
	.pipe.animated {
		transition: transform 220ms var(--ease-spring);
	}

	.flow.moving {
		animation: flow 700ms linear infinite;
	}

	@keyframes flow {
		to {
			stroke-dashoffset: -18;
		}
	}

	.wiggle {
		animation: wiggle 300ms ease-in-out infinite alternate;
	}

	@keyframes wiggle {
		from {
			rotate: -12deg;
		}
		to {
			rotate: 12deg;
		}
	}
</style>
