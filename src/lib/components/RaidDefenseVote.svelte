<!--
	The vote at every fifth wave of a defense: the screen splits in two, leaving with the pot on the
	left and holding on on the right. Tapping a side moves the player's own avatar over to it (it
	can still move back while the vote is open); the countdown and the pot sit in the middle. Squad
	mates show up as votes on their side. A tie leaves with the pot. The playfield never mirrors,
	so neither does this.
-->
<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import type { RaidGame } from '#lib/stores/raidGame.svelte.js';
	import Avatar from './Avatar.svelte';
	import IconCoins from '~icons/lucide/coins';
	import IconGem from '~icons/lucide/gem';
	import IconLogOut from '~icons/lucide/log-out';
	import IconPackage from '~icons/lucide/package';
	import IconShield from '~icons/lucide/shield';
	import IconSparkles from '~icons/lucide/sparkles';
	import IconWrench from '~icons/lucide/wrench';

	let { game }: { game: RaidGame } = $props();

	const defense = $derived(game.defense!);
	const vote = $derived(defense.vote!);
	const pot = $derived([
		{ icon: IconSparkles, value: defense.pot.xp, color: 'text-[#7fd3ff]', label: 'XP' },
		{
			icon: IconCoins,
			value: defense.pot.gold,
			color: 'text-[#ffd23a]',
			label: m.raid_stat_gold()
		},
		{
			icon: IconWrench,
			value: defense.pot.scrap,
			color: 'text-[#c9ced4]',
			label: m.raid_result_scrap()
		},
		{
			icon: IconGem,
			value: defense.pot.crystals,
			color: 'text-[#c79bff]',
			label: m.raid_result_crystals()
		},
		{ icon: IconPackage, value: defense.pot.gear, color: 'text-white', label: m.raid_result_loot() }
	]);
	/** Where the player's avatar stands: in the middle until they pick a side */
	const spot = $derived(vote.mine === 'leave' ? 25 : vote.mine === 'stay' ? 75 : 50);
</script>

<div
	dir="ltr"
	class="absolute inset-0 z-30 flex text-white"
	role="dialog"
	aria-modal="true"
	aria-labelledby="raid-vote-title"
	aria-describedby="raid-vote-body"
>
	<button
		type="button"
		class="side flex flex-1 flex-col items-center justify-end gap-1 bg-linear-to-r from-[#ff6a10]/75 to-[#ff6a10]/20 pb-[22%] {vote.mine ===
		'leave'
			? 'chosen'
			: ''}"
		aria-pressed={vote.mine === 'leave'}
		onclick={() => game.vote('leave')}
	>
		<IconLogOut
			class="size-10 stroke-[2.5] drop-shadow-[0_3px_0_rgb(0_0_0/0.3)]"
			aria-hidden="true"
		/>
		<span dir="auto" class="label font-display text-2xl leading-none font-black uppercase italic"
			>{m.raid_vote_leave()}</span
		>
		<span class="font-display text-lg font-black tabular-nums opacity-90">{vote.leave}</span>
	</button>
	<button
		type="button"
		class="side flex flex-1 flex-col items-center justify-end gap-1 bg-linear-to-l from-[#22c3b0]/75 to-[#22c3b0]/20 pb-[22%] {vote.mine ===
		'stay'
			? 'chosen'
			: ''}"
		aria-pressed={vote.mine === 'stay'}
		onclick={() => game.vote('stay')}
	>
		<IconShield
			class="size-10 stroke-[2.5] drop-shadow-[0_3px_0_rgb(0_0_0/0.3)]"
			aria-hidden="true"
		/>
		<span dir="auto" class="label font-display text-2xl leading-none font-black uppercase italic"
			>{m.raid_vote_stay()}</span
		>
		<span class="font-display text-lg font-black tabular-nums opacity-90">{vote.stay}</span>
	</button>

	<!-- The question, the countdown and the pot -->
	<div
		class="pointer-events-none absolute inset-x-0 top-[calc(var(--hud-top,0.75rem)+0.5rem)] mx-auto flex max-w-md flex-col items-center gap-1.5 px-4 text-center"
	>
		<span
			class="flex size-14 items-center justify-center rounded-full bg-[#1b1036]/85 font-display text-2xl font-black tabular-nums ring-4 ring-white/80"
			aria-live="off">{vote.seconds}</span
		>
		<h2
			id="raid-vote-title"
			dir="auto"
			class="label font-display text-3xl leading-none font-black uppercase italic"
		>
			{m.raid_vote_title()}
		</h2>
		<p
			id="raid-vote-body"
			dir="auto"
			class="rounded-lg bg-[#1b1036]/70 px-2 py-1 text-xs leading-snug font-semibold"
		>
			{m.raid_vote_body()}
			{m.raid_vote_tie()}
		</p>
		<dl class="flex flex-wrap justify-center gap-1.5 font-display text-sm font-black">
			{#each pot as entry (entry.label)}
				<div
					class="flex items-center gap-1 rounded-lg bg-[#1b1036]/80 px-2 py-0.5"
					title={entry.label}
				>
					<dt>
						<entry.icon class="size-4 {entry.color}" aria-hidden="true" /><span class="sr-only"
							>{entry.label}</span
						>
					</dt>
					<dd class="tabular-nums">{entry.value}</dd>
				</div>
			{/each}
		</dl>
	</div>

	<!-- The player, walking over to the side they picked -->
	<div
		class="token pointer-events-none absolute bottom-[6%] flex -translate-x-1/2 flex-col items-center gap-0.5"
		style:left="{spot}%"
	>
		<span
			class="block size-16 overflow-hidden rounded-full bg-[#7a3fe0] shadow-[0_4px_0_rgb(0_0_0/0.3)] ring-4 {vote.mine ===
			'leave'
				? 'ring-[#ffb020]'
				: vote.mine === 'stay'
					? 'ring-[#22c3b0]'
					: 'ring-white'}"
		>
			<Avatar size={64} class="ms-[-3px] -mt-1" />
		</span>
		<span class="rounded bg-[#1b1036]/85 px-1.5 font-display text-xs font-black uppercase"
			>{m.raid_vote_you()}</span
		>
	</div>
</div>

<style>
	.side {
		transition: filter 160ms ease-out;
	}

	.side:active {
		filter: brightness(1.15);
	}

	.side.chosen {
		filter: brightness(1.2) saturate(1.2);
	}

	.label {
		-webkit-text-stroke: 1.5px #12082e;
		paint-order: stroke fill;
		text-shadow: 0 3px 0 rgb(0 0 0 / 0.35);
	}

	.token {
		transition: left 450ms cubic-bezier(0.34, 1.4, 0.64, 1);
	}

	@media (prefers-reduced-motion: reduce) {
		.token {
			transition: none;
		}
	}
</style>
