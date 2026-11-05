<!--
	Other players' bases on the sea chart, when the game runs in Telegram. Each sits on a buoy close to
	your home bay with the commander's photo (or initial) and what a raid would take; the ones who
	raided you lately wear a red revenge flag. Tapping one opens a small card with the loot and the
	attack button. The raid notice above the log says what others took from you while you were away.
-->
<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import type { BeachheadGame } from '#lib/stores/beachheadGame.svelte.js';
	import type { BeachheadRival } from '#lib/services/rivals.js';
	import BeachheadSheet from './BeachheadSheet.svelte';
	import ResourceIcon from './ResourceIcon.svelte';
	import IconSwords from '~icons/lucide/swords';
	import IconFlame from '~icons/lucide/flame';

	let { game }: { game: BeachheadGame } = $props();

	/** Free water within the radar's first sweep around the home bay */
	const RIVAL_SPOTS = [
		{ x: 39, y: 54 },
		{ x: 61, y: 61 },
		{ x: 50, y: 43 },
		{ x: 56, y: 77 },
		{ x: 66, y: 50 },
		{ x: 34, y: 64 }
	] as const;

	let chosen = $state<BeachheadRival | null>(null);
	let busy = $state(false);

	async function attack() {
		if (!chosen || busy) return;
		busy = true;
		const ok = await game.attackRival(chosen.id);
		busy = false;
		if (ok) chosen = null;
	}

	const errorText = $derived(
		game.rivalError === 'COOLDOWN'
			? m.beachhead_rival_cooldown()
			: game.rivalError === 'SHIELDED'
				? m.beachhead_rival_shielded()
				: game.rivalError === null
					? null
					: m.beachhead_rival_failed()
	);
</script>

{#each game.rivals.slice(0, RIVAL_SPOTS.length) as rival, index (rival.id)}
	{@const spot = RIVAL_SPOTS[index]}
	<button
		type="button"
		class="rival absolute z-30 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
		style:left="{spot.x}%"
		style:top="{spot.y}%"
		aria-label={m.beachhead_rival_aria({ player: rival.name, level: rival.level })}
		title={rival.name}
		onclick={() => {
			game.rivalError = null;
			chosen = rival;
		}}
	>
		<span
			class="relative flex size-11 items-center justify-center overflow-hidden rounded-full border-3 border-ink bg-tie-red font-display text-lg font-bold text-paper shadow-[2px_2px_0_var(--color-ink)]"
		>
			{#if rival.photoUrl}
				<img
					src={rival.photoUrl}
					alt=""
					class="size-full object-cover"
					referrerpolicy="no-referrer"
				/>
			{:else}
				{rival.name.charAt(0).toUpperCase()}
			{/if}
		</span>
		{#if rival.revenge}
			<span
				class="absolute -end-2 -top-1 flex size-5 items-center justify-center rounded-full border-2 border-ink bg-explosion-yellow"
				aria-hidden="true"
			>
				<IconFlame class="size-3 text-tie-red" />
			</span>
		{/if}
		<span
			dir="auto"
			class="-mt-1 max-w-[7rem] truncate rounded-full border-2 border-ink bg-paper px-1.5 text-[0.65rem] leading-tight font-bold"
		>
			{rival.name} · {rival.level}
		</span>
	</button>
{/each}

<BeachheadSheet
	open={chosen !== null}
	title={chosen?.name ?? ''}
	narrow
	onclose={() => (chosen = null)}
>
	{#if chosen}
		<div class="flex flex-col gap-3">
			<p class="text-sm font-semibold">
				{chosen.revenge ? m.beachhead_rival_revenge() : m.beachhead_rival_intro()}
				· {m.beachhead_rival_level({ level: chosen.level })}
			</p>
			<p class="text-xs font-bold tracking-wide uppercase opacity-80">{m.beachhead_rival_loot()}</p>
			<ul class="grid grid-cols-4 gap-2">
				{#each ['wood', 'stone', 'iron', 'gold'] as const as kind (kind)}
					<li class="flex flex-col items-center gap-0.5 text-sm font-bold tabular-nums">
						<ResourceIcon {kind} class="size-7" />
						{chosen.loot[kind]}
					</li>
				{/each}
			</ul>
			{#if errorText}
				<p class="text-sm font-bold text-tie-red" role="alert">{errorText}</p>
			{/if}
			<button
				type="button"
				class="btn-chunky flex items-center justify-center gap-2 bg-tie-red py-2 text-paper"
				disabled={busy}
				onclick={attack}
			>
				<IconSwords class="size-5" aria-hidden="true" />
				{m.beachhead_rival_attack()}
			</button>
		</div>
	{/if}
</BeachheadSheet>

<style>
	.rival {
		transition: scale 160ms ease;
	}

	.rival:hover,
	.rival:focus-visible {
		scale: 1.08;
	}

	@media (prefers-reduced-motion: reduce) {
		.rival {
			transition: none;
		}
	}
</style>
