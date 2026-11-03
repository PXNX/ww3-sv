<!--
	The sea chart, full screen and sideways: your home bay in the south-west, a string of enemy bases
	on small islands across the middle, and the orc lands, a broad dark landmass along the north
	edge. Every island is a little isometric picture of the base you will land on. The whole chart is
	buried in clouds; the radar tower clears them area by area, so the north only shows once the radar
	reaches it. Icons say what you can do, the words are in tooltips.
-->
<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import {
		ISLANDS,
		ISLAND_IDS,
		HOME_MAP_POSITION,
		ISLAND_MAP_POSITIONS,
		ORC_LANDS_FROM_INDEX
	} from '#lib/game/beachhead/config.js';
	import { ambientEvents, nextRetakeAt } from '#lib/game/beachhead/mapLog.js';
	import { createBattle } from '#lib/game/beachhead/battle.js';
	import { BATTLE_VIEW, drawScene } from '#lib/game/beachhead/render.js';
	import type { BeachheadGame } from '#lib/stores/beachheadGame.svelte.js';
	import { islandName } from './beachheadText';
	import { zoomPan } from './zoomPan';
	import BeachheadExpedition from './BeachheadExpedition.svelte';
	import BeachheadResources from './BeachheadResources.svelte';
	import BeachheadSheet from './BeachheadSheet.svelte';
	import BeachheadTakeoverNotice from './BeachheadTakeoverNotice.svelte';
	import IconAnchor from '~icons/lucide/anchor';
	import IconCompass from '~icons/lucide/compass';
	import IconCrosshair from '~icons/lucide/crosshair';
	import IconFlag from '~icons/lucide/flag-triangle-right';
	import IconLock from '~icons/lucide/lock';
	import IconShip from '~icons/lucide/ship';
	import IconSkull from '~icons/lucide/skull';
	import IconSwords from '~icons/lucide/swords';
	import IconRadar from '~icons/lucide/radar';

	let { game }: { game: BeachheadGame } = $props();
	let expeditionOpen = $state(false);
	let now = $state(Date.now());
	$effect(() => {
		const timer = setInterval(() => (now = Date.now()), 30_000);
		return () => clearInterval(timer);
	});

	const retakeAt = $derived(nextRetakeAt(game.campaign.lastTakebackMs, game.controlled));
	const logEvents = $derived(ambientEvents(now, game.islandCount, 4));
	const clock = (ms: number): string => {
		const total = Math.max(0, Math.ceil(ms / 1000));
		const hours = Math.floor(total / 3600);
		const minutes = Math.floor((total % 3600) / 60);
		return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
	};

	const HOME = HOME_MAP_POSITION;
	/** The chart is about 16:9, so sideways distances count a little more than upward ones */
	const ASPECT = 1.78;

	function noise(seed: number): number {
		const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
		return value - Math.floor(value);
	}

	/** A fixed bank of cloud puffs over the whole chart */
	const PUFFS = Array.from({ length: 17 * 10 }, (_, index) => {
		const col = index % 17;
		const row = Math.floor(index / 17);
		return {
			x: ((col + 0.5 + (noise(index) - 0.5) * 0.9) / 17) * 100,
			y: ((row + 0.5 + (noise(index + 900) - 0.5) * 0.9) / 10) * 100,
			size: 10 + noise(index + 31) * 7,
			drift: 14 + noise(index + 77) * 16,
			flip: noise(index + 5) > 0.5
		};
	});

	/** Where the radar has cleared the sky: the home bay and every island it has charted */
	const clearings = $derived([
		{ x: HOME.x, y: HOME.y, r: 34 },
		...ISLAND_MAP_POSITIONS.slice(0, game.chartedCount).map((point, index) => ({
			...point,
			r: index >= ORC_LANDS_FROM_INDEX ? 38 : 32
		}))
	]);

	function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
		return Math.hypot((a.x - b.x) * ASPECT, a.y - b.y);
	}

	const clouds = $derived(
		PUFFS.map((puff) => {
			const border = puff.x < 3 || puff.x > 97 || puff.y > 97 || puff.y < 2;
			let nearest = Number.POSITIVE_INFINITY;
			let reach = 1;
			for (const clearing of clearings) {
				const gap = distance(puff, clearing) / clearing.r;
				if (gap < nearest) {
					nearest = gap;
					reach = clearing.r;
				}
			}
			return {
				...puff,
				cleared: !border && nearest < 1,
				// The cloud nearest the radar's new reach melts first, the rest follow like a wave
				delay: Math.round(nearest * reach * 28)
			};
		})
	);

	/** How far the chart is zoomed, so the little island pictures can be redrawn at that resolution */
	let zoom = $state(1);

	function trackZoom(node: HTMLElement) {
		const onZoom = (event: Event) => {
			zoom = (event as CustomEvent<{ scale: number }>).detail.scale;
		};
		node.addEventListener('zoomchange', onZoom);
		return { destroy: () => node.removeEventListener('zoomchange', onZoom) };
	}

	/** Draws the little isometric picture of an island's base, and again sharper whenever the chart is zoomed */
	function miniature(node: HTMLCanvasElement, options: { index: number; zoom: number }) {
		draw(node, options.index, options.zoom);
		return {
			update(next: { index: number; zoom: number }) {
				draw(node, next.index, next.zoom);
			}
		};
	}

	function draw(node: HTMLCanvasElement, index: number, zoomed: number) {
		const width = 180;
		const height = Math.round((width * BATTLE_VIEW.height) / BATTLE_VIEW.width);
		const ratio = Math.min(6, (window.devicePixelRatio || 1) * Math.max(1, zoomed));
		node.width = width * ratio;
		node.height = height * ratio;
		const context = node.getContext('2d');
		if (!context) return;
		const scale = (width * ratio) / BATTLE_VIEW.width;
		context.setTransform(scale, 0, 0, scale, 0, 0);
		drawScene(
			context,
			createBattle(ISLANDS[index]),
			{ effects: [], timeMs: 0, map: true },
			BATTLE_VIEW
		);
	}

	const islandAria = (index: number, islandId: string): string => {
		const name = islandName(index);
		if (game.isControlled(islandId)) {
			return `${name}, ${m.beachhead_island_controlled()}, ${m.beachhead_island_tax(game.incomeFor(index))}`;
		}
		if (game.isUnlocked(index)) return `${name}, ${m.beachhead_attack_island()}`;
		return `${name}, ${m.beachhead_island_locked()}`;
	};
