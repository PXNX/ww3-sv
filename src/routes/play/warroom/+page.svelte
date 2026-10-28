<!--
	War Room: a turn-based campaign in the spirit of the big map games. Owned regions pay
	resources, factories turn those resources into equipment, equipment trains divisions, and
	divisions take more regions. Every day the player gives each stack one order, then ends the
	day: industry runs, training advances, morale recovers and the Pact answers.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import GameOverModal from '#lib/components/GameOverModal.svelte';
	import GameShell from '#lib/components/GameShell.svelte';
	import TutorialModal from '#lib/components/TutorialModal.svelte';
	import WarRoomArmy from '#lib/components/WarRoomArmy.svelte';
	import WarRoomHud from '#lib/components/WarRoomHud.svelte';
	import WarRoomIndustry from '#lib/components/WarRoomIndustry.svelte';
	import WarRoomInspector from '#lib/components/WarRoomInspector.svelte';
	import WarRoomMap from '#lib/components/WarRoomMap.svelte';
	import WarRoomRecruit from '#lib/components/WarRoomRecruit.svelte';
	import { MAX_DAYS } from '#lib/game/warroom/config.js';
	import { m } from '#lib/paraglide/messages.js';
	import { firstPlay } from '#lib/services/tutorial.js';
	import { WarRoomGame } from '#lib/stores/warroomGame.svelte.js';
	import IconCircleHelp from '~icons/lucide/circle-help';
	import IconStepForward from '~icons/lucide/step-forward';

	const game = new WarRoomGame();
	const modeName = m.mode_warroom_name();

	type Tab = 'army' | 'industry' | 'recruit';
	let tab = $state<Tab>('army');
	let showTutorial = $state(false);

	onMount(() => {
		game.loadBest();
		showTutorial = firstPlay('warroom');
	});

	const tabs: { id: Tab; label: () => string }[] = [
		{ id: 'army', label: () => m.warroom_tab_army() },
		{ id: 'industry', label: () => m.warroom_tab_industry() },
		{ id: 'recruit', label: () => m.warroom_tab_recruit() }
	];

	const gameOverTitle = $derived(
		game.outcome === 'won'
			? m.warroom_gameover_won()
			: game.outcome === 'armistice'
				? m.warroom_gameover_armistice()
				: m.warroom_gameover_lost()
	);

	function onKey(event: KeyboardEvent) {
		if (showTutorial || game.status !== 'playing' || event.defaultPrevented) return;
		if (event.ctrlKey || event.metaKey || event.altKey) return;
		const target = event.target;
		if (
			target instanceof HTMLElement &&
			target.closest('input, select, textarea, [contenteditable]')
		) {
			return;
		}
		if (event.code === 'Digit1') tab = 'army';
		if (event.code === 'Digit2') tab = 'industry';
		if (event.code === 'Digit3') tab = 'recruit';
		if (event.code === 'KeyN') game.endTurn();
		if (event.code === 'Escape') game.clearSelection();
	}
</script>

<svelte:window onkeydown={onKey} />

<GameShell
	title={modeName}
	score={game.score}
	best={game.best}
	wide
	confirmLeave={game.status === 'playing'}
