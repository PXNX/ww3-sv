<!--
	The player's notes on the five cats: the coat they can see, the name once the cat has shown its
	tag, how deep its purr is once it has settled into a steady one, how happy it is (its hearts, in
	deep red) and every reaction to the room that has been seen so far. Everything the riddle can
	ask about is collected here, so nothing depends on remembering or on hearing alone.
-->
<script lang="ts">
	import { MAX_HEARTS, catHearts } from '#lib/game/purrpentagram/scoring.js';
	import type { RitualState } from '#lib/game/purrpentagram/state.js';
	import { m } from '#lib/paraglide/messages.js';
	import { COAT_COLORS } from '#lib/theme/purrCoats.js';
	import { coatText, eventText, reactionText } from '#lib/theme/purrText.js';
	import IconHeartFilled from '~icons/fluent/heart-24-filled';
	import IconHeartOutline from '~icons/fluent/heart-24-regular';

	let { ritual }: { ritual: RitualState } = $props();
	const HEART_SLOTS = Array.from({ length: MAX_HEARTS }, (_, slot) => slot);
</script>

<section
	class="sticker flex flex-col gap-2 p-3"
	style:--tilt="0.4deg"
	aria-label={m.purr_notes_title()}
>
	<h2 class="font-display text-lg leading-none font-bold">{m.purr_notes_title()}</h2>
	<ul class="flex flex-col gap-1.5">
		{#each ritual.cats as cat (cat.profile.id)}
			{@const hearts = catHearts(cat.happiness)}
			<li class="flex flex-col gap-0.5 rounded-md border-2 border-ink bg-sand px-2 py-1">
				<div class="flex items-center gap-2">
					<span
						class="size-5 shrink-0 rounded-full border-2 border-ink"
						style:background={COAT_COLORS[cat.profile.coat].fur}
						aria-hidden="true"
					></span>
					<span dir="auto" class="min-w-0 flex-1 truncate text-sm font-bold">
						{cat.nameShown ? cat.profile.name : coatText(cat.profile.coat)}
					</span>
					{#if cat.pitchShown}
						<span
							class="flex h-4 items-end gap-0.5"
							role="img"
							aria-label={m.purr_note_pitch({ rank: cat.profile.purrRank + 1 })}
						>
							{#each [0, 1, 2, 3, 4] as rank (rank)}
								<span
									class="w-1.5 rounded-sm border border-ink {rank === cat.profile.purrRank
										? 'bg-explosion-yellow'
										: 'bg-ink/25'}"
									style:height="{4 + rank * 3}px"
								></span>
							{/each}
						</span>
					{/if}
					<span
						class="flex text-base"
						role="img"
						aria-label={m.purr_note_hearts({ hearts, max: MAX_HEARTS })}
					>
						{#each HEART_SLOTS as heart (heart)}
							{#if heart < hearts}
								<IconHeartFilled class="text-heart" />
							{:else}
								<IconHeartOutline class="text-heart-outline opacity-60" />
							{/if}
						{/each}
					</span>
				</div>
				{#if cat.observed.length > 0}
					<ul class="flex flex-wrap gap-x-3 gap-y-0.5 text-xs leading-tight">
						{#each cat.observed as seen (seen.event)}
							<li dir="auto">
								{m.purr_observation({
									event: eventText(seen.event),
									reaction: reactionText(seen.animation)
								})}
							</li>
						{/each}
					</ul>
				{/if}
			</li>
		{/each}
	</ul>
</section>
