<!--
	The leaderboard of the chat a game was opened from, shown on the result sheet: the rows Telegram
	ranks for this player (the top three, the player and two neighbours on each side), with the
	player's own row picked out and a gap marked where positions are skipped.
-->
<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import type { GroupBoardRow } from '#lib/services/telegram.js';
	import IconTrophy from '~icons/lucide/trophy';

	let {
		rows,
		status
	}: {
		rows: GroupBoardRow[] | null;
		status: 'idle' | 'loading' | 'ready' | 'failed';
	} = $props();

	const MEDALS = ['🥇', '🥈', '🥉'];
</script>

<section
	class="pop-in flex w-full flex-col gap-1 rounded-[12px_6px_14px_8px] border-3 border-ink bg-sand p-2 text-start"
	aria-labelledby="group-board-title"
	aria-busy={status === 'loading'}
>
	<h3
		id="group-board-title"
		class="flex items-center justify-center gap-1 text-sm font-bold uppercase"
	>
		<IconTrophy class="size-4" aria-hidden="true" />
		{m.gameover_group_board_title()}
	</h3>

	{#if status === 'ready' && rows && rows.length > 0}
		<ol class="flex flex-col gap-0.5">
			{#each rows as row, index (row.position)}
				{#if index > 0 && row.position > rows[index - 1].position + 1}
					<li class="text-center leading-none font-bold text-ink/50" aria-hidden="true">…</li>
				{/if}
				<li
					class="flex items-center gap-2 rounded-md px-2 py-0.5 font-bold {row.me
						? 'border-2 border-ink bg-explosion-yellow'
						: ''}"
					aria-current={row.me ? 'true' : undefined}
				>
					<span class="w-7 shrink-0 text-center tabular-nums">
						{MEDALS[row.position - 1] ?? row.position}
					</span>
					<span class="min-w-0 flex-1 truncate" dir="auto">{row.name || '—'}</span>
					<span class="tabular-nums">{row.score}</span>
				</li>
			{/each}
		</ol>
	{:else if status === 'failed'}
		<p class="text-center text-sm">{m.gameover_group_board_failed()}</p>
	{:else}
		<p class="text-center text-sm">{m.gameover_group_board_loading()}</p>
	{/if}
</section>
