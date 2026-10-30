<!--
	Chip Fab Rush (roadmap 3.13): every level has two stages. Stage A stacks a silicon wafer layer by
	layer, Stage B merges the memory modules that wafer yields (4 GB, 8 GB, 16 GB and up). The
	shortage meter keeps rising; big modules push it down, and when it is full a heart is lost.
	Jensen Huang of Novideo, the tech boss in the leather jacket, cheers, waits or sulks along the way.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import ChipFabField from '#lib/components/ChipFabField.svelte';
	import ChipFabJacket from '#lib/components/ChipFabJacket.svelte';
	import GameOverModal from '#lib/components/GameOverModal.svelte';
	import GameShell from '#lib/components/GameShell.svelte';
	import LivesBar from '#lib/components/LivesBar.svelte';
	import TutorialModal from '#lib/components/TutorialModal.svelte';
	import { STARTING_LIVES } from '#lib/game/chipfab/config.js';
	import {
		CHEER_TIER,
		SULK_SHORTAGE,
		jacketFile,
		type JacketPose
	} from '#lib/game/chipfab/jacket.js';
	import { formatPrice, gpuPrice, modulePrice } from '#lib/game/chipfab/price.js';
	import { moduleLabel } from '#lib/game/chipfab/ram.js';
	import { prefersReducedMotion } from '#lib/game/loop.js';
	import type { Direction } from '#lib/game/merge/mergeBoard.js';
	import { m } from '#lib/paraglide/messages.js';
	import { firstPlay } from '#lib/services/tutorial.js';
	import { ChipFabGame } from '#lib/stores/chipfabGame.svelte.js';
	import { cameoAsset } from '#lib/theme/cameos.js';
	import IconDown from '~icons/lucide/arrow-down';
	import IconHelp from '~icons/lucide/circle-help';
	import IconLeft from '~icons/lucide/arrow-left';
	import IconPause from '~icons/lucide/pause';
	import IconPlay from '~icons/lucide/play';
	import IconRight from '~icons/lucide/arrow-right';
	import IconUp from '~icons/lucide/arrow-up';

	const game = new ChipFabGame({ reducedMotion: prefersReducedMotion() });
	const modeName = m.mode_chipfab_name();

	// The how-to-play screen opens on the first visit and whenever the help button is tapped
	let showTutorial = $state(false);
	onMount(() => {
		game.loadBest();
		showTutorial = firstPlay('chipfab');
	});

	function openHelp() {
		game.pause();
		showTutorial = true;
	}

	const captions: Record<JacketPose, () => string> = {
		cheers: m.chipfab_jacket_cheers,
		neutral: m.chipfab_jacket_neutral,
		sulks: m.chipfab_jacket_sulks
	};
	const alts: Record<JacketPose, () => string> = {
		cheers: m.chipfab_jacket_alt_cheers,
		neutral: m.chipfab_jacket_alt_neutral,
		sulks: m.chipfab_jacket_alt_sulks
	};

	// Game over: Jensen Huang cheers if the run made a big module, otherwise he sulks
	const cameo = $derived.by(() => {
		const pose: JacketPose = game.topTier >= CHEER_TIER ? 'cheers' : 'sulks';
		return {
			image: cameoAsset(jacketFile(pose)),
			alt: alts[pose](),
			message:
				pose === 'cheers'
					? m.chipfab_cameo_message_cheers()
					: game.sulkVariant === 0
						? m.chipfab_cameo_message_sulk()
						: m.chipfab_cameo_message_sulk_2(),
			label: m.chipfab_jacket_name()
		};
	});

	const alarming = $derived(game.shortage >= SULK_SHORTAGE);
	// Street prices climb with the shortage; the top module is priced per tier
	const gpu = $derived(formatPrice(gpuPrice(game.level, game.shortage)));
	const topPrice = $derived(
		game.topTier > 0 ? formatPrice(modulePrice(game.topTier, game.shortage)) : '-'
	);

	const pad: { direction: Direction; label: () => string; icon: typeof IconLeft }[] = [
		{ direction: 'left', label: m.chipfab_move_left, icon: IconLeft },
		{ direction: 'up', label: m.chipfab_move_up, icon: IconUp },
		{ direction: 'down', label: m.chipfab_move_down, icon: IconDown },
		{ direction: 'right', label: m.chipfab_move_right, icon: IconRight }
	];
</script>

<GameShell
	title={modeName}
	score={game.score}
	best={game.best}
	confirmLeave={game.status === 'playing' || game.status === 'paused'}
