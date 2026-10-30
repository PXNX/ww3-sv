<!--
	Hermit Hackers, stage 1 (breach): crack the access code. Every attempt shows its marks slot by
	slot: green is the right glyph in the right slot, amber the right glyph in the wrong slot.
	Keys: 1 to 8 type a glyph, Backspace deletes, Enter cracks (handled by the page).
-->
<script lang="ts">
	import { GLYPHS } from '#lib/game/hackers/config.js';
	import type { Mark } from '#lib/game/hackers/mastermind.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { HackersGame } from '#lib/stores/hackersGame.svelte.js';

	let { game }: { game: HackersGame } = $props();

	const MARK_CLASS: Record<Mark, string> = {
		hit: 'bg-[#39ff6a] text-[#021208]',
		near: 'bg-[#e8b923] text-[#021208]',
		miss: 'bg-[#0b2a14] text-[#39ff6a]/50'
	};
	const MARK_LABEL: Record<Mark, () => string> = {
		hit: m.hackers_mark_hit,
		near: m.hackers_mark_near,
		miss: m.hackers_mark_miss
	};

	// 5 glyphs in one row, 6 in two even rows, 7 and 8 in rows of four
	const keypadColumns = $derived(game.symbols <= 5 ? game.symbols : game.symbols === 6 ? 3 : 4);
	const filled = $derived(game.input.length === game.codeLength);
</script>

<div class="flex flex-col gap-3">
	<p class="text-sm leading-snug">{m.hackers_breach_hint()}</p>

	<ol class="flex flex-col gap-1.5" aria-label={m.hackers_breach_history()}>
		{#each game.guesses as guess, row (row)}
			<li class="flex items-center gap-1.5">
				{#each guess.symbols as symbol, i (i)}
					<span
						class="flex size-9 items-center justify-center rounded border border-[#39ff6a]/60 text-lg font-bold {MARK_CLASS[
							guess.marks[i]
						]}"
					>
						{GLYPHS[symbol]}<span class="sr-only">{MARK_LABEL[guess.marks[i]]()}</span>
					</span>
				{/each}
			</li>
		{/each}
		<li class="flex items-center gap-1.5">
			{#each { length: game.codeLength }, i (i)}
				<span
					class="flex size-9 items-center justify-center rounded border-2 border-dashed border-[#39ff6a] text-lg font-bold {game
						.input[i] !== undefined
						? 'bg-[#39ff6a]/15'
						: ''}"
				>
					{game.input[i] !== undefined ? GLYPHS[game.input[i]] : '_'}
				</span>
			{/each}
			<span class="ms-2 text-xs opacity-80"
				>{m.hackers_breach_attempts({ count: game.attemptsLeft })}</span
			>
		</li>
	</ol>

	<div class="grid gap-2" style:grid-template-columns="repeat({keypadColumns}, minmax(0, 1fr))">
		{#each GLYPHS.slice(0, game.symbols) as glyph, i (glyph)}
			<button
				type="button"
				class="relative flex h-11 items-center justify-center rounded border-2 border-[#39ff6a] bg-[#0b2a14] text-xl font-bold hover:bg-[#12401f] active:bg-[#39ff6a] active:text-[#021208]"
				disabled={game.input.length >= game.codeLength}
				onclick={() => game.pushSymbol(i)}
			>
				{glyph}
				<span
					class="absolute end-1 top-0 hidden text-[10px] opacity-60 sm:block"
					aria-hidden="true"
				>
					{i + 1}
				</span>
			</button>
		{/each}
	</div>

	<div class="flex gap-2">
		<button
			type="button"
			class="h-10 flex-1 rounded border-2 border-[#39ff6a] bg-[#0b2a14] font-bold hover:bg-[#12401f] disabled:opacity-40"
			disabled={game.input.length === 0}
			onclick={() => game.popSymbol()}
		>
			{m.hackers_breach_delete()}
		</button>
		<button
			type="button"
			class="h-10 flex-[2] rounded border-2 border-[#39ff6a] bg-[#39ff6a] font-bold text-[#021208] hover:bg-[#7dff9b] disabled:opacity-40"
			disabled={!filled}
			onclick={() => game.submit()}
		>
			{m.hackers_breach_crack()}
		</button>
	</div>
</div>
