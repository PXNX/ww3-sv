<!--
	Bureaucracy Maze (roadmap 3.10): a top-down maze of offices. Find the counter with Passierschein
	B-38, collect the stamps and forms that open locked doors and turn around at offices that are
	closed until Tuesday. There is no timer and there are no lives, so nothing can be lost; the
	score is the number of steps, fewer is better.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import GameShell from '#lib/components/GameShell.svelte';
	import MazeBoard from '#lib/components/MazeBoard.svelte';
	import MazeDpad from '#lib/components/MazeDpad.svelte';
	import MazeItemIcon from '#lib/components/MazeItemIcon.svelte';
	import { ITEM_NAMES } from '#lib/components/mazeItems.js';
	import MazeSizePicker from '#lib/components/MazeSizePicker.svelte';
	import MazeWinPanel from '#lib/components/MazeWinPanel.svelte';
	import TutorialModal from '#lib/components/TutorialModal.svelte';
	import type { SizeId } from '#lib/game/maze/difficulty.js';
	import { drawMazeBoard } from '#lib/game/maze/drawBoard.js';
	import { ITEM_KINDS } from '#lib/game/maze/maze.js';
	import { prefersReducedMotion } from '#lib/game/loop.js';
	import { m } from '#lib/paraglide/messages.js';
	import { firstPlay } from '#lib/services/tutorial.js';
	import { MazeGame } from '#lib/stores/mazeGame.svelte.js';
	import IconHelp from '~icons/lucide/circle-help';
	import IconList from '~icons/lucide/list';
	import IconRotate from '~icons/lucide/rotate-ccw';

	const game = new MazeGame();
	const reducedMotion = prefersReducedMotion();
	const modeName = m.mode_maze_name();

	// The how-to-play screen opens on the first visit and whenever the help button is tapped
	let showTutorial = $state(false);
	onMount(() => {
		showTutorial = firstPlay('maze');
	});

	// The win panel waits a moment so the last step can be seen
	let showWin = $state(false);
	$effect(() => {
		if (!game.won) {
			showWin = false;
			return;
		}
		const timer = setTimeout(() => (showWin = true), reducedMotion ? 200 : 700);
		return () => clearTimeout(timer);
	});

	const sizeName: Record<SizeId, () => string> = {
		small: m.maze_size_small,
		medium: m.maze_size_medium,
		large: m.maze_size_large
	};

	const playing = $derived(game.screen === 'play');
	const title = $derived(playing ? `${modeName} · ${sizeName[game.size]()}` : modeName);
	/** The documents this maze hides, in a fixed order, found or not */
	const slots = $derived(
		[...game.needed]
			.sort((a, b) => ITEM_KINDS.indexOf(a) - ITEM_KINDS.indexOf(b))
			.map((kind) => ({ kind, found: game.collected.includes(kind) }))
	);
	const notice = $derived.by(() => {
		const current = game.notice;
		if (!current) return m.maze_notice_idle();
		switch (current.kind) {
			case 'pickup':
				return m.maze_notice_pickup({ item: ITEM_NAMES[current.item]() });
			case 'locked':
				return m.maze_notice_locked({ item: ITEM_NAMES[current.item]() });
			case 'closed':
				return m.maze_notice_closed();
			default:
				return m.maze_notice_wall();
		}
	});
</script>

<GameShell {title}>
	{#snippet actions()}
		<button
			type="button"
			class="btn-chunky px-2 py-1 text-sm sm:px-3"
			aria-label={m.maze_help_button()}
			onclick={() => (showTutorial = true)}
		>
			<IconHelp class="size-4" aria-hidden="true" />
			<span class="hidden sm:inline">{m.maze_help_button()}</span>
		</button>
	{/snippet}

	{#if playing}
		<!-- The HUD, the maze and the buttons share one width, as wide as the height allows -->
		<section
			class="mx-auto flex w-full flex-col items-center gap-2"
			style:max-width="max(16rem, min(100%, calc((100dvh - 24rem) * {game.maze.width /
				game.maze.height})))"
		>
			<div
				class="flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-[12px_6px_14px_8px] border-3 border-ink bg-paper px-3 py-1.5 shadow-[3px_3px_0_var(--color-ink)]"
			>
				<p role="status" class="flex items-baseline gap-3 font-display font-bold tabular-nums">
					<span class="text-2xl leading-none">{m.maze_steps_count({ steps: game.steps })}</span>
					{#if game.best !== null}
						<span class="text-sm">{m.maze_best_steps({ steps: game.best })}</span>
					{/if}
				</p>
				<ul class="flex items-center gap-1" aria-label={m.maze_inventory_title()}>
					{#each slots as slot (slot.kind)}
						<li
							class="flex size-8 items-center justify-center"
							aria-label={slot.found
								? m.maze_slot_found({ item: ITEM_NAMES[slot.kind]() })
								: m.maze_slot_missing()}
							title={slot.found ? ITEM_NAMES[slot.kind]() : m.maze_slot_missing()}
						>
							<MazeItemIcon
								kind={slot.kind}
								class="size-7 {slot.found ? '' : 'opacity-25 grayscale'}"
							/>
						</li>
					{/each}
				</ul>
			</div>

			<MazeBoard {game} disabled={showTutorial || showWin} />

			<p class="min-h-10 text-center text-sm font-bold" role="status" aria-live="polite">
				{#key game.noticeCount}
					<span class="pop-in inline-block">{notice}</span>
				{/key}
			</p>

			<div class="pointer-fine:hidden">
				<MazeDpad onmove={(direction) => game.move(direction)} disabled={game.won} />
			</div>

			<div class="flex flex-wrap items-center justify-center gap-2">
				<button
					type="button"
					class="btn-chunky px-3 py-1 text-sm"
					disabled={game.steps === 0 && !game.won}
					onclick={() => game.restart()}
				>
					<IconRotate class="size-4" aria-hidden="true" />
					{m.maze_restart()}
				</button>
				<button
					type="button"
					class="btn-chunky px-3 py-1 text-sm"
					onclick={() => game.backToSelect()}
				>
					<IconList class="size-4" aria-hidden="true" />
					{m.maze_back_to_sizes()}
				</button>
			</div>
		</section>
	{:else}
		<MazeSizePicker {game} />
	{/if}

	<TutorialModal
		open={showTutorial}
		title={m.maze_tutorial_title()}
		closeLabel={m.maze_tutorial_close()}
		onclose={() => (showTutorial = false)}
	>
		<p>{m.maze_tutorial_goal()}</p>
		<p>{m.maze_tutorial_move()}</p>
		<p>{m.maze_tutorial_doors()}</p>
		<p>{m.maze_tutorial_closed()}</p>
		<p>{m.maze_tutorial_steps()}</p>
		<p class="hidden text-sm sm:block">{m.maze_keyboard_hint()}</p>
	</TutorialModal>
</GameShell>

<MazeWinPanel
	open={showWin}
	stars={game.stars}
	steps={game.steps}
	par={game.par}
	best={game.best}
	isNewBest={game.isNewBest}
	{modeName}
	drawBoard={(context, x, y, size) =>
		drawMazeBoard(game.maze, game.play.visited, context, x, y, size)}
	onNew={() => game.again()}
	onRetry={() => game.restart()}
	onSizes={() => game.backToSelect()}
/>
