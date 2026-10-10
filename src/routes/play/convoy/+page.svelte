<script lang="ts">
	import { onMount } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import CharacterMascot from '#lib/components/CharacterMascot.svelte';
	import ConvoyCanvas from '#lib/components/ConvoyCanvas.svelte';
	import GameOverModal from '#lib/components/GameOverModal.svelte';
	import GameShell from '#lib/components/GameShell.svelte';
	import LivesBar from '#lib/components/LivesBar.svelte';
	import { MAX_HULL } from '#lib/game/convoy/constants.js';
	import { drawConvoyBoard } from '#lib/game/convoy/drawScene.js';
	import { prefersReducedMotion } from '#lib/game/loop.js';
	import { firstPlay } from '#lib/services/tutorial.js';
	import { ConvoyGame } from '#lib/stores/convoyGame.svelte.js';
	import { CHARACTER_NAME } from '#lib/theme/character.js';
	import IconPause from '~icons/lucide/pause';
	import IconPlay from '~icons/lucide/play';
	import IconShield from '~icons/lucide/shield';

	const game = new ConvoyGame({ reducedMotion: prefersReducedMotion() });
	let showTutorial = $state(false);

	onMount(() => {
		game.loadBest();
		showTutorial = firstPlay('convoy');
	});

	// The mascot sent the gunboats: smug when the tanker is in trouble, sweating when it is not
	const mascotPose = $derived(
		game.hull <= 1 ? 'smug' : game.multiplier >= 1.5 ? 'sweating' : 'idle'
	);
</script>

<GameShell
	title={m.mode_convoy_name()}
	score={game.score}
	best={game.best}
	confirmLeave={game.status === 'running' || game.status === 'paused'}
