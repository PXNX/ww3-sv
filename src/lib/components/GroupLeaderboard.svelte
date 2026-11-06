<!--
	The leaderboard of the chat a game was opened from, shown on the result sheet: the rows Telegram
	ranks for this player (the top three, the player and two neighbours on each side), with the
	player's own row picked out and a gap marked where positions are skipped.

	When the run beat another player's best, the player's own agent rushes up from beside that
	player's row, brushes past it and lands next to the player's new place. With reduced motion the
	agent simply stands at the player's row; the caption says who was overtaken either way.
-->
<script lang="ts">
	import Avatar from '#lib/components/Avatar.svelte';
	import { prefersReducedMotion } from '#lib/game/loop.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { GroupBoardRow, GroupOvertaken } from '#lib/services/telegram.js';
	import IconTrophy from '~icons/lucide/trophy';

	let {
		rows,
		status,
		overtaken = null
	}: {
		rows: GroupBoardRow[] | null;
		status: 'idle' | 'loading' | 'ready' | 'failed';
		overtaken?: GroupOvertaken | null;
	} = $props();

	const MEDALS = ['🥇', '🥈', '🥉'];
	const RUSH_MS = 1300;

	let rowEls = $state<HTMLElement[]>([]);
	let runner = $state<HTMLElement | null>(null);
	/** The run that was already animated, so a re-render does not replay it */
	let played = '';

	const ready = $derived(status === 'ready' && rows !== null && rows.length > 0);
	const meIndex = $derived(ready && rows ? rows.findIndex((row) => row.me) : -1);
	/** The overtaken player's row, when Telegram's excerpt of the board shows it below the player */
	const passedIndex = $derived.by(() => {
		if (!ready || !rows || !overtaken || meIndex < 0) return -1;
		const index = rows.findIndex(
			(row) => !row.me && row.name === overtaken.name && row.score === overtaken.score
		);
		return index > meIndex ? index : -1;
	});
	const rushing = $derived(ready && overtaken !== null && meIndex >= 0);

	/** Vertical centre of a row inside the list, where the runner's top edge should sit */
	function centre(row: HTMLElement, height: number): number {
		return row.offsetTop + row.offsetHeight / 2 - height / 2;
	}

	$effect(() => {
		if (!rushing || !runner || !rows || !overtaken) return;
		const me = rowEls[meIndex];
		if (!me) return;
		const height = runner.offsetHeight;
		const target = centre(me, height);
		const key = `${overtaken.name}:${overtaken.score}:${rows[meIndex].position}`;
		if (played === key || prefersReducedMotion()) {
			runner.style.transform = `translateY(${target}px)`;
			return;
		}
		played = key;

		const passed = passedIndex >= 0 ? rowEls[passedIndex] : null;
		// Start a little below the overtaken player (or the bottom of the list when Telegram's
		// excerpt does not show them), so the dash visibly goes past them
		const last = rowEls[rowEls.length - 1] ?? me;
		const passY = passed ? centre(passed, height) : centre(last, height);
		const startY = passY + height * 0.9;

		runner.animate(
			[
				{ transform: `translateY(${startY}px) scale(0.7)`, opacity: 0 },
				{ transform: `translateY(${passY}px) scale(1) rotate(-8deg)`, opacity: 1, offset: 0.3 },
				{ transform: `translateY(${target - 6}px) scale(1.15) rotate(4deg)`, offset: 0.85 },
				{ transform: `translateY(${target}px) scale(1) rotate(0deg)`, opacity: 1 }
			],
			{ duration: RUSH_MS, easing: 'cubic-bezier(0.3, 0.7, 0.2, 1)', fill: 'forwards' }
		);
		passed?.animate(
			[
				{ transform: 'translateX(0)' },
				{ transform: 'translateX(-10px) rotate(-1.5deg)', offset: 0.45 },
				{ transform: 'translateX(4px)', offset: 0.65 },
				{ transform: 'translateX(0)' }
			],
			{ duration: RUSH_MS * 0.7, delay: RUSH_MS * 0.15, easing: 'ease-out' }
		);
		me.animate(
			[{ transform: 'scale(1)' }, { transform: 'scale(1.06)' }, { transform: 'scale(1)' }],
			{ duration: 360, delay: RUSH_MS * 0.85, easing: 'ease-out' }
		);
	});
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

	{#if ready && rows}
		{#if rushing && overtaken}
			<p class="text-center text-sm font-bold" role="status" dir="auto">
				🚀 {m.gameover_group_overtake({ name: overtaken.name || '—' })}
			</p>
		{/if}
		<div class="relative">
			<ol class="flex flex-col gap-0.5 {rushing ? 'pe-9' : ''}">
				{#each rows as row, index (row.position)}
					{#if index > 0 && row.position > rows[index - 1].position + 1}
						<li class="text-center leading-none font-bold text-ink/50" aria-hidden="true">…</li>
					{/if}
					<li
						bind:this={rowEls[index]}
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
			{#if rushing}
				<span
					bind:this={runner}
					class="pointer-events-none absolute end-0 top-0 flex flex-col items-center"
					aria-hidden="true"
				>
					<Avatar size={28} expression="surprised" />
					<span class="runner-trail"></span>
				</span>
			{/if}
		</div>
	{:else if status === 'failed'}
		<p class="text-center text-sm">{m.gameover_group_board_failed()}</p>
	{:else}
		<p class="text-center text-sm">{m.gameover_group_board_loading()}</p>
	{/if}
</section>

<style>
	/* Speed lines under the dashing agent; they fade out once it has landed */
	.runner-trail {
		position: absolute;
		top: 100%;
		width: 14px;
		height: 18px;
		margin-top: -4px;
		background:
			linear-gradient(to bottom, var(--color-ink, #111) 0 40%, transparent) 2px 0 / 3px 100%
				no-repeat,
			linear-gradient(to bottom, var(--color-ink, #111) 0 30%, transparent) 9px 3px / 3px 80%
				no-repeat;
		opacity: 0;
		animation: trail 1.3s ease-out;
	}

	@keyframes trail {
		0%,
		20% {
			opacity: 0;
		}
		35%,
		70% {
			opacity: 0.55;
		}
		100% {
			opacity: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.runner-trail {
			animation: none;
		}
	}
</style>
