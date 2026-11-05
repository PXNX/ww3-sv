<script lang="ts">
	import { onMount } from 'svelte';
	import BeachheadCanvas from '#lib/components/BeachheadCanvas.svelte';
	import BeachheadIsland from '#lib/components/BeachheadIsland.svelte';
	import BeachheadMap from '#lib/components/BeachheadMap.svelte';
	import BeachheadWinPanel from '#lib/components/BeachheadWinPanel.svelte';
	import BeachheadLostPanel from '#lib/components/BeachheadLostPanel.svelte';
	import GameShell from '#lib/components/GameShell.svelte';
	import PauseOverlay from '#lib/components/PauseOverlay.svelte';
	import ResourceIcon from '#lib/components/ResourceIcon.svelte';
	import RotateHint from '#lib/components/RotateHint.svelte';
	import TutorialModal from '#lib/components/TutorialModal.svelte';
	import { buildingName, islandName } from '#lib/components/beachheadText.js';
	import type { SkillId } from '#lib/game/beachhead/config.js';
	import {
		fullscreenAvailable,
		isFullscreen,
		onFullscreenChange,
		toggleFullscreen
	} from '#lib/game/landscape.js';
	import { prefersReducedMotion } from '#lib/game/loop.js';
	import { m } from '#lib/paraglide/messages.js';
	import { firstPlay } from '#lib/services/tutorial.js';
	import { BeachheadGame } from '#lib/stores/beachheadGame.svelte.js';
	import IconBomb from '~icons/lucide/bomb';
	import IconCloud from '~icons/lucide/cloud';
	import IconCrown from '~icons/lucide/crown';
	import IconFastForward from '~icons/lucide/fast-forward';
	import IconTimer from '~icons/lucide/timer';
	import IconFlag from '~icons/lucide/flag-triangle-right';
	import IconCrosshair from '~icons/lucide/crosshair';
	import IconFlameKindling from '~icons/lucide/flame-kindling';
	import IconHeartPulse from '~icons/lucide/heart-pulse';
	import IconHelp from '~icons/lucide/circle-help';
	import IconList from '~icons/lucide/list';
	import IconMaximize from '~icons/lucide/maximize';
	import IconMinimize from '~icons/lucide/minimize';
	import IconPause from '~icons/lucide/pause';
	import IconPlay from '~icons/lucide/play';
	import IconRocket from '~icons/lucide/rocket';
	import IconRotate from '~icons/lucide/rotate-ccw';
	import IconShip from '~icons/lucide/ship';
	import IconUsers from '~icons/lucide/users';
	import IconZap from '~icons/lucide/zap';

	const game = new BeachheadGame({ reducedMotion: prefersReducedMotion() });
	const modeName = m.mode_beachhead_name();

	const SKILL_BUTTONS: readonly {
		id: SkillId;
		icon: typeof IconBomb;
		label: () => string;
	}[] = [
		{ id: 'flamingo', icon: IconRocket, label: () => m.beachhead_skill_flamingo() },
		{ id: 'barrage', icon: IconBomb, label: () => m.beachhead_skill_barrage() },
		{ id: 'flare', icon: IconFlameKindling, label: () => m.beachhead_skill_flare() },
		{ id: 'smoke', icon: IconCloud, label: () => m.beachhead_skill_smoke() },
		{ id: 'heal', icon: IconHeartPulse, label: () => m.beachhead_skill_heal() },
		{ id: 'emp', icon: IconZap, label: () => m.beachhead_skill_emp() }
	];

	let showTutorial = $state(false);
	let fullscreen = $state(false);
	let canFullscreen = $state(false);
	onMount(() => {
		game.load();
		// Raids on your base while you were away come off the stock right at the start
		void game.syncRivals();
		showTutorial = firstPlay('beachhead');
		canFullscreen = fullscreenAvailable();
		fullscreen = isFullscreen();
		return onFullscreenChange(() => (fullscreen = isFullscreen()));
	});

	async function toggleFullscreenMode() {
		fullscreen = await toggleFullscreen();
	}

	function openHelp() {
		game.pause();
		showTutorial = true;
	}

	const clockText = (ms: number): string => {
		const total = Math.ceil(ms / 1000);
		return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
	};

	const playing = $derived(game.screen === 'play');
	const running = $derived(game.status === 'playing' || game.status === 'paused');
	const title = $derived(
		playing
			? `${modeName} · ${
					game.testing
						? m.beachhead_test_title()
						: (game.rival?.name ?? islandName(game.islandIndex))
				}`
			: modeName
	);
	const lootTotal = $derived(
		game.lootCollected.wood +
			game.lootCollected.stone +
			game.lootCollected.iron +
			game.lootCollected.gold
	);
</script>

<GameShell
	{title}
	confirmLeave={playing && running}
	backTo={playing
		? () => (game.testing ? game.goBase() : game.goMap())
		: game.screen === 'map'
			? () => game.goBase()
			: undefined}
	immersive
	landscape