</script>

<div class="map-sea absolute inset-0 overflow-hidden" use:zoomPan={{ max: 3 }} use:trackZoom>
	<div data-zoom class="absolute inset-0">
		<div class="sea-depth absolute inset-0" aria-hidden="true"></div>

		<!-- The orc lands: a broad, jagged landmass along the north edge -->
		<svg
			class="pointer-events-none absolute inset-x-0 top-0 h-[40%] w-full"
			viewBox="0 0 100 100"
			preserveAspectRatio="none"
			aria-hidden="true"
		>
			<path
				d="M0 0H100V52L96 60 91 50 86 64 80 52 74 66 68 50 61 62 55 46 49 64 42 50 36 66 30 52 23 64 17 50 10 62 5 52 0 62Z"
				fill="#f1e9c8"
				stroke="#111"
				stroke-width="1.2"
				vector-effect="non-scaling-stroke"
				transform="translate(0 4)"
			/>
			<path
				d="M0 0H100V46L96 54 91 44 86 58 80 46 74 60 68 44 61 56 55 40 49 58 42 44 36 60 30 46 23 58 17 44 10 56 5 46 0 56Z"
				fill="#64704a"
				stroke="#111"
				stroke-width="1.2"
				vector-effect="non-scaling-stroke"
			/>
			<!-- Ridges, dead trees and a smoking crater -->
			<g fill="#3d3a33" stroke="#111" stroke-width="0.8" vector-effect="non-scaling-stroke">
				<path d="M8 28L14 8 20 28Z" />
				<path d="M36 22L43 4 50 22Z" />
				<path d="M60 26L67 6 74 26Z" />
				<path d="M84 24L90 8 96 24Z" />
			</g>
			<g fill="#8a8f6a" opacity="0.55">
				<ellipse cx="27" cy="30" rx="6" ry="3" />
				<ellipse cx="55" cy="34" rx="7" ry="3" />
				<ellipse cx="80" cy="36" rx="6" ry="3" />
			</g>
		</svg>

		<!-- Home bay -->
		<button
			type="button"
			class="home-marker btn-chunky absolute z-30 flex size-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-khaki p-0 text-paper sm:size-20"
			style:left="{HOME.x}%"
			style:top="{HOME.y}%"
			aria-label={m.beachhead_home_base()}
			title={m.beachhead_home_base()}
			onclick={() => game.goBase()}
		>
			<IconAnchor class="size-8 sm:size-10" aria-hidden="true" />
		</button>

		<!-- The enemy bases, each a little picture of the island you will land on -->
		<ol class="absolute inset-0 m-0 list-none p-0">
			{#each ISLAND_IDS as islandId, index (islandId)}
				{@const position = ISLAND_MAP_POSITIONS[index] ?? { x: 50, y: 50 }}
				{@const charted = game.isCharted(index)}
				{@const unlocked = charted && game.isUnlocked(index)}
				{@const controlled = game.isControlled(islandId)}
				{@const attackable = unlocked && !controlled}
				<li
					class="absolute z-30 -translate-x-1/2 -translate-y-1/2 transition-opacity duration-[1800ms]"
					class:opacity-0={!charted}
					class:pointer-events-none={!charted}
					style:left="{position.x}%"
					style:top="{position.y}%"
				>
					<button
						type="button"
						class="island-marker group relative flex w-[clamp(6.5rem,15vw,11rem)] flex-col items-center disabled:cursor-not-allowed"
						class:island-locked={charted && !unlocked}
						class:island-held={controlled}
						disabled={!attackable}
						aria-label={islandAria(index, islandId)}
						title={islandName(index)}
						onclick={() => game.openIsland(index)}
					>
						<canvas use:miniature={{ index, zoom }} class="block h-auto w-full" aria-hidden="true"
						></canvas>

						<span
							class="absolute -end-1 top-0 flex size-8 items-center justify-center rounded-full border-2 border-ink shadow-[2px_2px_0_var(--color-ink)] {controlled
								? 'bg-khaki text-paper'
								: attackable
									? 'attack-ping bg-tie-red text-paper'
									: 'bg-sand text-ink'}"
						>
							{#if controlled}
								<IconFlag class="size-3.5" aria-hidden="true" />
							{:else if attackable}
								<IconCrosshair class="size-4" aria-hidden="true" />
							{:else}
								<IconLock class="size-3" aria-hidden="true" />
							{/if}
						</span>

						<span
							dir="auto"
							class="label -mt-1 rounded-full border-2 border-ink bg-paper/95 px-2 py-px text-[0.68rem] leading-tight font-bold transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 sm:text-xs {attackable
								? 'opacity-100'
								: 'opacity-0'}"
						>
							{islandName(index)}
						</span>
					</button>
				</li>
			{/each}
		</ol>

		<!-- Clouds over everything the radar has not reached yet -->
		<div class="pointer-events-none absolute inset-0 z-20" aria-hidden="true">
			{#each clouds as cloud, index (index)}
				<span
					class="cloud absolute"
					class:cloud-gone={cloud.cleared}
					style:left="{cloud.x}%"
					style:top="{cloud.y}%"
					style:width="{cloud.size}%"
					style:--delay="{cloud.cleared ? cloud.delay : 0}ms"
					style:--drift="{cloud.drift}s"
					style:--flip={cloud.flip ? -1 : 1}
				></span>
			{/each}
		</div>
	</div>

	<!-- The HUD sits above the clouds -->
	<div
		class="pointer-events-none absolute top-(--hud-top) left-(--hud-left) z-40 flex max-w-[55%] flex-col items-start gap-1.5"
	>
		<p
			class="pointer-events-auto flex items-center gap-1.5 rounded-full border-2 border-ink bg-paper px-2.5 py-0.5 font-display text-sm font-bold tabular-nums shadow-[2px_2px_0_var(--color-ink)]"
			title={m.beachhead_radar_summary({ count: game.chartedCount, total: game.islandCount })}
		>
			<IconRadar class="size-4" aria-hidden="true" />
			{game.chartedCount}/{game.islandCount}
		</p>
		<div class="pointer-events-auto">
			<BeachheadTakeoverNotice {game} />
		</div>
		<ul
			class="pointer-events-auto flex max-w-56 flex-col gap-1 rounded-[12px] border-2 border-ink bg-paper/90 p-1.5 text-[0.7rem] leading-snug font-semibold shadow-[2px_2px_0_var(--color-ink)]"
			aria-label={m.beachhead_log_title()}
		>
			{#if retakeAt !== null}
				<li class="flex items-start gap-1 font-bold text-tie-red">
					<IconSkull class="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
					{m.beachhead_log_retake({ time: clock(retakeAt - now) })}
				</li>
			{/if}
			{#each logEvents as event, index (index)}
				<li class="flex items-start gap-1">
					{#if event.kind === 'raiders'}
						<IconShip class="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
						{m.beachhead_log_raiders({ island: islandName(event.island) })}
					{:else if event.kind === 'attack'}
						<IconSwords class="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
						{m.beachhead_log_attack({ player: event.player, island: islandName(event.island) })}
					{:else}
						<IconFlag class="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
						{m.beachhead_log_taken({ player: event.player, island: islandName(event.island) })}
					{/if}
				</li>
			{/each}
		</ul>
	</div>
	<div
		class="pointer-events-none absolute right-(--hud-right) bottom-[calc(0.5rem+env(safe-area-inset-bottom))] z-40"
	>
		<button
			type="button"
			class="btn-chunky pointer-events-auto relative flex size-14 items-center justify-center rounded-full bg-explosion-yellow p-0"
			aria-label={m.beachhead_expedition_title()}
			title={m.beachhead_expedition_title()}
			onclick={() => (expeditionOpen = true)}
		>
			<IconCompass class="size-7" aria-hidden="true" />
			{#if game.expeditionDone}
				<span
					class="absolute -end-1 -top-1 size-4 rounded-full border-2 border-ink bg-tie-red"
					aria-hidden="true"
				></span>
			{/if}
		</button>
	</div>
	<div class="pointer-events-none absolute top-(--hud-top) right-(--hud-right) z-40">
		<div class="pointer-events-auto">
			<BeachheadResources {game} />
		</div>
	</div>
</div>

<BeachheadSheet
	open={expeditionOpen}
	title={m.beachhead_expedition_title()}
	onclose={() => (expeditionOpen = false)}
>
	<BeachheadExpedition {game} />
</BeachheadSheet>

<style>
	.map-sea {
		background: linear-gradient(150deg, #3f8fae 0%, #2e7595 46%, #1f5a78 100%);
	}

	.sea-depth {
		background-image:
			repeating-linear-gradient(115deg, #ffffff10 0 2px, transparent 2px 22px),
			repeating-linear-gradient(25deg, #0000000c 0 1px, transparent 1px 16px);
	}

	.island-marker {
		filter: drop-shadow(0 3px 0 #00000030);
		transition: transform 160ms ease;
	}

	.island-marker:not(:disabled):hover,
	.island-marker:not(:disabled):focus-visible {
		transform: translateY(-3px) scale(1.06);
	}

	.island-locked canvas {
		filter: grayscale(0.7) brightness(0.9);
	}

	.island-held canvas {
		filter: saturate(0.85);
	}

	.attack-ping {
		animation: attack-ping 2s ease-in-out infinite;
	}

	@keyframes attack-ping {
		0%,
		100% {
			box-shadow: 2px 2px 0 var(--color-ink);
		}
		50% {
			box-shadow:
				2px 2px 0 var(--color-ink),
				0 0 0 5px color-mix(in srgb, var(--color-tie-red) 45%, transparent);
		}
	}

	/* A cloud is a soft white bank of three overlapping blobs; it drifts a little and melts away */
	.cloud {
		aspect-ratio: 1.7;
		transform: translate(-50%, -50%) scaleX(var(--flip, 1));
		background:
			radial-gradient(ellipse at 30% 60%, #fff 0 38%, transparent 40%),
			radial-gradient(ellipse at 55% 42%, #fff 0 42%, transparent 44%),
			radial-gradient(ellipse at 74% 62%, #f1f6fa 0 36%, transparent 38%);
		filter: drop-shadow(0 4px 0 #9fb8c755);
		opacity: 0.97;
		transition:
			opacity 2.4s ease var(--delay, 0ms),
			scale 2.4s ease var(--delay, 0ms),
			translate 2.4s ease var(--delay, 0ms);
		animation: cloud-drift var(--drift, 20s) ease-in-out infinite alternate;
	}

	.cloud-gone {
		opacity: 0;
		scale: 1.5;
		translate: 0 -12%;
	}

	@keyframes cloud-drift {
		from {
			margin-left: -0.8%;
		}
		to {
			margin-left: 0.8%;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.attack-ping,
		.cloud {
			animation: none;
		}

		.cloud {
			transition-duration: 0.01ms;
		}
	}
</style>
