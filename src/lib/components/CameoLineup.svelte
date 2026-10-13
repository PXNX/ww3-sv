<!--
	Start screen hero: every leader side by side as tilted portrait cards, each in front of their
	country's flag. Tapping a leader filters the game list to the games that feature them; tapping
	again (or the chip above the game list) shows every game.
-->
<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { LEADERS, type LeaderId } from '#lib/theme/leaders.js';

	let { selected = $bindable(null) }: { selected?: LeaderId | null } = $props();
</script>

<ul class="grid grid-cols-6 gap-2 p-3" aria-label={m.home_filter_label()}>
	{#each LEADERS as leader, index (leader.id)}
		{@const active = selected === leader.id}
		<li>
			<button
				type="button"
				class="block w-full cursor-pointer rounded-lg transition-[opacity,scale] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-tie-red focus-visible:outline-dashed active:scale-95 {selected &&
				!active
					? 'opacity-50'
					: ''}"
				aria-pressed={active}
				aria-label={m.home_filter_leader({ name: leader.name() })}
				onclick={() => (selected = active ? null : leader.id)}
			>
				<img
					src={leader.portrait}
					alt=""
					draggable="false"
					class="aspect-square w-full {index % 2 === 0
						? '-rotate-2'
						: 'rotate-2'} rounded-lg border-3 border-ink object-cover shadow-[2px_2px_0_var(--color-ink)] {active
						? 'ring-4 ring-tie-red ring-offset-2'
						: ''}"
					style:background="url({leader.flag}) center / 100% 100%"
				/>
			</button>
		</li>
	{/each}
</ul>
