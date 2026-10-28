<!--
	A daily quest as a job card, as on the leave and result screens: what it asks, a progress bar
	that grows from where the quest stood before this raid, and the reward. A finished quest turns
	green with a big check mark.
-->
<script lang="ts">
	import { questDone, type Quest } from '#lib/game/raid/quests.js';
	import { m } from '#lib/paraglide/messages.js';
	import { questText } from './raidText';
	import IconCheck from '~icons/lucide/check';
	import IconListChecks from '~icons/lucide/list-checks';

	let {
		quest,
		before,
		shown = true,
		delay = 0,
		compact = false
	}: {
		quest: Quest;
		/** Progress before this raid; the part added by the raid is labelled */
		before: number;
		/** Grows the bar from the old progress to the new one once true */
		shown?: boolean;
		delay?: number;
		/** One line of text and a smaller check, for tight screens */
		compact?: boolean;
	} = $props();

	const done = $derived(questDone(quest));
	const share = $derived(Math.min(1, (shown ? quest.progress : before) / quest.target));
	const gained = $derived(quest.progress - before);
</script>

<div
	class="relative flex flex-col justify-between gap-1 rounded-lg px-3 {compact
		? 'pt-1.5 pb-1'
		: 'min-h-16 pt-2 pb-1.5'} text-white shadow-[0_3px_0_rgb(0_0_0/0.3)] {done
		? 'bg-linear-to-r from-[#1fb86a] to-[#2fd0a8]'
		: 'bg-[#2a1a52]/85'}"
>
	<span
		class="absolute -top-2 -left-2 flex size-6 items-center justify-center rounded-full border-2 border-white bg-[#ff6b3d]"
	>
		<IconListChecks class="size-3.5" aria-hidden="true" />
	</span>
	<span
		dir="auto"
		class="pe-8 leading-tight font-bold {compact ? 'truncate text-xs' : 'text-sm'}"
		title={compact ? questText(quest) : undefined}>{questText(quest)}</span
	>
	<div class="flex items-end justify-between gap-2 font-display text-xs font-bold">
		<div class="flex flex-1 flex-col">
			<span class="tabular-nums"
				>{quest.progress}/{quest.target}{#if gained > 0}<span class="ms-1 text-[#ffe066]"
						>+{gained}</span
					>{/if}</span
			>
			<span class="h-1.5 w-full max-w-36 overflow-hidden rounded-full bg-black/30">
				<span
					class="bar block h-full rounded-full bg-white"
					style:width="{share * 100}%"
					style:transition-delay="{delay}ms"
				></span>
			</span>
		</div>
		<span class="text-sm whitespace-nowrap text-[#ffe066]"
			>{m.raid_quest_reward_xp({ xp: quest.reward.xp })}</span
		>
	</div>
	{#if done}
		<IconCheck
			class="absolute top-1 right-1 {compact
				? 'size-6'
				: 'size-8'} stroke-[3.5] text-white drop-shadow-[0_2px_0_rgb(0_0_0/0.25)]"
			aria-hidden="true"
		/>
	{/if}
</div>

<style>
	.bar {
		transition: width 900ms cubic-bezier(0.22, 1, 0.36, 1);
	}

	@media (prefers-reduced-motion: reduce) {
		.bar {
			transition: none;
		}
	}
</style>
