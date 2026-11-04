<!-- Grain Corridor: steer grain ships through the Black Sea lanes, dodge mines and patrols, make port. -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import BeltRoadStars from '#lib/components/BeltRoadStars.svelte';
	import GameOverModal from '#lib/components/GameOverModal.svelte';
	import GameShell from '#lib/components/GameShell.svelte';
	import GrainCanvas from '#lib/components/GrainCanvas.svelte';
	import GrainShipPreview from '#lib/components/GrainShipPreview.svelte';
	import LivesBar from '#lib/components/LivesBar.svelte';
	import PauseOverlay from '#lib/components/PauseOverlay.svelte';
	import { MAX_SWEEPERS, SHIPS, SHIP_IDS, type ShipId } from '#lib/game/grain/config.js';
	import { prefersReducedMotion } from '#lib/game/loop.js';
	import { firstPlay } from '#lib/services/tutorial.js';
	import { GrainGame } from '#lib/stores/grainGame.svelte.js';
	import IconAnchor from '~icons/lucide/anchor';
	import IconPause from '~icons/lucide/pause';
	import IconPlay from '~icons/lucide/play';
	import IconRadar from '~icons/lucide/radar';
	import IconWheat from '~icons/lucide/wheat';

	const game = new GrainGame({ reducedMotion: prefersReducedMotion() });
	let showTutorial = $state(false);

	onMount(() => {
		game.load();
		showTutorial = firstPlay('grain');
	});

	const shipNames: Record<ShipId, () => string> = {
		coaster: () => m.grain_ship_coaster(),
		freighter: () => m.grain_ship_freighter(),
		bulker: () => m.grain_ship_bulker()
	};
	const shipNotes: Record<ShipId, () => string> = {
		coaster: () => m.grain_ship_coaster_note(),
		freighter: () => m.grain_ship_freighter_note(),
		bulker: () => m.grain_ship_bulker_note()
	};
	const threatNotes = {
		mines: () => m.grain_threat_mines(),
		drift: () => m.grain_threat_drift(),
		patrol: () => m.grain_threat_patrol(),
		fields: () => m.grain_threat_fields(),
		storm: () => m.grain_threat_storm()
	};
	const ranks = [
		() => m.grain_rank_0(),
		() => m.grain_rank_1(),
		() => m.grain_rank_2(),
		() => m.grain_rank_3()
	];

	const holdShare = $derived(game.holdMax > 0 ? game.hold / game.holdMax : 0);
	const kilometres = $derived((game.distance / 1000).toFixed(1));
	const inRun = $derived(game.status === 'running' || game.status === 'paused');
</script>

<GameShell
	title={m.mode_grain_name()}
	score={game.score}
	best={game.best}
	confirmLeave={inRun}
	immersive