>
	{#snippet actions()}
		{#if game.status === 'running' || game.status === 'paused'}
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

	<section
		class="flex flex-wrap items-center gap-2 font-display text-sm font-bold"
		aria-label={m.mode_convoy_name()}
	>
		<span
			class="inline-flex items-center rounded-[10px_6px_12px_8px] border-3 border-ink bg-paper px-2 py-0.5"
		>
			<LivesBar lives={game.hull} max={MAX_HULL} class="text-base" />
		</span>
		<span class="rounded-[6px_12px_8px_10px] border-3 border-ink bg-paper px-2 py-0.5 tabular-nums">
			{m.convoy_distance()}: {m.convoy_distance_value({ distance: game.distance.toFixed(1) })}
		</span>
		<span
			class="rounded-[12px_8px_10px_6px] border-3 border-ink bg-mustard px-2 py-0.5 tabular-nums"
		>
			{m.convoy_barrels()}: {game.barrels}
		</span>
		<!-- The bonus chips always take their space (hidden while inactive) so the field below never shifts -->
		{#key game.multiplier}
			<span
				class={[
					'rotate-2 rounded-[8px_12px_6px_10px] border-3 border-ink bg-explosion-yellow px-2 py-0.5 tabular-nums',
					game.multiplier > 1 ? 'pop-in' : 'invisible'
				]}
				aria-hidden={game.multiplier > 1 ? undefined : 'true'}
			>
				{m.convoy_multiplier()} ×{Math.max(game.multiplier, 1).toFixed(1)}
			</span>
		{/key}
		{#key game.escort}
			<span
				class={[
					'inline-flex items-center gap-1 rounded-[10px_8px_12px_6px] border-3 border-ink bg-sky px-2 py-0.5',
					game.escort ? 'pop-in' : 'invisible'
				]}
				aria-hidden={game.escort ? undefined : 'true'}
			>
				<IconShield class="size-4" aria-hidden="true" />
				{m.convoy_escort()}
			</span>
		{/key}
		<CharacterMascot pose={mascotPose} class="ms-auto w-12 -rotate-3" />
	</section>

	<ConvoyCanvas {game}>
		{#if game.status === 'ready'}
			<div
				class="sticker pointer-events-auto flex max-w-xs flex-col items-center gap-3 p-4 text-center"
				style:--tilt="-1.5deg"
			>
				<CharacterMascot pose="smug" class="w-20 rotate-3" />
				<p class="font-display text-lg leading-tight font-bold">
					{m.convoy_intro({ characterName: CHARACTER_NAME[getLocale()] })}
				</p>
				{#if showTutorial}
					<p class="text-sm leading-snug">{m.convoy_how_to()}</p>
					<p class="text-xs leading-snug">{m.convoy_how_to_keys()}</p>
				{/if}
				<button type="button" class="btn-chunky bg-tie-red text-lg" onclick={() => game.start()}>
					<IconPlay class="size-5" aria-hidden="true" />
					{m.convoy_start()}
				</button>
			</div>
		{:else if game.status === 'paused'}
			<div
				class="sticker pointer-events-auto flex flex-col items-center gap-3 p-4 text-center"
				style:--tilt="1.5deg"
			>
				<p class="font-display text-2xl font-bold">{m.game_paused()}</p>
				<button type="button" class="btn-chunky bg-flag-blue text-lg" onclick={() => game.resume()}>
					<IconPlay class="size-5" aria-hidden="true" />
					{m.game_resume()}
				</button>
			</div>
		{:else if game.status === 'running'}
			{#if game.nearMisses > 0}
				{#key game.nearMisses}
					<span
						class="convoy-float absolute top-[18%] rotate-[-4deg] rounded-md border-3 border-ink bg-explosion-yellow px-2 font-display text-lg font-bold"
						aria-hidden="true"
					>
						{m.convoy_near_miss()}
					</span>
				{/key}
			{/if}
			{#if game.shieldSaves > 0}
				{#key game.shieldSaves}
					<span
						class="convoy-float absolute top-[30%] rotate-2 rounded-md border-3 border-ink bg-sky px-2 font-display font-bold"
						role="status"
					>
						{m.convoy_escort_saved()}
					</span>
				{/key}
			{/if}
		{/if}
	</ConvoyCanvas>
</GameShell>

<GameOverModal
	open={game.status === 'over'}
	score={game.score}
	modeName={m.mode_convoy_name()}
	isNewBest={game.isNewBest}
	drawBoard={(context, x, y, size) => drawConvoyBoard(context, game.runner, x, y, size)}
	onRetry={() => game.start()}
>
	<dl class="grid grid-cols-3 gap-2 text-center">
		<div class="rounded-[10px_6px_12px_8px] border-3 border-ink bg-paper p-2">
			<dt class="text-xs font-bold uppercase">{m.convoy_distance()}</dt>
			<dd class="font-display text-lg font-bold tabular-nums">
				{m.convoy_distance_value({ distance: game.distance.toFixed(1) })}
			</dd>
		</div>
		<div class="rounded-[6px_12px_8px_10px] border-3 border-ink bg-paper p-2">
			<dt class="text-xs font-bold uppercase">{m.convoy_barrels()}</dt>
			<dd class="font-display text-lg font-bold tabular-nums">{game.barrels}</dd>
		</div>
		<div class="rounded-[12px_8px_10px_6px] border-3 border-ink bg-paper p-2">
			<dt class="text-xs font-bold uppercase">{m.convoy_best_distance()}</dt>
			<dd class="font-display text-lg font-bold tabular-nums">
				{m.convoy_distance_value({ distance: (game.bestDistance ?? game.distance).toFixed(1) })}
			</dd>
		</div>
	</dl>
</GameOverModal>

<style>
	/* A quick bounce up and fade for near-miss and escort call-outs */
	@keyframes convoy-float {
		0% {
			scale: 0.5;
			opacity: 0;
		}
		25% {
			scale: 1.15;
			opacity: 1;
		}
		40% {
			scale: 1;
		}
		80% {
			opacity: 1;
		}
		100% {
			translate: 0 -24px;
			opacity: 0;
		}
	}

	.convoy-float {
		animation: convoy-float 900ms var(--ease-spring) both;
	}

	@media (prefers-reduced-motion: reduce) {
		.convoy-float {
			animation: convoy-float-still 900ms linear both;
		}

		@keyframes convoy-float-still {
			0%,
			80% {
				opacity: 1;
			}
			100% {
				opacity: 0;
			}
		}
	}
</style>
