<!--
	Spokesperson Whack playfield: a crisp high-DPI canvas driven by the fixed-step loop. Tapping a
	podium whacks whoever stands behind it (every finger counts, so two thumbs work); the digits 1
	to 9 do the same from a keyboard. The playfield never mirrors in right-to-left languages and
	never scrolls (touch-action: none).
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { createFixedLoop, onAppHidden } from '#lib/game/loop.js';
	import { clientToLocal, type Rect } from '#lib/game/pointerDrag.js';
	import { WORLD_HEIGHT, WORLD_WIDTH, BOARD_IDS, type BoardId } from '#lib/game/whack/config.js';
	import { holeForDigit } from '#lib/game/whack/layout.js';
	import { drawScene } from '#lib/game/whack/render.js';
	import type { WhackGame } from '#lib/stores/whackGame.svelte.js';
	import PauseOverlay from './PauseOverlay.svelte';
	import WhackBoardThumb from './WhackBoardThumb.svelte';
	import IconPlay from '~icons/lucide/play';
	import IconStart from '~icons/lucide/house';

	let { game }: { game: WhackGame } = $props();

	const boardNames: Record<BoardId, () => string> = {
		regime: () => m.whack_board_regime_name(),
		militant: () => m.whack_board_militant_name(),
		kremlin: () => m.whack_board_kremlin_name()
	};

	let canvas: HTMLCanvasElement | undefined = $state();
	let context: CanvasRenderingContext2D | null = null;
	/** CSS pixels per world unit */
	let scale = 1;

	function draw() {
		if (!canvas || !context) return;
		const ratio = window.devicePixelRatio || 1;
		context.setTransform(scale * ratio, 0, 0, scale * ratio, 0, 0);
		drawScene(context, game.state, game.sceneExtras());
	}

	function resize() {
		if (!canvas) return;
		const ratio = window.devicePixelRatio || 1;
		const width = canvas.clientWidth;
		scale = width / WORLD_WIDTH;
		canvas.width = Math.round(width * ratio);
		canvas.height = Math.round(((width * WORLD_HEIGHT) / WORLD_WIDTH) * ratio);
		draw();
	}

	const loop = createFixedLoop({ update: (dtMs) => game.update(dtMs), render: draw });

	onMount(() => {
		if (!canvas) return;
		context = canvas.getContext('2d');
		const observer = new ResizeObserver(resize);
		observer.observe(canvas);
		const stopHidden = onAppHidden(() => game.pause());
		return () => {
			loop.pause();
			observer.disconnect();
			stopHidden();
		};
	});

	$effect(() => {
		if (game.status === 'playing') {
			loop.start();
		} else {
			loop.pause();
		}
		// Redraw when the state changes while the loop is stopped (pause, a new game, game over,
		// another board)
		void game.status;
		void game.board;
		draw();
	});

	/** The drawn area in viewport pixels (inside the border), for mapping pointers to the world */
	function fieldRect(): Rect | null {
		if (!canvas) return null;
		const rect = canvas.getBoundingClientRect();
		return {
			left: rect.left + canvas.clientLeft,
			top: rect.top + canvas.clientTop,
			width: canvas.clientWidth,
			height: canvas.clientHeight
		};
	}

	function onCanvasDown(event: PointerEvent) {
		if (game.status !== 'playing') return;
		const rect = fieldRect();
		if (!rect) return;
		const point = clientToLocal(
			rect,
			{ x: event.clientX, y: event.clientY },
			{ width: WORLD_WIDTH, height: WORLD_HEIGHT }
		);
		game.pointerDown(point.x, point.y);
		event.preventDefault();
	}

	const isInteractive = (target: EventTarget | null) =>
		target instanceof HTMLElement &&
		target.closest('button, a, input, select, textarea, [contenteditable]') !== null;

	function onKey(event: KeyboardEvent) {
		if (game.status === 'over' || event.ctrlKey || event.metaKey || event.altKey) return;
		if (event.code === 'Escape') {
			if (game.status === 'playing') game.pause();
		} else if (event.code === 'KeyP' && !event.repeat && !isInteractive(event.target)) {
			game.togglePause();
		} else if (!event.repeat && !isInteractive(event.target)) {
			const hole = holeForDigit(event.key);
			if (hole !== null) game.pressHole(hole);
		}
	}
</script>

<svelte:window onkeydown={onKey} />

<div data-playfield class="flex w-full flex-col gap-3 select-none">
	<div class="relative">
		<canvas
			bind:this={canvas}
			class="block aspect-[36/51] w-full touch-none rounded-[14px_8px_16px_10px] border-3 border-ink shadow-[4px_4px_0_var(--color-ink)]"
			style:touch-action="none"
			aria-label={m.whack_playfield_label()}
			onpointerdown={onCanvasDown}
			oncontextmenu={(event) => event.preventDefault()}
		></canvas>

		<!-- A red flash around the field whenever a heart is lost -->
		{#key game.hurtCount}
			{#if game.hurtCount > 0 && game.status === 'playing'}
				<div
					class="hurt pointer-events-none absolute inset-0 rounded-[14px_8px_16px_10px] border-8 border-tie-red"
				></div>
			{/if}
		{/key}

		{#if game.status === 'ready'}
			<div
				class="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-[14px_8px_16px_10px] bg-ink/35 p-4"
			>
				<div
					class="sticker pop-in flex w-full max-w-xs flex-col items-center gap-3 p-4 text-center"
					style:--tilt="-1.5deg"
				>
					<p dir="auto" class="text-sm leading-snug font-semibold">{m.whack_ready_hint()}</p>
					<div
						class="flex w-full flex-col gap-2"
						role="radiogroup"
						aria-label={m.whack_board_label()}
					>
						{#each BOARD_IDS as board (board)}
							<button
								type="button"
								role="radio"
								aria-checked={game.board === board}
								class="board-choice flex items-center gap-3 rounded-[10px_6px_12px_8px] border-3 border-ink bg-paper p-1.5 text-start font-display text-base leading-tight font-bold shadow-[2px_2px_0_var(--color-ink)]"
								class:selected={game.board === board}
								onclick={() => game.selectBoard(board)}
							>
								<WhackBoardThumb {board} class="h-10 w-[4.5rem] shrink-0" />
								<span dir="auto" class="flex-1">{boardNames[board]()}</span>
							</button>
						{/each}
					</div>
					{#if game.best !== null}
						<p class="text-sm font-semibold">{m.whack_best_on_board({ score: game.best })}</p>
					{/if}
					<button type="button" class="btn-chunky bg-tie-red text-xl" onclick={() => game.start()}>
						<IconPlay class="size-5" aria-hidden="true" />
						{m.whack_start()}
					</button>
				</div>
			</div>
		{:else if game.status === 'paused'}
			<PauseOverlay onResume={() => game.resume()}>
				<button
					type="button"
					class="btn-chunky px-3 py-1 text-sm"
					onclick={() => game.backToStart()}
				>
					<IconStart class="size-4" aria-hidden="true" />
					{m.whack_change_board()}
				</button>
			</PauseOverlay>
		{/if}
	</div>
</div>

<style>
	.hurt {
		animation: hurt 420ms ease-out forwards;
	}

	.board-choice.selected {
		background: var(--color-explosion-yellow);
		outline: 3px solid var(--color-tie-red);
		outline-offset: 1px;
	}

	@keyframes hurt {
		from {
			opacity: 0.85;
		}
		to {
			opacity: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.hurt {
			animation-duration: 1ms;
		}
	}
</style>
