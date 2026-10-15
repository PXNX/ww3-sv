<!--
	The guess grid of Sanctions Wordle: six rows of five tiles. Every submitted tile carries a colour
	and a second cue that does not rely on colour (a symbol in the corner, stripes for "in the word",
	a plain muted look for "not in the word"), and is named for screen readers. The grid itself stays
	left-to-right; in Persian and Arabic each row is mirrored instead (see arrangeRow), so the first
	typed letter sits on the right and the row fills in reading order.
-->
<script lang="ts">
	import { MAX_GUESSES, arrangeRow } from '#lib/game/wordle/locales.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { WordleGame } from '#lib/stores/wordleGame.svelte.js';
	import IconCheck from '~icons/lucide/check';
	import IconCircle from '~icons/lucide/circle';
	import IconX from '~icons/lucide/x';

	let { game }: { game: WordleGame } = $props();

	const FLIP_STEP_MS = 190;

	function tileLabel(letter: string, mark: string | null): string {
		if (!letter) return m.wordle_tile_empty();
		if (mark === 'correct') return m.wordle_tile_correct({ letter });
		if (mark === 'present') return m.wordle_tile_present({ letter });
		if (mark === 'absent') return m.wordle_tile_absent({ letter });
		return letter;
	}

	const rows = $derived(
		game.rows.map((row) => ({
			kind: row.kind,
			// the index is the typing order, which also drives the reveal order of the flip
			cells: arrangeRow(
				game.locale,
				row.cells.map((cell, index) => ({ ...cell, index }))
			)
		}))
	);
</script>

<div
	role="grid"
	aria-label={m.wordle_board_label()}
	aria-rowcount={MAX_GUESSES}
	class="mx-auto grid w-full max-w-[19rem] gap-1.5"
>
	{#each rows as row, rowIndex (rowIndex)}
		<!-- The shaking row is rebuilt on every rejected guess, which restarts its animation -->
		{#key rowIndex === game.shakeRow ? game.shakes : 0}
			<div
				role="row"
				aria-label={m.wordle_row_label({ number: rowIndex + 1 })}
				class="wordle-row grid grid-cols-5 gap-1.5"
				class:wordle-shake={rowIndex === game.shakeRow && game.shakes > 0}
			>
				{#each row.cells as cell (cell.index)}
					{@const tileState = cell.mark ?? (cell.letter ? 'typed' : 'empty')}
					<div
						role="gridcell"
						aria-label={tileLabel(cell.letter, cell.mark)}
						class="wordle-tile"
						class:wordle-flip={rowIndex === game.revealRow}
						data-state={tileState}
						style:--wordle-delay="{cell.index * FLIP_STEP_MS}ms"
					>
						<span class="wordle-letter" aria-hidden="true">{cell.letter}</span>
						{#if cell.mark === 'correct'}
							<IconCheck class="wordle-badge" aria-hidden="true" />
						{:else if cell.mark === 'present'}
							<IconCircle class="wordle-badge" aria-hidden="true" />
						{:else if cell.mark === 'absent'}
							<IconX class="wordle-badge" aria-hidden="true" />
						{/if}
					</div>
				{/each}
			</div>
		{/key}
	{/each}
</div>

<style>
	.wordle-tile {
		position: relative;
		display: grid;
		place-items: center;
		aspect-ratio: 1;
		border: 3px solid var(--color-ink);
		border-radius: 10px 5px 9px 6px / 6px 9px 5px 10px;
		background: var(--color-paper);
		color: var(--color-ink);
		font-family: var(--font-display);
		font-weight: 700;
		font-size: clamp(1.5rem, 8vw, 2.1rem);
		line-height: 1;
		box-shadow: 2px 2px 0 var(--color-ink);
	}

	.wordle-tile[data-state='empty'] {
		background: color-mix(in oklab, var(--color-paper) 70%, var(--color-sand));
		box-shadow: none;
	}

	.wordle-tile[data-state='typed'] {
		animation: wordle-pop 120ms ease-out;
		border-width: 4px;
	}

	/* Right letter, right place: green with a check mark */
	.wordle-tile[data-state='correct'] {
		--wordle-bg: var(--color-khaki);
		--wordle-fg: var(--color-ink);
		background: var(--wordle-bg);
	}

	/* In the word, wrong place: yellow with diagonal stripes and a ring */
	.wordle-tile[data-state='present'] {
		--wordle-bg: repeating-linear-gradient(
			135deg,
			var(--color-explosion-yellow) 0 7px,
			color-mix(in oklab, var(--color-explosion-yellow) 60%, var(--color-paper)) 7px 14px
		);
		--wordle-fg: var(--color-ink);
		background: var(--wordle-bg);
	}

	/* Not in the word: plain grey, no fill pattern, with a cross */
	.wordle-tile[data-state='absent'] {
		--wordle-bg: var(--color-sky);
		--wordle-fg: color-mix(in oklab, var(--color-ink) 75%, var(--color-sky));
		background: var(--wordle-bg);
		color: var(--wordle-fg);
	}

	:global(.wordle-badge) {
		position: absolute;
		top: 2px;
		inset-inline-end: 2px;
		width: 0.8rem;
		height: 0.8rem;
		stroke-width: 3.5;
	}

	.wordle-flip {
		animation: wordle-flip 560ms ease-in-out backwards;
		animation-delay: var(--wordle-delay, 0ms);
	}

	.wordle-shake {
		animation: wordle-shake 380ms ease-in-out;
	}

	@keyframes wordle-pop {
		0% {
			transform: scale(0.88);
		}
		60% {
			transform: scale(1.08);
		}
		100% {
			transform: scale(1);
		}
	}

	/* The tile turns edge-on, and shows its colour from the half-way point on */
	@keyframes wordle-flip {
		0% {
			transform: rotateX(0);
			background: var(--color-paper);
			color: var(--color-ink);
		}
		49% {
			transform: rotateX(90deg);
			background: var(--color-paper);
			color: var(--color-ink);
		}
		50% {
			transform: rotateX(90deg);
			background: var(--wordle-bg);
			color: var(--wordle-fg);
		}
		100% {
			transform: rotateX(0);
			background: var(--wordle-bg);
			color: var(--wordle-fg);
		}
	}

	@keyframes wordle-shake {
		0%,
		100% {
			transform: translateX(0);
		}
		20% {
			transform: translateX(-7px);
		}
		40% {
			transform: translateX(7px);
		}
		60% {
			transform: translateX(-5px);
		}
		80% {
			transform: translateX(5px);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.wordle-tile[data-state='typed'],
		.wordle-flip,
		.wordle-shake {
			animation: none;
		}
	}
</style>
