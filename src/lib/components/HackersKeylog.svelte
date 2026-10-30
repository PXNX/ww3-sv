<!--
	Hermit Hackers, stage 2 (keylogger): the admin's keystrokes stream across the screen. Tap the
	green ones as they pass (or type their letter), leave the red honeypots alone. The passphrase
	fills in as keys are captured.
-->
<script lang="ts">
	import { LANES } from '#lib/game/hackers/config.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { HackersGame } from '#lib/stores/hackersGame.svelte.js';

	let { game }: { game: HackersGame } = $props();
</script>

<div class="flex flex-col gap-3">
	<p class="text-sm leading-snug">{m.hackers_keylog_hint()}</p>

	<p class="flex items-center gap-1.5 text-sm" aria-live="polite">
		<span class="opacity-80">{m.hackers_keylog_passphrase()}</span>
		<span class="flex gap-1 font-bold tracking-widest">
			{#each { length: game.passphraseLength }, i (i)}
				<span
					class="flex size-7 items-center justify-center rounded border border-[#39ff6a]/70 {game
						.captured[i]
						? 'bg-[#39ff6a] text-[#021208]'
						: ''}"
				>
					{game.captured[i]?.toUpperCase() ?? ''}
				</span>
			{/each}
		</span>
	</p>

	<div
		dir="ltr"
		class="relative h-56 touch-none overflow-hidden rounded border-2 border-[#39ff6a]/60 bg-[#031a0a] select-none"
		role="group"
		aria-label={m.hackers_keylog_stream()}
	>
		{#each { length: LANES }, lane (lane)}
			<div
				class="absolute inset-x-0 border-b border-dashed border-[#39ff6a]/15"
				style:top="{(lane / LANES) * 100}%"
				style:height="{100 / LANES}%"
			></div>
		{/each}
		<span class="pointer-events-none absolute start-1 top-0.5 text-[10px] opacity-60">
			{m.hackers_keylog_admin()}
		</span>
		{#each game.chips as chip (chip.id)}
			<button
				type="button"
				class="absolute flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded border-2 text-lg font-bold uppercase {chip.real
					? 'border-[#39ff6a] bg-[#39ff6a] text-[#021208] shadow-[0_0_10px_#39ff6a]'
					: 'border-[#e5484d] bg-[#5a1216] text-[#ffb3b6]'}"
				style:left="{6 + chip.x * 88}%"
				style:top="{((chip.lane + 0.5) / LANES) * 100}%"
				onpointerdown={(event) => {
					event.preventDefault();
					game.tapChip(chip.id);
				}}
				aria-label="{chip.letter.toUpperCase()}{chip.real
					? ''
					: ` (${m.hackers_keylog_honeypot()})`}"
			>
				{chip.letter}
			</button>
		{/each}
	</div>
</div>
