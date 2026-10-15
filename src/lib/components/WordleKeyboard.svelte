<!--
	On-screen keyboard of Sanctions Wordle, laid out for the language of the page (QWERTY, QWERTZ,
	the Russian and Ukrainian JCUKEN layouts, and the Persian and Arabic layouts). Each key shows what
	its letter has been so far in the same two ways as the tiles: colour and a corner symbol. In
	Persian and Arabic the rows read from right to left, so the first key of a row is on the right.
-->
<script lang="ts">
	import { KEYBOARDS, arrangeRow } from '#lib/game/wordle/locales.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { WordleGame } from '#lib/stores/wordleGame.svelte.js';
	import IconCheck from '~icons/lucide/check';
	import IconCircle from '~icons/lucide/circle';
	import IconDelete from '~icons/lucide/delete';
	import IconCornerDownLeft from '~icons/lucide/corner-down-left';
	import IconX from '~icons/lucide/x';

	let {
		game,
		onletter,
		onenter,
		ondelete
	}: {
		game: WordleGame;
		onletter: (letter: string) => void;
		onenter: () => void;
		ondelete: () => void;
	} = $props();

	type KeySpec = { kind: 'letter'; letter: string } | { kind: 'enter' } | { kind: 'delete' };

	// The last row also holds Enter and Delete; the whole row is mirrored for right-to-left locales
	const rows = $derived(
		KEYBOARDS[game.locale].map((letters, rowIndex, all): KeySpec[] => {
			const keys: KeySpec[] = letters.map((letter) => ({ kind: 'letter', letter }));
			const row: KeySpec[] =
				rowIndex === all.length - 1 ? [{ kind: 'enter' }, ...keys, { kind: 'delete' }] : keys;
			return arrangeRow(game.locale, row);
		})
	);
	const states = $derived(game.keys);

	function keyLabel(letter: string): string {
		const state = states.get(letter);
		if (state === 'correct') return m.wordle_tile_correct({ letter });
		if (state === 'present') return m.wordle_tile_present({ letter });
		if (state === 'absent') return m.wordle_tile_absent({ letter });
		return letter;
	}

	// A tap leaves no focus on the key, so the Enter key of a physical keyboard still sends the guess
	function release(event: MouseEvent) {
		if (event.detail > 0) (event.currentTarget as HTMLElement).blur();
	}
</script>

<div
	class="mx-auto flex w-full max-w-xl flex-col gap-1.5"
	role="group"
	aria-label={m.wordle_keyboard_label()}
>
	{#each rows as row, rowIndex (rowIndex)}
		<div class="flex justify-center gap-1 sm:gap-1.5">
			{#each row as key (key.kind === 'letter' ? key.letter : key.kind)}
				{#if key.kind === 'letter'}
					{@const keyState = states.get(key.letter) ?? 'unused'}
					<button
						type="button"
						class="wordle-key"
						data-state={keyState}
						data-wordle-key
						aria-label={keyLabel(key.letter)}
						disabled={!game.typing}
						onclick={(event) => {
							release(event);
							onletter(key.letter);
						}}
					>
						<span aria-hidden="true">{key.letter}</span>
						{#if keyState === 'correct'}
							<IconCheck class="wordle-key-badge" aria-hidden="true" />
						{:else if keyState === 'present'}
							<IconCircle class="wordle-key-badge" aria-hidden="true" />
						{:else if keyState === 'absent'}
							<IconX class="wordle-key-badge" aria-hidden="true" />
						{/if}
					</button>
				{:else if key.kind === 'enter'}
					<button
						type="button"
						class="wordle-key wordle-key-wide"
						data-wordle-key
						aria-label={m.wordle_key_enter()}
						disabled={!game.typing}
						onclick={(event) => {
							release(event);
							onenter();
						}}
					>
						<IconCornerDownLeft class="size-5 rtl:-scale-x-100" aria-hidden="true" />
						<span class="hidden text-xs sm:inline">{m.wordle_key_enter()}</span>
					</button>
				{:else}
					<button
						type="button"
						class="wordle-key wordle-key-wide"
						data-wordle-key
						aria-label={m.wordle_key_delete()}
						disabled={!game.typing}
						onclick={(event) => {
							release(event);
							ondelete();
						}}
					>
						<IconDelete class="size-5 rtl:-scale-x-100" aria-hidden="true" />
					</button>
				{/if}
			{/each}
		</div>
	{/each}
</div>

<style>
	.wordle-key {
		position: relative;
		display: grid;
		place-items: center;
		flex: 1 1 0;
		min-width: 0;
		height: 3rem;
		padding: 0;
		border: 3px solid var(--color-ink);
		border-radius: 8px 4px 7px 5px / 5px 7px 4px 8px;
		background: var(--color-paper);
		color: var(--color-ink);
		font-family: var(--font-display);
		font-size: clamp(0.9rem, 3.6vw, 1.15rem);
		font-weight: 700;
		line-height: 1;
		box-shadow: 2px 2px 0 var(--color-ink);
		cursor: pointer;
		touch-action: manipulation;
		transition:
			translate 120ms ease-out,
			box-shadow 120ms ease-out;
	}

	.wordle-key:active:not(:disabled) {
		translate: 1px 1px;
		box-shadow: 1px 1px 0 var(--color-ink);
	}

	.wordle-key:focus-visible {
		outline: 3px dashed var(--color-tie-red);
		outline-offset: 2px;
	}

	.wordle-key:disabled {
		cursor: default;
		opacity: 0.6;
	}

	.wordle-key-wide {
		flex: 1.5 1 0;
		grid-auto-flow: column;
		gap: 0.25rem;
		background: var(--color-sand);
	}

	.wordle-key[data-state='correct'] {
		background: var(--color-khaki);
	}

	.wordle-key[data-state='present'] {
		background: repeating-linear-gradient(
			135deg,
			var(--color-explosion-yellow) 0 6px,
			color-mix(in oklab, var(--color-explosion-yellow) 60%, var(--color-paper)) 6px 12px
		);
	}

	.wordle-key[data-state='absent'] {
		background: var(--color-sky);
		color: color-mix(in oklab, var(--color-ink) 70%, var(--color-sky));
	}

	:global(.wordle-key-badge) {
		position: absolute;
		top: 1px;
		inset-inline-end: 1px;
		width: 0.6rem;
		height: 0.6rem;
		stroke-width: 4;
	}
</style>
