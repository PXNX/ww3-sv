<!--
	What the player sees once the star is burning, in two parts so the glow stays in view:
	the "banner" part is a slim strip over the bottom of the board (the tiny horned conductor, the
	"Ritual Complete" title in the riddle font and a mute button, since the music is the point of
	the finale), and the "results" part is a card under the board with the score, every cat's
	hearts in deep red and the buttons.
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { MAX_HEARTS, catHearts } from '#lib/game/purrpentagram/scoring.js';
	import type { RitualState } from '#lib/game/purrpentagram/state.js';
	import { m } from '#lib/paraglide/messages.js';
	import { COAT_COLORS } from '#lib/theme/purrCoats.js';
	import { coatText } from '#lib/theme/purrText.js';
	import PurrConductor from './PurrConductor.svelte';
	import ShareButton from './ShareButton.svelte';
	import SoundToggle from './SoundToggle.svelte';
	import IconRotate from '~icons/lucide/rotate-ccw';
	import IconHeartFilled from '~icons/fluent/heart-24-filled';
	import IconHeartOutline from '~icons/fluent/heart-24-regular';

	let {
		part,
		ritual,
		/** How far the banner has faded in (0 to 1) */
		banner,
		calm,
		score,
		best,
		isNewBest,
		modeName,
		onAgain
	}: {
		part: 'banner' | 'results';
		ritual: RitualState;
		banner: number;
		calm: boolean;
		score: number;
		best: number | null;
		isNewBest: boolean;
		modeName: string;
		onAgain: () => void;
	} = $props();

	const HEART_SLOTS = Array.from({ length: MAX_HEARTS }, (_, slot) => slot);
</script>

{#if banner > 0 && part === 'banner'}
	<div
		class="absolute inset-x-1.5 bottom-1.5 z-10 flex items-center justify-between gap-2 rounded-[14px_8px_16px_10px] border-3 border-[#4a1580] bg-[#12061f]/80 px-2 py-1 text-paper backdrop-blur-sm"
		style:opacity={banner}
		role="status"
	>
		<PurrConductor {calm} class="size-12 shrink-0 sm:size-16" />
		<h2
			dir="auto"
			class="ritual-title min-w-0 flex-1 text-center text-2xl leading-tight sm:text-4xl"
		>
			{m.purr_ritual_complete()}
		</h2>
		<SoundToggle />
	</div>
{:else if banner > 0 && part === 'results'}
	<section
		class="flex flex-col items-center gap-2 rounded-[14px_8px_16px_10px] border-3 border-[#4a1580] bg-[#12061f] px-3 py-3 text-center text-paper shadow-[4px_4px_0_var(--color-ink)]"
		style:opacity={banner}
	>
		<p dir="auto" class="riddle-font text-sm leading-snug text-[#e9d3ff]">
			{m.purr_win_subtitle()}
		</p>

		<div class="flex flex-col items-center leading-none">
			<span class="text-xs font-bold uppercase">{m.game_score()}</span>
			<span class="font-display text-5xl font-bold text-[#ff6b9a] tabular-nums">{score}</span>
			{#if isNewBest}
				<span
					class="mt-1 rotate-2 rounded-md border-2 border-ink bg-explosion-yellow px-1.5 text-xs font-bold text-ink"
				>
					{m.gameover_new_best()}
				</span>
			{:else if best !== null}
				<span class="mt-1 text-xs font-bold opacity-80">{m.game_best()}: {best}</span>
			{/if}
		</div>

		<ul
			class="flex flex-wrap items-center justify-center gap-x-3 gap-y-1"
			aria-label={m.purr_win_hearts_label()}
		>
			{#each ritual.cats as cat (cat.profile.id)}
				{@const hearts = catHearts(cat.happiness)}
				<li
					class="flex flex-col items-center gap-0.5"
					aria-label="{coatText(cat.profile.coat)}: {m.purr_note_hearts({
						hearts,
						max: MAX_HEARTS
					})}"
				>
					<span
						class="size-4 rounded-full border-2 border-paper/80"
						style:background={COAT_COLORS[cat.profile.coat].fur}
						aria-hidden="true"
					></span>
					<span class="flex text-lg" aria-hidden="true">
						{#each HEART_SLOTS as heart (heart)}
							{#if heart < hearts}
								<IconHeartFilled class="text-heart" />
							{:else}
								<IconHeartOutline class="text-heart opacity-50" />
							{/if}
						{/each}
					</span>
				</li>
			{/each}
		</ul>

		<div class="flex flex-wrap items-center justify-center gap-2">
			<button type="button" class="btn-chunky bg-tie-red text-base text-ink" onclick={onAgain}>
				<IconRotate class="size-4" aria-hidden="true" />
				{m.purr_win_again()}
			</button>
			<a href={resolve('/')} class="btn-chunky text-base">{m.gameover_home()}</a>
			{#if isNewBest}
				<ShareButton {modeName} {score} />
			{/if}
		</div>
	</section>
{/if}
