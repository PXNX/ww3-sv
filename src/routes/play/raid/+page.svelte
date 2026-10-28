<script lang="ts">
	import { onMount } from 'svelte';
	import GameShell from '#lib/components/GameShell.svelte';
	import RaidCanvas from '#lib/components/RaidCanvas.svelte';
	import RaidItemIcon from '#lib/components/RaidItemIcon.svelte';
	import RaidLobby from '#lib/components/RaidLobby.svelte';
	import RaidResults from '#lib/components/RaidResults.svelte';
	import RaidSkillIcon from '#lib/components/RaidSkillIcon.svelte';
	import TutorialModal from '#lib/components/TutorialModal.svelte';
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
	import { m } from '#lib/paraglide/messages.js';
	import { firstPlay } from '#lib/services/tutorial.js';
	import { RaidGame } from '#lib/stores/raidGame.svelte.js';
	import IconHelp from '~icons/lucide/circle-help';
	import IconZap from '~icons/lucide/zap';
	import IconRotate from '~icons/lucide/smartphone';

	const game = new RaidGame({ reducedMotion: prefersReducedMotion() });
	const modeName = m.mode_raid_name();

	let showTutorial = $state(false);
	let portrait = $state(false);
	let rotateDismissed = $state(false);

	onMount(() => {
		game.load();
		// Development only: lets a browser console (or a screenshot script) poke at the raid
		if (import.meta.env.DEV) Object.assign(window, { raidGame: game });
		showTutorial = firstPlay('raid');
		const query = matchMedia('(orientation: portrait)');
		const update = () => (portrait = query.matches);
		update();
		query.addEventListener('change', update);
		return () => query.removeEventListener('change', update);
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
	// While in raid mode the whole header (back link, score and the help button) stays out
	// of the floating hud so it never sits on top of the RaidCanvas overlays.
	score={inRaid ? undefined : game.score}
	best={game.best}
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
		<div class="relative flex h-full min-h-0 flex-1 flex-col">
			<RaidCanvas {game} />
		</div>
	{:else}
		<!-- The lobby scrolls under the floating header -->
		<div
			class="absolute inset-0 overflow-y-auto bg-[radial-gradient(ellipse_at_30%_15%,#6a4bf0,#3b23a8_50%,#1c0f5e)] ps-[calc(0.75rem+env(safe-area-inset-left))] pe-[calc(0.75rem+env(safe-area-inset-right))] pt-[calc(var(--hud-top)+0.5rem)] pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
		>
			<RaidLobby {game} onStart={start} />
		</div>
	{/if}
	{#if portrait && !rotateDismissed && game.status !== 'over'}
		<div
			class="fixed inset-0 z-30 flex items-center justify-center bg-banner-slate p-4"
			role="dialog"
			aria-modal="true"
			aria-labelledby="raid-rotate-title"
		>
			<div class="sticker flex max-w-xs flex-col items-center gap-3 p-5 text-center">
				<IconRotate class="rotate-hint size-14" aria-hidden="true" />
				<h2 id="raid-rotate-title" dir="auto" class="font-display text-2xl font-bold">
					{m.raid_rotate_title()}
				</h2>
				<p dir="auto" class="text-sm">{m.raid_rotate_body()}</p>
				<button type="button" class="btn-chunky text-sm" onclick={() => (rotateDismissed = true)}>
					{m.raid_rotate_dismiss()}
				</button>
			</div>
		</div>
	{/if}

	<TutorialModal
		open={showTutorial}
		title={m.raid_tutorial_title()}
		closeLabel={m.raid_tutorial_close()}
		onclose={() => (showTutorial = false)}
	>
		<p>{m.raid_tutorial_goal()}</p>
		<p>{m.raid_tutorial_controls()}</p>
		<p>{m.raid_tutorial_sprint()}</p>
		<p>{m.raid_tutorial_weapons()}</p>
		<ul class="flex flex-col gap-3">
			{#each WEAPON_KINDS as kind (kind)}
				<li class="flex flex-col gap-1">
					<span class="flex items-center gap-2">
						<RaidItemIcon {kind} rarity="common" class="size-10 shrink-0" />
						<span><strong>{WEAPON_NAMES[kind]()}</strong> {WEAPON_TRAITS[kind]()}</span>
					</span>
					{#each WEAPONS[kind].skills as skill (skill)}
						<span class="flex items-center gap-2 ps-12 text-sm">
							<RaidSkillIcon {skill} class="size-5 shrink-0" />
							<span><strong>{SKILL_NAMES[skill]()}:</strong> {SKILL_HINTS[skill]()}</span>
						</span>
					{/each}
				</li>
			{/each}
		</ul>
		<p>{m.raid_tutorial_variants()}</p>
		<p>{m.raid_tutorial_enemies()}</p>
		<p>{m.raid_tutorial_loot()}</p>
		<ul class="flex flex-col gap-1 text-sm">
			{#each ARMOR_PERKS as perk (perk)}
				<li><strong>{PERK_NAMES[perk]()}:</strong> {PERK_HINTS[perk]()}</li>
			{/each}
		</ul>
		<p>{m.raid_tutorial_crystals()}</p>
		<p>{m.raid_tutorial_season()}</p>
		<p>{m.raid_tutorial_quests()}</p>
		<p>{m.raid_tutorial_events()}</p>
		<p>{m.raid_tutorial_revive()}</p>
		<p class="hidden text-sm sm:block">{m.raid_keyboard_hint()}</p>
	</TutorialModal>

	{#if game.status === 'over' && result}
		<RaidResults
			{result}
			score={game.score}
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
