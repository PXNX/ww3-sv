<script lang="ts">
	import { onMount } from 'svelte';
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';
	import CharacterMascot from '$lib/components/CharacterMascot.svelte';
	import ConvoyCanvas from '$lib/components/ConvoyCanvas.svelte';
	import GameOverModal from '$lib/components/GameOverModal.svelte';
	import GameShell from '$lib/components/GameShell.svelte';
	import { MAX_HULL } from '$lib/game/convoy/constants';
	import { drawConvoyBoard } from '$lib/game/convoy/drawScene';
	import { prefersReducedMotion } from '$lib/game/loop';
	import { localStore } from '$lib/services/storage';
	import { ConvoyGame } from '$lib/stores/convoyGame.svelte';
	import { CHARACTER_NAME } from '$lib/theme/character';
	import IconHeart from '~icons/lucide/heart';
	import IconPause from '~icons/lucide/pause';
	import IconPlay from '~icons/lucide/play';
	import IconShield from '~icons/lucide/shield';

	const SETTINGS_KEY = 'convoy:settings';

	interface ConvoySettings {
		buttons: boolean;
	}

	const isSettings = (value: unknown): value is ConvoySettings =>
		typeof value === 'object' &&
		value !== null &&
		typeof (value as ConvoySettings).buttons === 'boolean';

	const game = new ConvoyGame({ reducedMotion: prefersReducedMotion() });
	let showButtons = $state(false);

	onMount(() => {
		game.loadBest();
		showButtons = localStore().read(SETTINGS_KEY, { buttons: false }, isSettings).buttons;
	});

	function toggleButtons(event: Event) {
		showButtons = (event.currentTarget as HTMLInputElement).checked;
		localStore().write(SETTINGS_KEY, { buttons: showButtons });
	}

	// The mascot sent the gunboats: smug when the tanker is in trouble, sweating when it is not
	const mascotPose = $derived(
		game.hull <= 1 ? 'smug' : game.multiplier >= 1.5 ? 'sweating' : 'idle'
	);
</script>

<GameShell title={m.mode_convoy_name()} score={game.score} best={game.best}>
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
			class="inline-flex items-center gap-1 rounded-[10px_6px_12px_8px] border-3 border-ink bg-paper px-2 py-0.5"
			role="status"
			aria-label={m.convoy_hull_status({ hull: game.hull, max: MAX_HULL })}
		>
			<span aria-hidden="true">{m.convoy_hull()}</span>
			{#each Array.from({ length: MAX_HULL }, (_, index) => index) as index (index)}
				<IconHeart
					class="size-4 {index < game.hull ? 'fill-tie-red' : 'opacity-30'}"
					aria-hidden="true"
				/>
			{/each}
			<span aria-hidden="true" class="tabular-nums">{game.hull}/{MAX_HULL}</span>
		</span>
		<span class="rounded-[6px_12px_8px_10px] border-3 border-ink bg-paper px-2 py-0.5 tabular-nums">
			{m.convoy_distance()}: {m.convoy_distance_value({ distance: game.distance.toFixed(1) })}
		</span>
		<span
			class="rounded-[12px_8px_10px_6px] border-3 border-ink bg-mustard px-2 py-0.5 tabular-nums"
		>
			{m.convoy_barrels()}: {game.barrels}
		</span>
		{#if game.multiplier > 1}
			{#key game.multiplier}
				<span
					class="pop-in rotate-2 rounded-[8px_12px_6px_10px] border-3 border-ink bg-explosion-yellow px-2 py-0.5 tabular-nums"
				>
					{m.convoy_multiplier()} ×{game.multiplier.toFixed(1)}
				</span>
			{/key}
		{/if}
		{#if game.escort}
			<span
				class="pop-in inline-flex items-center gap-1 rounded-[10px_8px_12px_6px] border-3 border-ink bg-sky px-2 py-0.5"
			>
				<IconShield class="size-4" aria-hidden="true" />
				{m.convoy_escort()}
			</span>
		{/if}
		<CharacterMascot pose={mascotPose} class="ms-auto w-12 -rotate-3" />
	</section>

	<ConvoyCanvas {game} {showButtons}>
		{#if game.status === 'ready'}
			<div
				class="sticker pointer-events-auto flex max-w-xs flex-col items-center gap-3 p-4 text-center"
				style:--tilt="-1.5deg"
			>
				<CharacterMascot pose="smug" class="w-20 rotate-3" />
				<p class="font-display text-lg leading-tight font-bold">
					{m.convoy_intro({ characterName: CHARACTER_NAME[getLocale()] })}
				</p>
				<p class="text-sm leading-snug">{m.convoy_how_to()}</p>
				<p class="text-xs leading-snug">{m.convoy_how_to_keys()}</p>
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

	<label class="flex items-center gap-2 self-center text-sm font-semibold">
		<input
			type="checkbox"
			class="toggle border-3 border-ink"
			checked={showButtons}
			onchange={toggleButtons}
		/>
		{m.convoy_buttons_setting()}
	</label>
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