>
	{#snippet actions()}
		<button
			type="button"
			class="btn-chunky bg-explosion-yellow px-2 py-1 text-sm disabled:opacity-50 sm:px-3"
			disabled={game.status !== 'playing'}
			onclick={() => game.endTurn()}
		>
			<IconStepForward class="size-4" aria-hidden="true" />
			<span class="hidden sm:inline">{m.warroom_end_day()}</span>
			<span class="sm:hidden">{m.warroom_end_day_short()}</span>
		</button>
		<button
			type="button"
			class="btn-chunky px-2 py-1 text-sm sm:px-3"
			aria-label={m.warroom_help_button()}
			onclick={() => (showTutorial = true)}
		>
			<IconCircleHelp class="size-4" aria-hidden="true" />
			<span class="hidden sm:inline">{m.warroom_help_button()}</span>
		</button>
	{/snippet}

	<section class="mx-auto grid w-full max-w-6xl gap-2 pb-3">
		<WarRoomHud {game} />

		<div class="grid grid-cols-1 items-start gap-2 lg:grid-cols-[minmax(0,1fr)_21rem]">
			<div class="flex min-w-0 flex-col gap-2">
				<WarRoomMap {game} />

				<p
					dir="auto"
					class="min-h-9 rounded-md border-2 border-ink bg-paper px-2 py-1 text-xs leading-snug font-semibold sm:text-sm"
					aria-live="polite"
				>
					{game.note?.text ?? m.warroom_note_idle()}
				</p>

				<div role="tablist" aria-label={m.warroom_tabs_label()} class="grid grid-cols-3 gap-1.5">
					{#each tabs as entry (entry.id)}
						<button
							type="button"
							role="tab"
							id="warroom-tab-{entry.id}"
							aria-selected={tab === entry.id}
							aria-controls="warroom-panel-{entry.id}"
							class="btn-chunky justify-center px-1 py-1.5 text-center text-xs leading-tight sm:text-sm {tab ===
							entry.id
								? 'bg-explosion-yellow'
								: 'bg-paper'}"
							onclick={() => (tab = entry.id)}
						>
							<span dir="auto">{entry.label()}</span>
						</button>
					{/each}
				</div>

				<div
					role="tabpanel"
					id="warroom-panel-{tab}"
					aria-labelledby="warroom-tab-{tab}"
					class="flex flex-col gap-2"
				>
					{#if tab === 'army'}
						<WarRoomArmy {game} />
					{:else if tab === 'industry'}
						<WarRoomIndustry {game} />
					{:else}
						<WarRoomRecruit {game} />
					{/if}
				</div>
			</div>

			<div class="flex min-w-0 flex-col gap-2 lg:sticky lg:top-1">
				<WarRoomInspector {game} />
			</div>
		</div>
	</section>

	<TutorialModal
		open={showTutorial}
		title={m.warroom_tutorial_title()}
		closeLabel={m.warroom_tutorial_close()}
		onclose={() => (showTutorial = false)}
	>
		<p>{m.warroom_tutorial_goal({ days: MAX_DAYS })}</p>
		<p>{m.warroom_tutorial_map()}</p>
		<p>{m.warroom_tutorial_supply()}</p>
		<p>{m.warroom_tutorial_industry()}</p>
		<p>{m.warroom_tutorial_army()}</p>
		<p>{m.warroom_tutorial_combat()}</p>
		<p>{m.warroom_tutorial_keys()}</p>
	</TutorialModal>

	<GameOverModal
		open={game.status === 'over'}
		score={game.score}
		mode="warroom"
		{modeName}
		outcome={game.outcome === 'won' ? 'won' : 'lost'}
		isNewBest={game.isNewBest}
		title={gameOverTitle}
		drawBoard={game.drawBoard}
		onRetry={() => game.start()}
	>
		<dl class="grid grid-cols-2 gap-2 font-display text-sm sm:grid-cols-4">
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt dir="auto" class="text-center font-bold">{m.warroom_stat_days()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{Math.min(game.day, MAX_DAYS)}</dd>
			</div>
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt dir="auto" class="text-center font-bold">{m.warroom_stat_regions()}</dt>
				<dd class="text-2xl font-bold tabular-nums">
					{Object.values(game.owner).filter((owner) => owner === 'player').length}
				</dd>
			</div>
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt dir="auto" class="text-center font-bold">{m.warroom_stat_kills()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{game.state.kills}</dd>
			</div>
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt dir="auto" class="text-center font-bold">{m.warroom_stat_losses()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{game.state.losses}</dd>
			</div>
		</dl>
	</GameOverModal>
</GameShell>