>
	{#snippet actions()}
		<button
			type="button"
			class="btn-chunky px-2 py-1 text-sm sm:px-3"
			aria-label={m.chipfab_help_button()}
			onclick={openHelp}
		>
			<IconHelp class="size-4" aria-hidden="true" />
			<span class="hidden sm:inline">{m.chipfab_help_button()}</span>
		</button>
		{#if game.status === 'playing' || game.status === 'paused'}
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

	<!-- The HUD and the playfield share one width, as wide as the height allows -->
	<section
		class="mx-auto flex w-full flex-col items-center gap-2"
		style:max-width="max(17rem, min(100%, calc((100dvh - 22rem) * 0.714)))"
	>
		<div
			class="flex w-full gap-3 rounded-[12px_6px_14px_8px] border-3 border-ink bg-paper px-3 py-2 shadow-[3px_3px_0_var(--color-ink)]"
		>
			<ChipFabJacket pose={game.pose} class="size-16 shrink-0 self-center sm:size-20" />
			<div class="flex min-w-0 flex-1 flex-col gap-1">
				<div class="flex items-center justify-between gap-3">
					<p dir="auto" class="font-display text-base font-bold sm:text-lg">
						{m.chipfab_hud_level({ level: game.level })}
						<span class="text-xs font-semibold sm:text-sm">
							{game.stage === 'stack' ? m.chipfab_hud_stage_stack() : m.chipfab_hud_stage_merge()}
						</span>
					</p>
					<LivesBar lives={game.lives} max={STARTING_LIVES} class="shrink-0 text-xl" />
				</div>
				<div class="flex items-center gap-2">
					<div
						class="h-3 flex-1 overflow-hidden rounded-full border-2 border-ink bg-sand"
						role="progressbar"
						aria-label={m.chipfab_shortage_label()}
						aria-valuemin={0}
						aria-valuemax={100}
						aria-valuenow={game.shortage}
					>
						<div
							class="h-full transition-[width]"
							class:bg-mustard={!alarming}
							class:bg-tie-red={alarming}
							style:width="{game.shortage}%"
						></div>
					</div>
					<p
						dir="auto"
						class="w-24 shrink-0 text-end font-display text-xs font-bold tabular-nums"
						class:text-tie-red={alarming}
					>
						{m.chipfab_hud_shortage({ percent: game.shortage })}
					</p>
				</div>
				<p dir="auto" class="font-display text-xs font-bold tabular-nums">
					{#if game.stage === 'stack'}
						{m.chipfab_hud_layers({ layers: game.layers, target: game.layersTarget })}
					{:else}
						{m.chipfab_hud_supply({ count: game.supply })}
					{/if}
					<span class="font-semibold">
						· {m.chipfab_hud_top({ size: game.topTier > 0 ? moduleLabel(game.topTier) : '-' })}
					</span>
				</p>
				<p dir="auto" class="font-display text-xs font-bold tabular-nums">
					{m.chipfab_hud_prices({ ram: topPrice, gpu })}
				</p>
				<p dir="auto" class="truncate font-display text-xs font-semibold italic" aria-live="off">
					{captions[game.pose]()}
				</p>
			</div>
		</div>

		<ChipFabField {game} />

		{#if game.stage === 'stack'}
			<!-- layer drop handled by tap on field -->
		{:else}
			<div dir="ltr" class="grid w-full grid-cols-4 gap-2">
				{#each pad as item (item.direction)}
					<button
						type="button"
						class="btn-chunky justify-center bg-explosion-yellow px-2 py-1.5"
						aria-label={item.label()}
						disabled={game.status !== 'playing'}
						onclick={() => game.move(item.direction)}
					>
						<item.icon class="size-6" aria-hidden="true" />
					</button>
				{/each}
			</div>
		{/if}
	</section>

	<TutorialModal
		open={showTutorial}
		title={m.chipfab_tutorial_title()}
		closeLabel={m.chipfab_tutorial_close()}
		onclose={() => (showTutorial = false)}
	>
		<p>{m.chipfab_tutorial_goal()}</p>
		<p>{m.chipfab_tutorial_stack()}</p>
		<p>{m.chipfab_tutorial_merge()}</p>
		<p>{m.chipfab_tutorial_shortage()}</p>
		<p>{m.chipfab_tutorial_jacket()}</p>
		<p>{m.chipfab_tutorial_score()}</p>
	</TutorialModal>

	<GameOverModal
		open={game.status === 'over'}
		score={game.score}
		mode="chipfab"
		{modeName}
		isNewBest={game.isNewBest}
		title={m.chipfab_gameover_title()}
		customCameo={cameo}
		drawBoard={game.drawBoard}
		onRetry={() => game.start()}
	>
		<dl class="grid grid-cols-2 gap-2 font-display text-sm">
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="font-bold">{m.chipfab_stat_levels()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{game.levelsCleared}</dd>
			</div>
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="font-bold">{m.chipfab_stat_top()}</dt>
				<dd class="text-2xl font-bold tabular-nums">
					{game.topTier > 0 ? moduleLabel(game.topTier) : '-'}
				</dd>
			</div>
		</dl>
	</GameOverModal>
</GameShell>
