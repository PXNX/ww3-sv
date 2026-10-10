<!--
	Belt & Road: Fill Grid (roadmap 3.8): a flow-style puzzle. Drag from a port to draw its trade route,
	join every pair and leave no cell empty. There are no lives: the debt meter rises with every
	move and a star rating against par (one stroke per route) decides how well a level went.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import BeltRoadBoard from '#lib/components/BeltRoadBoard.svelte';
	import BeltRoadDebtMeter from '#lib/components/BeltRoadDebtMeter.svelte';
	import BeltRoadLevelSelect from '#lib/components/BeltRoadLevelSelect.svelte';
	import BeltRoadPortIcon from '#lib/components/BeltRoadPortIcon.svelte';
	import BeltRoadStars from '#lib/components/BeltRoadStars.svelte';
	import BeltRoadWinPanel from '#lib/components/BeltRoadWinPanel.svelte';
	import GameShell from '#lib/components/GameShell.svelte';
	import TutorialModal from '#lib/components/TutorialModal.svelte';
	import { type PortId } from '#lib/game/beltroad/board.js';
	import { portStyle } from '#lib/game/beltroad/ports.js';
	import { prefersReducedMotion } from '#lib/game/loop.js';
	import { m } from '#lib/paraglide/messages.js';
	import { firstPlay } from '#lib/services/tutorial.js';
	import { BeltRoadGame } from '#lib/stores/beltroadGame.svelte.js';
	import IconCheck from '~icons/lucide/check';
	import IconHelp from '~icons/lucide/circle-help';
	import IconList from '~icons/lucide/list';
	import IconRotate from '~icons/lucide/rotate-ccw';
	import IconUndo from '~icons/lucide/undo-2';

	const game = new BeltRoadGame();
	const reducedMotion = prefersReducedMotion();
	const modeName = m.mode_beltroad_name();

	// The how-to-play screen opens on the first visit and whenever the help button is tapped
	let showTutorial = $state(false);
	onMount(() => {
		game.load();
		showTutorial = firstPlay('beltroad');
	});

	// The win panel waits a moment so the last route can be seen
	let showWin = $state(false);
	$effect(() => {
		if (!game.won) {
			showWin = false;
			return;
		}
		const timer = setTimeout(() => (showWin = true), reducedMotion ? 200 : 700);
		return () => clearTimeout(timer);
	});

	const portName: Record<PortId, () => string> = {
		shanghai: m.beltroad_port_shanghai,
		piraeus: m.beltroad_port_piraeus,
		hamburg: m.beltroad_port_hamburg,
		rotterdam: m.beltroad_port_rotterdam,
		singapore: m.beltroad_port_singapore,
		mombasa: m.beltroad_port_mombasa,
		colombo: m.beltroad_port_colombo,
		trieste: m.beltroad_port_trieste,
		djibouti: m.beltroad_port_djibouti
	};

	const playing = $derived(game.screen === 'play');
	const title = $derived(
		playing ? `${modeName} · ${m.beltroad_level_label({ number: game.levelIndex + 1 })}` : modeName
	);
	const tierName = $derived(
		{
			easy: m.beltroad_tier_easy(),
			medium: m.beltroad_tier_medium(),
			hard: m.beltroad_tier_hard()
		}[game.level.tier]
	);

	/** Draws the filled grid into the share card */
	function drawBoard(context: CanvasRenderingContext2D, x: number, y: number, size: number) {
		const { width, height, pairs } = game.level;
		const cell = size / Math.max(width, height);
		const left = x + (size - cell * width) / 2;
		const top = y + (size - cell * height) / 2;
		context.fillStyle = '#f4efd8';
		context.fillRect(left, top, cell * width, cell * height);
		context.lineCap = 'round';
		context.lineJoin = 'round';
		game.paths.forEach((path, index) => {
			if (path.length < 2) return;
			const trace = () => {
				context.beginPath();
				path.forEach(([row, col], step) => {
					const px = left + (col + 0.5) * cell;
					const py = top + (row + 0.5) * cell;
					if (step === 0) context.moveTo(px, py);
					else context.lineTo(px, py);
				});
				context.stroke();
			};
			context.strokeStyle = '#111111';
			context.lineWidth = cell * 0.6;
			trace();
			context.strokeStyle = portStyle(pairs[index].port).color;
			context.lineWidth = cell * 0.4;
			trace();
		});
		context.lineWidth = 4;
		context.strokeStyle = '#111111';
		context.strokeRect(left, top, cell * width, cell * height);
	}
</script>

