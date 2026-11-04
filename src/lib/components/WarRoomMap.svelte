<!--
	The campaign map: ten regions joined by roads, each showing who holds it, which stack is there
	and how well supplied it is. Tapping a stack selects it; tapping a neighbour then gives the
	order. The connection layer is plain SVG, the regions are buttons on top of it.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { REGIONS, REGION_IDS, type RegionId } from '#lib/game/warroom/config.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { WarRoomGame } from '#lib/stores/warroomGame.svelte.js';
	import NatoSymbol from './NatoSymbol.svelte';
	import { regionName } from './warroomText.js';
	import IconCrosshair from '~icons/lucide/crosshair';
	import IconPlay from '~icons/lucide/play';
	import IconShield from '~icons/lucide/shield';

	let { game }: { game: WarRoomGame } = $props();

	// One line per pair of neighbours, drawn under the region buttons
	const edges = REGIONS.flatMap((region) =>
		region.neighbors
			.filter((neighbor) => REGION_IDS.indexOf(neighbor) > REGION_IDS.indexOf(region.id))
			.map((neighbor) => ({ from: region.id, to: neighbor }))
	);
	const point = (id: RegionId) => {
		const def = REGIONS.find((region) => region.id === id)!;
		return { x: def.x, y: def.y * 0.6 };
	};
	const edgeInk = (from: RegionId, to: RegionId): string => {
		const a = game.owner[from];
		const b = game.owner[to];
		if (a !== b) return '#6a7c9b';
		return a === 'player' ? '#2f5d8a' : '#a34a3a';
	};
	const supplyTone = (value: number): string =>
		value >= 70 ? 'bg-[#8fd19e]' : value >= 45 ? 'bg-[#e8c46a]' : 'bg-tie-red';

	let frame: HTMLDivElement | undefined = $state();
	let canvas: HTMLCanvasElement | undefined = $state();

	const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	// Screen shake: a quick decaying jolt on the whole map, scaled by how bad the news is
	let lastShake = 0;
	$effect(() => {
		const { key, power } = game.shake;
		if (key === lastShake) return;
		lastShake = key;
		if (!frame || reduced()) return;
		const amp = 2 + power * 7;
		frame.animate(
			[
				{ transform: 'translate(0,0)' },
				{ transform: `translate(${-amp}px, ${amp * 0.5}px)` },
				{ transform: `translate(${amp * 0.8}px, ${-amp * 0.4}px)` },
				{ transform: `translate(${-amp * 0.5}px, ${amp * 0.3}px)` },
				{ transform: 'translate(0,0)' }
			],
			{ duration: 320 + power * 200, easing: 'ease-out' }
		);
	});

	// Particles: the store owns them, this loop steps and paints them while any are alive
	onMount(() => {
		let raf = 0;
		let last = performance.now();
		const paint = (now: number) => {
			raf = requestAnimationFrame(paint);
			const dt = Math.min(0.05, (now - last) / 1000);
			last = now;
			const context = canvas?.getContext('2d');
			if (!canvas || !context) return;
			if (reduced()) {
				if (game.particles.length > 0) game.stepFx(10);
				return;
			}
			const alive = game.particles.length > 0;
			if (!alive && !canvas.dataset.dirty) return;
			game.stepFx(dt);
			context.clearRect(0, 0, canvas.width, canvas.height);
			const scale = canvas.width / 100;
			for (const particle of game.particles) {
				context.globalAlpha = Math.max(0, particle.life / particle.span);
				context.fillStyle = particle.color;
				context.fillRect(
					particle.x * scale,
					particle.y * scale,
					particle.size * scale * 0.6,
					particle.size * scale * 0.6
				);
			}
			context.globalAlpha = 1;
			canvas.dataset.dirty = game.particles.length > 0 ? '1' : '';
		};
		raf = requestAnimationFrame(paint);
		return () => cancelAnimationFrame(raf);
	});

	const isFront = (from: RegionId, to: RegionId) => game.owner[from] !== game.owner[to];
	const pulseTone: Record<string, string> = {
		capture: '#4fa8d8',
		lost: '#e5484d',
		repelled: '#ffb347',
		held: '#4fa8d8',
		crisis: '#ffd23f'
	};

	const selected = $derived(game.selected);
	const focused = $derived(game.focused);
</script>