>
	{#snippet actions()}
		{#if inRun}
			<button type="button" class="btn-chunky px-3 py-1 text-sm" onclick={() => game.togglePause()}>
				{#if game.status === 'paused'}
					<IconPlay class="size-4" aria-hidden="true" />
					{m.game_resume()}
				{:else}
					<IconPause class="size-4" aria-hidden="true" />
					{m.game_pause()}
				{/if}
			</button>
		{/if}
	{/snippet}

	{#if inRun}
		<section
			class="pointer-events-none absolute inset-x-2 top-(--hud-top) z-10 flex flex-wrap items-center gap-2 font-display text-sm font-bold"
			aria-label={m.mode_grain_name()}
		>
			<span
				class="inline-flex items-center rounded-[10px_6px_12px_8px] border-3 border-ink bg-paper px-2 py-0.5"
			>
				<LivesBar lives={game.lives} max={game.maxLives} class="text-base" />
			</span>
			{#key game.wave}
				<span
					class="pop-in rounded-[6px_12px_8px_10px] border-3 border-ink bg-paper px-2 py-0.5 tabular-nums"
				>
					{m.grain_hud_wave({ wave: game.wave })}
				</span>
			{/key}
			<span
				class="inline-flex items-center gap-1.5 rounded-[12px_8px_10px_6px] border-3 border-ink bg-mustard px-2 py-0.5 tabular-nums"
				role="img"
				aria-label={m.grain_hud_hold({ hold: game.hold, max: game.holdMax })}
			>
				<IconWheat class="size-4" aria-hidden="true" />
				<span class="relative h-2.5 w-16 overflow-hidden rounded-full border-2 border-ink bg-paper">
					<span
						class="absolute inset-y-0 start-0 bg-tie-red transition-[width] duration-200"
						style:width="{holdShare * 100}%"
					></span>
				</span>
				{game.hold}/{game.holdMax}
			</span>
			<!-- Always takes its space so the bar never shifts when the chain starts or breaks -->
			{#key game.multiplier}
				<span
					class={[
						'rotate-2 rounded-[8px_12px_6px_10px] border-3 border-ink bg-explosion-yellow px-2 py-0.5 tabular-nums',
						game.multiplier > 1 ? 'pop-in' : 'invisible'
					]}
					aria-hidden={game.multiplier > 1 ? undefined : 'true'}
				>
					×{game.multiplier}
				</span>
			{/key}
			<span
				class="ms-auto inline-flex items-center gap-1 rounded-[10px_8px_12px_6px] border-3 border-ink bg-paper px-2 py-0.5 tabular-nums"
			>
				<IconAnchor class="size-4" aria-hidden="true" />
				{m.grain_hud_ports({ ports: game.ports, km: kilometres })}
			</span>
		</section>

		<!-- The minesweeper call sits under the thumb of the steering hand's partner -->
		<div
			class="pointer-events-none absolute end-[calc(0.75rem+env(safe-area-inset-right))] bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-10"
		>
			<button
				type="button"
				class="btn-chunky pointer-events-auto flex min-w-24 flex-col items-center gap-0.5 bg-sky px-3 py-2 text-sm disabled:opacity-60"
				disabled={game.sweepers === 0 || game.status !== 'running'}
				onclick={() => game.sweep()}
				aria-label={m.grain_sweep_aria({ count: game.sweepers })}
			>
				<span class="inline-flex items-center gap-1.5">
					<IconRadar class="size-5" aria-hidden="true" />
					{m.grain_sweep()}
				</span>
				<span class="flex gap-1" aria-hidden="true">
					{#each Array.from({ length: MAX_SWEEPERS }, (_, i) => i) as index (index)}
						<span
							class={[
								'size-2.5 rounded-full border-2 border-ink',
								index < game.sweepers ? 'bg-explosion-yellow' : 'bg-paper'
							]}
						></span>
					{/each}
				</span>
			</button>
		</div>
	{/if}

	<GrainCanvas {game}>
		{#if game.status === 'ready'}
			<div
				class="sticker pointer-events-auto flex max-h-full max-w-lg flex-col items-center gap-3 overflow-y-auto p-4 text-center"
				style:--tilt="-1.5deg"
			>
				<p class="font-display text-lg leading-tight font-bold">{m.grain_intro()}</p>
				{#if showTutorial}
					<p class="text-sm leading-snug">{m.grain_how_to()}</p>
					<p class="text-xs leading-snug">{m.grain_how_to_keys()}</p>
				{/if}
				<div
					class="grid w-full grid-cols-3 gap-2"
					role="radiogroup"
					aria-label={m.grain_choose_ship()}
				>
					{#each SHIP_IDS as id (id)}
						{@const spec = SHIPS[id]}
						<button
							type="button"
							role="radio"
							aria-checked={game.shipId === id}
							class={[
								'flex flex-col items-center gap-1 rounded-[10px_6px_12px_8px] border-3 border-ink p-2 text-xs leading-tight transition-transform',
								game.shipId === id
									? 'bg-explosion-yellow shadow-[3px_3px_0_var(--color-ink)]'
									: 'bg-paper hover:-translate-y-0.5'
							]}
							onclick={() => game.selectShip(id)}
						>
							<GrainShipPreview shipId={id} />
							<span class="font-display text-sm font-bold">{shipNames[id]()}</span>
							<span class="tabular-nums">
								{m.grain_ship_stats({
									lives: spec.lives,
									hold: spec.hold,
									sweepers: spec.sweepers
								})}
							</span>
							<span class="opacity-80">{shipNotes[id]()}</span>
						</button>
					{/each}
				</div>
				<button type="button" class="btn-chunky bg-tie-red text-lg" onclick={() => game.start()}>
					<IconPlay class="size-5" aria-hidden="true" />
					{m.grain_start()}
				</button>
				{#if game.bestPorts !== null}
					<p class="text-xs">{m.grain_best_ports({ ports: game.bestPorts })}</p>
				{/if}
			</div>
		{:else if game.status === 'paused'}
			<PauseOverlay onResume={() => game.resume()} />
		{:else if game.status === 'running' && game.banner}
			{#key game.banner.id}
				<div
					class="grain-banner pointer-events-none absolute top-[22%] flex max-w-sm flex-col items-center gap-1 rounded-md border-3 border-ink bg-paper px-4 py-2 text-center"
					role="status"
				>
					<span class="font-display text-xl leading-none font-bold">
						{m.grain_wave_title({ wave: game.banner.wave })}
					</span>
					<span class="text-sm leading-snug">{threatNotes[game.banner.threat]()}</span>
				</div>
			{/key}
		{/if}
	</GrainCanvas>
</GameShell>

<GameOverModal
	open={game.status === 'over'}
	score={game.score}
	mode="grain"
	modeName={m.mode_grain_name()}
	isNewBest={game.isNewBest}
	onRetry={() => game.start()}
>
	<div class="flex flex-col items-center gap-1">
		<BeltRoadStars stars={game.stars} class="size-8" />
		<p class="font-display text-lg font-bold">{ranks[game.stars]()}</p>
	</div>
	<dl class="grid grid-cols-3 gap-2 text-center">
		{#each [{ label: m.grain_stat_ports(), value: String(game.ports) }, { label: m.grain_stat_distance(), value: m.grain_distance_value( { km: kilometres } ) }, { label: m.grain_stat_delivered(), value: String(game.delivered) }, { label: m.grain_stat_chain(), value: String(game.bestChain) }, { label: m.grain_stat_near(), value: String(game.nearMisses) }, { label: m.grain_stat_swept(), value: String(game.swept) }] as stat (stat.label)}
			<div class="rounded-[10px_6px_12px_8px] border-3 border-ink bg-paper p-2">
				<dt class="text-xs font-bold uppercase">{stat.label}</dt>
				<dd class="font-display text-lg font-bold tabular-nums">{stat.value}</dd>
			</div>
		{/each}
	</dl>
	<button type="button" class="btn-chunky mx-auto mt-2 text-sm" onclick={() => game.reset()}>
		{m.grain_change_ship()}
	</button>
</GameOverModal>

<style>
	/* The wave banner drops in, holds, and slips away */
	@keyframes grain-banner {
		0% {
			opacity: 0;
			translate: 0 -16px;
			scale: 0.85;
		}
		12% {
			opacity: 1;
			translate: 0 0;
			scale: 1.04;
		}
		20% {
			scale: 1;
		}
		78% {
			opacity: 1;
		}
		100% {
			opacity: 0;
			translate: 0 -10px;
		}
	}

	.grain-banner {
		animation: grain-banner 2600ms var(--ease-spring) both;
	}

	@media (prefers-reduced-motion: reduce) {
		.grain-banner {
			animation: grain-banner-still 2600ms linear both;
		}

		@keyframes grain-banner-still {
			0%,
			78% {
				opacity: 1;
			}
			100% {
				opacity: 0;
			}
		}
	}
</style>
