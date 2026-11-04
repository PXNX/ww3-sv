<!--
	Falklands playfield: the South Atlantic chart with both fleets, today's weather, the fuel gauge,
	the three speeds and the diplomatic track. Every button is one day. The playfield is a chart, so
	it stays left to right and never scrolls.
-->
<script lang="ts">
	import {
		DIPLOMACY_TARGET,
		MAX_HULL,
		REPAIR_HULL,
		STORM_EXTRA_FUEL
	} from '#lib/game/falklands/config.js';
	import { SPEEDS, type Speed } from '#lib/game/falklands/state.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { FalklandsGame } from '#lib/stores/falklandsGame.svelte.js';
	import FalklandsSea from './FalklandsSea.svelte';
	import { legText, speedLabel, weatherEffect, weatherText } from './falklandsText.js';
	import IconCloud from '~icons/lucide/cloud';
	import IconCloudFog from '~icons/lucide/cloud-fog';
	import IconCloudLightning from '~icons/lucide/cloud-lightning';
	import IconHandshake from '~icons/lucide/handshake';
	import IconPlay from '~icons/lucide/play';
	import IconWrench from '~icons/lucide/wrench';

	let { game }: { game: FalklandsGame } = $props();

	const speeds: readonly Speed[] = ['slow', 'cruise', 'flank'];
	const playing = $derived(game.status === 'playing');
	const storm = $derived(game.weather === 'storm');

	function costFor(speed: Speed): number {
		return SPEEDS[speed].fuel + (storm ? STORM_EXTRA_FUEL : 0);
	}

	function blocked(speed: Speed): boolean {
		return speed === 'flank' && game.weather !== 'clear';
	}

	function unaffordable(speed: Speed): boolean {
		return game.fuel < costFor(speed);
	}

	function onKey(event: KeyboardEvent) {
		if (game.status !== 'playing' || event.ctrlKey || event.metaKey || event.altKey) return;
		const target = event.target;
		if (target instanceof HTMLElement && target.closest('input, select, textarea')) return;
		if (event.code === 'Digit1') game.move('slow');
		if (event.code === 'Digit2') game.move('cruise');
		if (event.code === 'Digit3') game.move('flank');
		if (event.code === 'KeyT') game.talk();
		if (event.code === 'KeyD') game.deal();
		if (event.code === 'KeyR') game.repair();
	}
</script>

<svelte:window onkeydown={onKey} />

<div
	data-playfield
	dir="ltr"
	class="relative flex w-full flex-1 flex-col gap-2 overflow-hidden rounded-[14px_8px_16px_10px] border-3 border-ink bg-sand p-2 shadow-[4px_4px_0_var(--color-ink)] select-none sm:p-3"