<GameShell {title} confirmLeave={playing && !showWin}>
	{#snippet actions()}
		<button
			type="button"
			class="btn-chunky px-2 py-1 text-sm sm:px-3"
			aria-label={m.beltroad_help_button()}
			onclick={() => (showTutorial = true)}
		>
			<IconHelp class="size-4" aria-hidden="true" />
			<span class="hidden sm:inline">{m.beltroad_help_button()}</span>
		</button>
	{/snippet}

	{#if playing}
		<!-- The HUD, the grid and the buttons share one width, as wide as the height allows -->
		<section
			class="mx-auto flex w-full flex-col items-center gap-2"
			style:max-width="max(16rem, min(100%, calc((100dvh - 22rem) * {game.level.width /
				game.level.height})))"
		>
			<div
				class="flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-[12px_6px_14px_8px] border-3 border-ink bg-paper px-3 py-1.5 shadow-[3px_3px_0_var(--color-ink)]"
			>
				<p class="text-sm font-bold">
					<span class="block text-xs tracking-wide uppercase">{tierName}</span>
					<span class="sr-only">{m.beltroad_level_label({ number: game.levelIndex + 1 })}</span>
				</p>
				<p role="status" class="flex items-baseline gap-3 font-display font-bold tabular-nums">
					<span class="text-2xl leading-none">{m.beltroad_moves_count({ moves: game.moves })}</span>
					<span class="text-sm">{m.beltroad_par_count({ par: game.par })}</span>
					{#if game.best !== null}
						<span class="text-sm">{m.beltroad_level_best({ moves: game.best })}</span>
					{/if}
				</p>
				<BeltRoadStars stars={game.won ? game.stars : game.currentStars} class="size-5" />
			</div>

			<BeltRoadDebtMeter moves={game.moves} par={game.par} />

			<BeltRoadBoard {game} />

			<p class="text-sm font-bold tabular-nums" role="status">
				{m.beltroad_filled({ filled: game.covered, total: game.cells })}
			</p>

			<ul
				class="flex w-full flex-wrap justify-center gap-x-3 gap-y-1"
				aria-label={m.beltroad_ports_title()}
			>
				{#each game.level.pairs as pair, index (pair.port)}
					{@const style = portStyle(pair.port)}
					{@const joined = game.connected(index)}
					<li
						class="flex items-center gap-1 text-sm font-bold"
						aria-label={joined
							? m.beltroad_port_connected({ port: portName[pair.port]() })
							: m.beltroad_port_open({ port: portName[pair.port]() })}
					>
						<BeltRoadPortIcon glyph={style.glyph} color={style.color} class="size-6" />
						<span class={joined ? 'line-through decoration-2' : ''}>{portName[pair.port]()}</span>
						{#if joined}
							<IconCheck class="size-4" aria-hidden="true" />
						{/if}
					</li>
				{/each}
			</ul>

			<div class="flex flex-wrap items-center justify-center gap-2">
				<button
					type="button"
					class="btn-chunky px-3 py-1 text-sm"
					disabled={game.moves === 0 || game.won}
					onclick={() => game.undo()}
				>
					<IconUndo class="size-4" aria-hidden="true" />
					{m.beltroad_undo()}
				</button>
				<button
					type="button"
					class="btn-chunky px-3 py-1 text-sm"
					disabled={game.isBlank && game.moves === 0}
					onclick={() => game.retry()}
				>
					<IconRotate class="size-4" aria-hidden="true" />
					{m.beltroad_restart()}
				</button>
				<button
					type="button"
					class="btn-chunky px-3 py-1 text-sm"
					onclick={() => game.backToSelect()}
				>
					<IconList class="size-4" aria-hidden="true" />
					{m.beltroad_back_to_levels()}
				</button>
			</div>
		</section>
	{:else}
		<BeltRoadLevelSelect {game} />
	{/if}

	<TutorialModal
		open={showTutorial}
		title={m.beltroad_tutorial_title()}
		closeLabel={m.beltroad_tutorial_close()}
		onclose={() => (showTutorial = false)}
	>
		<p>{m.beltroad_tutorial_goal()}</p>
		<p>{m.beltroad_tutorial_draw()}</p>
		<p>{m.beltroad_tutorial_cut()}</p>
		<p>{m.beltroad_tutorial_stars()}</p>
		<p class="hidden text-sm sm:block">{m.beltroad_keyboard_hint()}</p>
	</TutorialModal>
</GameShell>

<BeltRoadWinPanel
	open={showWin}
	stars={game.stars}
	moves={game.moves}
	debt={game.debt}
	best={game.best}
	isNewBest={game.isNewBest}
	hasNext={game.hasNext}
	totalStars={game.totalStars}
	{modeName}
	{drawBoard}
	onNext={() => game.nextLevel()}
	onRetry={() => game.retry()}
	onLevels={() => game.backToSelect()}
/>
