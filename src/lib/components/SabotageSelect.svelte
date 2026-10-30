<!--
	Gig Saboteur job list: the nine gigs in three groups of three (power line, ammo depot, shell
	factory) with the best stars of each. A gig opens once the one before it is done. Picking one
	starts a run there; the run goes on to the following gigs until three busts end it.
-->
<script lang="ts">
	import { THEME_NAMES, SABOTAGE_TEXT } from '#lib/game/sabotage/text.js';
	import type { Theme } from '#lib/game/sabotage/levels.js';
	import type { SabotageGame } from '#lib/stores/sabotageGame.svelte.js';
	import IconLock from '~icons/lucide/lock';
	import IconStar from '~icons/lucide/star';

	let { game, onpick }: { game: SabotageGame; onpick: (index: number) => void } = $props();

	const THEMES: readonly Theme[] = ['power', 'depot', 'factory'];
	const THEME_TINT: Record<Theme, string> = {
		power: 'bg-explosion-yellow',
		depot: 'bg-khaki',
		factory: 'bg-tie-red'
	};

	const groups = $derived(
		THEMES.map((theme) => ({
			theme,
			jobs: game.levels
				.map((level, index) => ({ level, index }))
				.filter(({ level }) => level.theme === theme)
		}))
	);
</script>

<section class="mx-auto flex w-full max-w-md flex-col gap-3 pb-2">
	<div
		class="rounded-[12px_6px_14px_8px] border-3 border-ink bg-paper px-3 py-2 text-center shadow-[3px_3px_0_var(--color-ink)]"
	>
		<h2 dir="auto" class="font-display text-2xl leading-tight font-bold">
			{SABOTAGE_TEXT.selectTitle}
		</h2>
		<p dir="auto" class="text-sm">{SABOTAGE_TEXT.selectIntro}</p>
		<p class="mt-1 flex items-center justify-center gap-1 font-display text-sm font-bold">
			<IconStar class="size-4 [&_path]:fill-current" aria-hidden="true" />
			{SABOTAGE_TEXT.starsTotal(game.totalStars, game.maxStars)}
		</p>
	</div>

	{#each groups as group (group.theme)}
		<div class="flex flex-col gap-1.5">
			<h3 class="px-1 font-display text-sm font-bold tracking-wide uppercase">
				{THEME_NAMES[group.theme]}
			</h3>
			<div class="grid grid-cols-3 gap-2">
				{#each group.jobs as { level, index } (level.id)}
					{@const open = game.unlocked(index)}
					{@const stars = game.starsOf(index)}
					<button
						type="button"
						class="btn-chunky min-h-24 flex-col justify-between gap-1 p-2 text-center {open
							? 'bg-paper'
							: 'bg-paper opacity-60'}"
						disabled={!open}
						aria-label="{SABOTAGE_TEXT.gigNumber(index + 1)}, {level.title}{open
							? ''
							: `, ${SABOTAGE_TEXT.locked}`}"
						onclick={() => onpick(index)}
					>
						<span
							class="flex size-7 items-center justify-center rounded-full border-2 border-ink font-display text-sm font-bold {THEME_TINT[
								group.theme
							]}"
						>
							{#if open}{index + 1}{:else}<IconLock class="size-4" aria-hidden="true" />{/if}
						</span>
						<span dir="auto" class="text-xs leading-tight font-bold">{level.title}</span>
						<span class="flex gap-0.5" aria-hidden="true">
							{#each [0, 1, 2] as star (star)}
								<IconStar
									class="size-4 {stars !== null && star < stars
										? '[&_path]:fill-explosion-yellow text-ink'
										: 'text-ink/30'}"
								/>
							{/each}
						</span>
					</button>
				{/each}
			</div>
		</div>
	{/each}

	<p dir="auto" class="px-1 text-center text-xs opacity-80">{SABOTAGE_TEXT.runHint}</p>
</section>