>
	{#snippet actions()}
		{#if game.screen === 'base'}
			<button
				type="button"
				class="btn-chunky px-2 py-1 text-sm"
				aria-label={m.beachhead_help_button()}
				title={m.beachhead_help_button()}
				onclick={openHelp}
			>
				<IconHelp class="size-4" aria-hidden="true" />
			</button>
		{/if}
		{#if playing && running}
			{#if game.status === 'playing' && !game.retreating}
				<button
					type="button"
					class="btn-chunky px-2 py-1 text-sm"
					aria-label={m.beachhead_give_up()}
					title={m.beachhead_give_up()}
					onclick={() => game.giveUp()}
				>
					<IconFlag class="size-4" aria-hidden="true" />
				</button>
			{/if}
			{#if canFullscreen}
				<button
					type="button"
					class="btn-chunky px-2 py-1 text-sm"
					aria-label={fullscreen ? m.beachhead_exit_fullscreen() : m.beachhead_fullscreen()}
					title={fullscreen ? m.beachhead_exit_fullscreen() : m.beachhead_fullscreen()}
					onclick={toggleFullscreenMode}
				>
					{#if fullscreen}
						<IconMinimize class="size-4" aria-hidden="true" />
					{:else}
						<IconMaximize class="size-4" aria-hidden="true" />
					{/if}
				</button>
			{/if}
			<button
				type="button"
				class="btn-chunky px-2 py-1 text-sm"
				aria-label={game.status === 'paused' ? m.game_resume() : m.game_pause()}
				title={game.status === 'paused' ? m.game_resume() : m.game_pause()}
				onclick={() => game.togglePause()}
			>
				{#if game.status === 'paused'}
					<IconPlay class="size-4" aria-hidden="true" />
				{:else}
					<IconPause class="size-4" aria-hidden="true" />
				{/if}
			</button>
		{:else if playing}
			<button
				type="button"
				class="btn-chunky px-2 py-1 text-sm"
				aria-label={m.beachhead_map_button()}
				title={m.beachhead_map_button()}
				onclick={() => game.goMap()}
			>
				<IconList class="size-4" aria-hidden="true" />
			</button>
		{/if}
	{/snippet}

	{#if playing}
		<!-- Played sideways: the island fills the screen and the HUD floats over it -->
		<div class="relative flex min-h-0 flex-1 flex-col">
			<BeachheadCanvas {game} />

			<div
				class="pointer-events-none absolute inset-x-0 top-[calc(var(--hud-top)+0.15rem)] z-30 flex flex-wrap items-start justify-center gap-1.5 px-2 font-display text-sm font-bold"
			>
				<span
					class="flex items-center gap-1 rounded-full border-2 border-ink px-2.5 py-0.5 tabular-nums {game.timeLeft <
					30_000
						? 'bg-tie-red text-paper'
						: 'bg-paper'}"
					title={m.beachhead_time_left({ time: clockText(game.timeLeft) })}
				>
					<IconTimer class="size-4" aria-hidden="true" />
					{clockText(game.timeLeft)}
				</span>
				<button
					type="button"
					class="pointer-events-auto flex items-center gap-1 rounded-full border-2 border-ink px-2.5 py-0.5 tabular-nums {game.speed >
					1
						? 'bg-explosion-yellow'
						: 'bg-paper'}"
					aria-label={m.beachhead_speed()}
					title={game.speedProHint ? m.beachhead_speed_pro() : m.beachhead_speed()}
					onclick={() => game.cycleSpeed()}
				>
					<IconFastForward class="size-4" aria-hidden="true" />
					{game.speed}x
					{#if game.speedProHint}
						<IconCrown class="size-3.5" aria-hidden="true" />
					{/if}
				</button>
				{#if game.speedProHint}
					<span
						class="pop-in rounded-full border-2 border-ink bg-explosion-yellow px-2.5 py-0.5 text-xs"
						role="status"
					>
						{m.beachhead_speed_pro()}
					</span>
				{/if}
			</div>

			<div
				class="pointer-events-none absolute bottom-[calc(3.5rem+env(safe-area-inset-bottom))] left-(--hud-left) z-30 flex flex-col items-start gap-1 font-display text-sm font-bold"
			>
				<span
					class="flex items-center gap-1 rounded-full border-2 border-ink bg-paper px-2.5 py-0.5 tabular-nums {game.squadsLeft ===
					0
						? 'opacity-50'
						: ''}"
					title={m.beachhead_squads({ count: game.squadsLeft })}
				>
					<IconShip class="size-4" aria-hidden="true" />
					{game.squadsLeft}
				</span>
				<span
					class="flex items-center gap-1 rounded-full border-2 border-ink bg-paper px-2.5 py-0.5 tabular-nums"
					title={m.beachhead_troops({ count: game.troops })}
				>
					<IconUsers class="size-4" aria-hidden="true" />
					{game.troops}
				</span>
				<span
					class="flex items-center gap-1 rounded-full border-2 border-ink bg-paper px-2.5 py-0.5 tabular-nums"
					title={m.beachhead_skill_energy({ energy: game.energy })}
				>
					<IconZap class="size-4" aria-hidden="true" />
					{game.energy}
				</span>
				{#if game.focusKind}
					<span
						class="flex items-center gap-1 rounded-full border-2 border-ink bg-explosion-yellow px-2.5 py-0.5"
						title={m.beachhead_focus({ building: buildingName(game.focusKind) })}
					>
						<IconCrosshair class="size-4" aria-hidden="true" />
					</span>
				{/if}
			</div>

			{#if lootTotal > 0}
				<ul
					class="pointer-events-none absolute top-(--hud-top) left-(--hud-left) z-30 flex flex-col gap-1"
				>
					{#each ['wood', 'stone', 'iron', 'gold'] as const as kind (kind)}
						{#if game.lootCollected[kind] > 0}
							<li
								class="pop-in flex items-center gap-1.5 rounded-full border-2 border-ink bg-paper py-0.5 ps-0.5 pe-2.5 font-display text-sm font-bold tabular-nums shadow-[2px_2px_0_var(--color-ink)]"
							>
								<ResourceIcon {kind} class="size-6" />
								+{game.lootCollected[kind]}
							</li>
						{/if}
					{/each}
				</ul>
			{/if}

			{#if game.status === 'playing'}
				<div
					class="pointer-events-none absolute inset-x-0 bottom-2 z-30 flex flex-col items-center gap-1 px-2"
				>
					<div class="flex flex-wrap justify-center gap-1.5">
						{#each SKILL_BUTTONS as skill (skill.id)}
							{@const SkillIcon = skill.icon}
							<button
								type="button"
								class="btn-chunky pointer-events-auto relative size-11 rounded-full p-0 disabled:cursor-not-allowed disabled:opacity-45"
								class:bg-explosion-yellow={game.selectedSkill === skill.id}
								disabled={!game.canUseSkill && game.selectedSkill !== skill.id}
								aria-pressed={game.selectedSkill === skill.id}
								aria-label={`${skill.label()} — ${m.beachhead_skill_cost({ cost: game.skillPrice })}`}
								title={`${skill.label()} — ${m.beachhead_skill_cost({ cost: game.skillPrice })}`}
								onclick={() => game.chooseSkill(skill.id)}
							>
								<SkillIcon class="mx-auto size-5" aria-hidden="true" />
								<span
									class="absolute -right-1 -bottom-1 rounded-full border-2 border-ink bg-paper px-1 text-[0.62rem] leading-4 font-bold tabular-nums"
								>
									{game.skillPrice}
								</span>
							</button>
						{/each}
					</div>
				</div>
			{/if}

			{#if game.status === 'paused'}
				<PauseOverlay onResume={() => game.resume()} cover>
					<button
						type="button"
						class="btn-chunky"
						aria-label={m.beachhead_retry()}
						title={m.beachhead_retry()}
						onclick={() => game.retry()}
					>
						<IconRotate class="size-5" aria-hidden="true" />
					</button>
					<button
						type="button"
						class="btn-chunky"
						aria-label={m.beachhead_to_map()}
						title={m.beachhead_to_map()}
						onclick={() => game.goMap()}
					>
						<IconList class="size-5" aria-hidden="true" />
					</button>
				</PauseOverlay>
			{/if}
		</div>
	{:else if game.screen === 'base'}
		<BeachheadIsland {game} />
	{:else}
		<BeachheadMap {game} />
	{/if}

	<!-- The whole mode is played sideways: held upright, a card covers every screen and the game waits -->
	<RotateHint onportrait={(portrait) => portrait && game.pause()} />

	<TutorialModal
		open={showTutorial}
		title={m.beachhead_tutorial_title()}
		closeLabel={m.beachhead_tutorial_close()}
		onclose={() => (showTutorial = false)}
	>
		<p>{m.beachhead_tutorial_goal()}</p>
		<p>{m.beachhead_tutorial_deploy()}</p>
		<p>{m.beachhead_tutorial_focus()}</p>
		<p>{m.beachhead_tutorial_skills()}</p>
		<p>{m.beachhead_tutorial_base()}</p>
	</TutorialModal>

	<BeachheadWinPanel
		open={game.status === 'won'}
		loot={game.loot}
		lost={game.lastCasualties}
		shards={game.heroCardsFound}
		crystal={game.crystalFound}
		seconds={game.lastSeconds}
		islandName={game.rival?.name ?? islandName(game.islandIndex)}
		newAchievements={game.newAchievements}
		onIslands={() => game.goMap()}
	/>

	<BeachheadLostPanel
		open={game.status === 'over'}
		lost={game.lastCasualties}
		seconds={game.lastSeconds}
		onRetry={() => game.retry()}
		onIslands={() => game.goMap()}
	/>
</GameShell>