<div class="flex w-full flex-col gap-1">
	<div
		dir="ltr"
		bind:this={frame}
		class="relative aspect-[5/3] w-full overflow-hidden rounded-2xl border-3 border-ink bg-[#e2e8cf] shadow-[3px_3px_0_var(--color-ink)]"
		role="group"
		aria-label={m.warroom_aria_map()}
	>
		<svg
			class="pointer-events-none absolute inset-0 size-full"
			viewBox="0 0 100 60"
			preserveAspectRatio="none"
			aria-hidden="true"
		>
			{#each edges as edge (edge.from + edge.to)}
				<line
					x1={point(edge.from).x}
					y1={point(edge.from).y}
					x2={point(edge.to).x}
					y2={point(edge.to).y}
					stroke={edgeInk(edge.from, edge.to)}
					stroke-width="0.9"
					stroke-dasharray="2 1.4"
					stroke-linecap="round"
					class={isFront(edge.from, edge.to) ? 'front-line' : ''}
				/>
			{/each}
		</svg>

		<canvas
			bind:this={canvas}
			width="500"
			height="300"
			class="pointer-events-none absolute inset-0 z-10 size-full"
			aria-hidden="true"
		></canvas>

		{#each game.pulses as pulse (pulse.id)}
			{@const at = REGIONS.find((region) => region.id === pulse.region)}
			{#if at}
				<span
					class="map-pulse pointer-events-none absolute z-10 size-10 -translate-x-1/2 -translate-y-1/2 rounded-full border-4"
					style:left="{at.x}%"
					style:top="{at.y}%"
					style:border-color={pulseTone[pulse.kind]}
					aria-hidden="true"
				></span>
			{/if}
		{/each}

		{#each REGIONS as region (region.id)}
			{@const ours = game.owner[region.id] === 'player'}
			{@const stack = game.divisions[region.id] ?? []}
			{@const supply = game.supplyAt(region.id)}
			<button
				type="button"
				class="absolute flex w-[21%] -translate-x-1/2 -translate-y-1/2 flex-col items-stretch gap-0.5 rounded-[7px_4px_8px_5px] border-2 border-ink px-0.5 py-0.5 text-ink shadow-[2px_2px_0_var(--color-ink)] transition-transform {ours
					? 'bg-[#cfe9f7]'
					: 'bg-[#f7cfd1]'} {selected === region.id
					? 'selected-region z-10 scale-105 border-[3px] ring-2 ring-explosion-yellow'
					: ''} {focused === region.id ? 'border-[3px]' : ''}"
				style:left="{region.x}%"
				style:top="{region.y}%"
				aria-pressed={selected === region.id}
				aria-label={m.warroom_aria_region({
					region: regionName(region.id),
					side: ours ? m.warroom_side_player() : m.warroom_side_enemy(),
					count: stack.length
				})}
				onclick={() => game.clickRegion(region.id)}
			>
				<span
					dir="auto"
					class="truncate font-display text-[0.6rem] leading-none font-bold sm:text-xs"
				>
					{regionName(region.id)}
				</span>
				<span class="flex items-center justify-center gap-0.5">
					{#if stack.length > 0}
						<NatoSymbol
							kind={stack[0].template}
							side={ours ? 'player' : 'enemy'}
							class="h-2.5 w-4 sm:h-3.5 sm:w-5"
						/>
						<span class="font-display text-[0.6rem] leading-none font-bold tabular-nums sm:text-xs">
							{stack.length}
						</span>
					{:else}
						<span class="size-1.5 rounded-full border border-ink/40 bg-paper/70"></span>
					{/if}
				</span>
				<span
					class="h-1 overflow-hidden rounded-full border border-ink/60 bg-paper"
					aria-hidden="true"
				>
					<span class="block h-full {supplyTone(supply)}" style:width="{supply}%"></span>
				</span>
			</button>
		{/each}

		{#if game.status === 'ready'}
			<div class="absolute inset-0 z-20 flex items-center justify-center bg-ink/35 p-3">
				<div
					class="sticker pop-in flex w-full max-w-sm flex-col items-center gap-2 p-3 text-center"
					style:--tilt="-1.5deg"
				>
					<h2 dir="auto" class="font-display text-xl leading-tight font-bold">
						{m.mode_warroom_name()}
					</h2>
					<p dir="auto" class="text-xs leading-snug font-semibold sm:text-sm">
						{m.warroom_ready_hint()}
					</p>
					{#if game.best !== null}
						<p class="text-xs font-semibold tabular-nums">{m.warroom_best({ score: game.best })}</p>
					{/if}
					<button type="button" class="btn-chunky bg-tie-red text-lg" onclick={() => game.start()}>
						<IconPlay class="size-4" aria-hidden="true" />
						{m.warroom_start()}
					</button>
				</div>
			</div>
		{/if}
	</div>

	<div
		class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 font-display text-[0.65rem] font-bold sm:text-xs"
	>
		<span class="inline-flex items-center gap-1">
			<span class="size-2.5 rounded-sm border border-ink bg-[#cfe9f7]" aria-hidden="true"></span>
			{m.warroom_side_player()}
			<IconShield class="size-3" aria-hidden="true" />
		</span>
		<span class="inline-flex items-center gap-1">
			<span class="size-2.5 rotate-45 border border-ink bg-[#f7cfd1]" aria-hidden="true"></span>
			{m.warroom_side_enemy()}
			<IconCrosshair class="size-3" aria-hidden="true" />
		</span>
		<span dir="auto" class="font-semibold opacity-80">{m.warroom_legend_supply()}</span>
	</div>
</div>

<style>
	:global(.front-line) {
		animation: front-flow 1s linear infinite;
	}
	:global(.map-pulse) {
		animation: map-pulse 0.9s ease-out forwards;
	}
	:global(.selected-region) {
		animation: select-glow 1.2s ease-in-out infinite alternate;
	}
	@keyframes front-flow {
		to {
			stroke-dashoffset: -3.4;
		}
	}
	@keyframes map-pulse {
		from {
			transform: translate(-50%, -50%) scale(0.2);
			opacity: 1;
		}
		to {
			transform: translate(-50%, -50%) scale(3.2);
			opacity: 0;
		}
	}
	@keyframes select-glow {
		to {
			box-shadow:
				2px 2px 0 var(--color-ink),
				0 0 10px 3px rgb(255 210 63 / 0.8);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		:global(.front-line),
		:global(.map-pulse),
		:global(.selected-region) {
			animation: none;
		}
		:global(.map-pulse) {
			display: none;
		}
	}
</style>
