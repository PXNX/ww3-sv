<script lang="ts">
	import { onMount } from 'svelte';
	import GameShell from '#lib/components/GameShell.svelte';
	import RaidCanvas from '#lib/components/RaidCanvas.svelte';
	import RaidItemIcon from '#lib/components/RaidItemIcon.svelte';
	import RaidLobby from '#lib/components/RaidLobby.svelte';
	import RaidResults from '#lib/components/RaidResults.svelte';
	import RaidSkillIcon from '#lib/components/RaidSkillIcon.svelte';
	import InteractiveTutorial from '#lib/components/InteractiveTutorial.svelte';
	import {
		PERK_HINTS,
		PERK_NAMES,
		SKILL_HINTS,
		SKILL_NAMES,
		WEAPON_NAMES,
		WEAPON_TRAITS
	} from '#lib/components/raidText.js';
	import { enterLandscape } from '#lib/game/landscape.js';
	import { prefersReducedMotion } from '#lib/game/loop.js';
	import {
		ARMOR_PERKS,
		WEAPON_KINDS,
		WEAPONS,
		type MapId,
		type RaidMode
	} from '#lib/game/raid/config.js';
	import RotateHint from '#lib/components/RotateHint.svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { firstPlay } from '#lib/services/tutorial.js';
	import { RaidGame } from '#lib/stores/raidGame.svelte.js';
	import IconHelp from '~icons/lucide/circle-help';
	import IconZap from '~icons/lucide/zap';
	import { tutorialSteps } from './tutorial.js';

	const game = new RaidGame({ reducedMotion: prefersReducedMotion() });
	const modeName = m.mode_raid_name();

	let showTutorial = $state(false);

	onMount(() => {
		game.load();
		// Development only: lets a browser console (or a screenshot script) poke at the raid
		if (import.meta.env.DEV) Object.assign(window, { raidGame: game });
		showTutorial = firstPlay('raid');
	});

	/** A battlefield was tapped: the tap also lets the phone go full screen and sideways */
	function start(map: MapId = game.map, mode: RaidMode = game.mode) {
		void enterLandscape();
		game.start(map, mode);
	}

	/** The lobby is played sideways too; the first tap in it asks for full screen and landscape */
	let askedLandscape = false;
	function askLandscape() {
		if (askedLandscape) return;
		askedLandscape = true;
		void enterLandscape();
	}

	function openHelp() {
		game.pause();
		showTutorial = true;
	}

	const inRaid = $derived(game.status !== 'lobby');
	const result = $derived(game.result);
</script>

<svelte:window onpointerdown={askLandscape} />

<GameShell
	title={modeName}
	// While in raid mode the whole header (back link and the help button) stays out of the
	// floating hud so it never sits on top of the RaidCanvas overlays. Raids keep no high score.
	wide
	immersive
	landscape
	confirmLeave={game.status === 'playing' || game.status === 'paused' || game.status === 'down'}
	back={!inRaid}
>
	{#snippet actions()}
		{#if !inRaid}
			<button
				type="button"
				class="btn-chunky px-2 py-1 text-sm sm:px-3"
				aria-label={m.raid_help_button()}
				onclick={openHelp}
			>
				<IconHelp class="size-4" aria-hidden="true" />
				<span class="hidden sm:inline">{m.raid_help_button()}</span>
			</button>
		{/if}
		{#if game.status === 'playing' || game.status === 'paused'}
			<!-- Opens the leave screen: the big map, the haul so far and the quests -->
			<button
				type="button"
				class="flex h-9 w-12 -skew-x-6 items-center justify-center rounded-md border-b-4 border-[#0f7f73] bg-[#22c3b0] text-white shadow-[0_2px_0_rgb(0_0_0/0.25)] active:translate-y-0.5"
				aria-label={m.raid_leave_button()}
				title={m.raid_leave_button()}
				onclick={() => game.pause()}
			>
				<IconZap class="size-5 fill-white" aria-hidden="true" />
			</button>
		{/if}
	{/snippet}

	{#if inRaid}
		<div data-tutorial="playfield" class="relative flex h-full min-h-0 flex-1 flex-col">
			<RaidCanvas {game} />
		</div>
	{:else}
		<!-- The lobby scrolls under the floating header -->
		<div
			data-tutorial="playfield"
			class="absolute inset-0 overflow-y-auto bg-[radial-gradient(ellipse_at_30%_15%,#6a4bf0,#3b23a8_50%,#1c0f5e)] ps-[calc(0.75rem+env(safe-area-inset-left))] pe-[calc(0.75rem+env(safe-area-inset-right))] pt-[calc(var(--hud-top)+0.5rem)] pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
		>
			<RaidLobby {game} onStart={start} />
		</div>
	{/if}
	<!-- The raid, its lobby and its results are only shown sideways; upright, the game is paused -->
	<RotateHint
		title={m.raid_rotate_title()}
		body={m.raid_rotate_body()}
		onportrait={(upright) => upright && game.status === 'playing' && game.pause()}
	/>

	<InteractiveTutorial
		open={showTutorial}
		title={m.raid_tutorial_title()}
		steps={tutorialSteps}
		closeLabel={m.raid_tutorial_close()}
		onclose={() => (showTutorial = false)}
	/>

	{#if game.status === 'over' && result}
		<RaidResults
			{result}
			isNewBest={game.isNewBest}
			{modeName}
			drawBoard={game.drawBoard}
			reducedMotion={game.reducedMotion}
			onRetry={() => start()}
			onClose={() => game.backToLobby()}
		/>
	{/if}
</GameShell>

<style>
	:global(.rotate-hint) {
		animation: rotate-hint 1.6s ease-in-out infinite;
	}

	@keyframes rotate-hint {
		0%,
		30% {
			rotate: 0deg;
		}
		60%,
		100% {
			rotate: -90deg;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		:global(.rotate-hint) {
			animation: none;
		}
	}
</style>