>
	<!-- Today's weather and the fuel gauge -->
	<div
		class="flex items-center justify-between gap-2 rounded-md border-3 border-ink bg-paper px-3 py-1.5 shadow-[2px_2px_0_var(--color-ink)]"
	>
		<div class="flex min-w-0 items-center gap-1.5">
			{#if game.weather === 'fog'}
				<IconCloudFog class="size-5 shrink-0" aria-hidden="true" />
			{:else if game.weather === 'storm'}
				<IconCloudLightning class="size-5 shrink-0" aria-hidden="true" />
			{:else}
				<IconCloud class="size-5 shrink-0" aria-hidden="true" />
			{/if}
			<p
				dir="auto"
				class="min-w-0 truncate font-display text-sm leading-tight font-bold sm:text-base"
			>
				{weatherText(game.weather)}
			</p>
			<p dir="auto" class="hidden truncate text-xs font-semibold opacity-80 sm:block">
				{weatherEffect(game.weather)}
			</p>
		</div>
		<div class="flex shrink-0 items-center gap-1.5">
			<p dir="auto" class="text-xs font-bold tabular-nums">
				{m.falklands_hud_fuel({ fuel: game.fuel })}
			</p>
			<div class="h-2.5 w-14 overflow-hidden rounded-full border-2 border-ink bg-sand">
				<div
					class="h-full {game.fuel > 30 ? 'bg-[#8fd19e]' : 'bg-tie-red'}"
					style:width="{Math.max(0, Math.min(100, game.fuel))}%"
				></div>
			</div>
		</div>
	</div>

	<!-- Hull, chaff, streak and the current leg -->
	<div
		class="flex items-center justify-between gap-2 rounded-md border-2 border-ink bg-paper px-3 py-1 text-xs font-bold tabular-nums"
	>
		<span dir="auto" class="truncate">{legText(game.leg)}</span>
		<span class="flex shrink-0 items-center gap-2">
			<span dir="auto">{m.falklands_hud_hull({ hull: game.hull })}</span>
			<span class="h-2.5 w-12 overflow-hidden rounded-full border-2 border-ink bg-sand">
				<span
					class="block h-full transition-[width] duration-500 {game.hull > 40
						? 'bg-[#8fd19e]'
						: 'bg-tie-red'}"
					style:width="{Math.max(0, Math.min(100, (game.hull / MAX_HULL) * 100))}%"
				></span>
			</span>
			<span dir="auto">{m.falklands_hud_chaff({ count: game.chaff })}</span>
			{#if game.streak >= 2}
				<span dir="auto" class="text-[#a77a00]"
					>{m.falklands_hud_streak({ count: game.streak })}</span
				>
			{/if}
		</span>
	</div>

	<!-- The animated chart -->
	<div role="group" aria-label={m.falklands_aria_map()}>
		<FalklandsSea {game} />
		<p class="sr-only" aria-live="polite">
			{game.zonesLeft === 1
				? m.falklands_hud_distance_one()
				: m.falklands_hud_distance({ left: game.zonesLeft })}
			{game.enemyLeft === 1
				? m.falklands_hud_enemy_one()
				: m.falklands_hud_enemy({ left: game.enemyLeft })}
		</p>
	</div>

	<!-- The three speeds, each worth a day and some fuel -->
	<div class="grid grid-cols-3 gap-1.5">
		{#each speeds as speed (speed)}
			<button
				type="button"
				class="btn-chunky flex-col gap-0.5 px-1 py-2 text-xs leading-tight disabled:opacity-50 sm:text-sm"
				disabled={!playing || blocked(speed) || unaffordable(speed)}
				onclick={() => game.move(speed)}
			>
				<span dir="auto" class="font-bold">{speedLabel(speed)}</span>
				<span class="text-[0.65rem] tabular-nums sm:text-xs">
					{SPEEDS[speed].zones === 1
						? m.falklands_move_summary_one({ fuel: costFor(speed) })
						: m.falklands_move_summary({ zones: SPEEDS[speed].zones, fuel: costFor(speed) })}
				</span>
			</button>
		{/each}
	</div>

	<!-- The diplomatic track: talks take a day, the deal is the slower win -->
	<div class="grid grid-cols-3 gap-1.5">
		<button
			type="button"
			class="btn-chunky flex-col gap-0.5 px-2 py-2 text-xs leading-tight disabled:opacity-50 sm:text-sm"
			disabled={!playing}
			onclick={() => game.talk()}
		>
			<IconHandshake class="size-4" aria-hidden="true" />
			<span dir="auto">{m.falklands_action_talk()}</span>
			<span class="text-[0.65rem] tabular-nums sm:text-xs">
				{m.falklands_hud_talks({ count: game.talks, target: DIPLOMACY_TARGET })}
			</span>
		</button>
		<button
			type="button"
			class="btn-chunky flex-col gap-0.5 px-2 py-2 text-xs leading-tight disabled:opacity-50 sm:text-sm"
			disabled={!playing || !game.dealReady}
			onclick={() => game.deal()}
		>
			<span dir="auto">{m.falklands_action_deal()}</span>
			<span class="text-[0.65rem] tabular-nums sm:text-xs">
				{m.falklands_hud_talks({ count: game.talks, target: DIPLOMACY_TARGET })}
			</span>
		</button>
		<button
			type="button"
			class="btn-chunky flex-col gap-0.5 px-2 py-2 text-xs leading-tight disabled:opacity-50 sm:text-sm"
			disabled={!playing || game.hull >= MAX_HULL}
			onclick={() => game.repair()}
		>
			<IconWrench class="size-4" aria-hidden="true" />
			<span dir="auto">{m.falklands_action_repair()}</span>
			<span class="text-[0.65rem] tabular-nums sm:text-xs">
				{m.falklands_repair_summary({ hull: REPAIR_HULL })}
			</span>
		</button>
	</div>

	<!-- What the last day did -->
	<p
		dir="auto"
		class="min-h-9 rounded-md border-2 border-ink bg-paper px-2 py-1 text-xs leading-snug font-semibold sm:text-sm"
		aria-live="polite"
	>
		{game.note?.text ?? m.falklands_note_idle()}
	</p>

	{#if game.status === 'ready'}
		<div
			class="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-ink/35 p-4"
		>
			<div
				class="sticker pop-in flex w-full max-w-xs flex-col items-center gap-3 p-4 text-center"
				style:--tilt="-1.5deg"
			>
				<p dir="auto" class="text-sm leading-snug font-semibold">{m.falklands_ready_hint()}</p>
				{#if game.best !== null}
					<p class="text-sm font-semibold">{m.falklands_best({ score: game.best })}</p>
				{/if}
				<button type="button" class="btn-chunky bg-tie-red text-xl" onclick={() => game.start()}>
					<IconPlay class="size-5" aria-hidden="true" />
					{m.falklands_start()}
				</button>
			</div>
		</div>
	{/if}
</div>
