<!--
	The sea log on the chart, kept as simple as a ship's log: one line per event, newest first, each
	with an icon, a short sentence and how long ago. Tapping a line flies the chart to the island it
	happened on (or to your home bay for raids on your base) and makes that island pulse. Lines about
	you are coloured: red when you lost something, green when you held or won. The log folds away to
	just its header so it never covers the chart for long.
-->
<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { ago, isPersonal, type LogEvent, type LogPlace } from '#lib/game/beachhead/mapLog.js';
	import { islandName } from './beachheadText';
	import IconChevronDown from '~icons/lucide/chevron-down';
	import IconFlag from '~icons/lucide/flag-triangle-right';
	import IconScroll from '~icons/lucide/scroll-text';
	import IconShield from '~icons/lucide/shield-check';
	import IconSkull from '~icons/lucide/skull';
	import IconSwords from '~icons/lucide/swords';
	import IconCoins from '~icons/lucide/coins';

	let {
		events,
		retakeIn,
		now,
		onfocus
	}: {
		events: readonly LogEvent[];
		/** Time left until the enemy retakes one of your islands, already formatted; null when none */
		retakeIn: string | null;
		now: number;
		onfocus: (place: LogPlace) => void;
	} = $props();

	let open = $state(true);

	const placeName = (place: LogPlace): string =>
		place === 'home' ? m.beachhead_home_base() : islandName(place);

	function sentence(event: LogEvent): string {
		switch (event.kind) {
			case 'raiders':
				return m.beachhead_log_raiders({ island: placeName(event.island) });
			case 'attack':
				return m.beachhead_log_attack({ player: event.player, island: placeName(event.island) });
			case 'taken':
				return m.beachhead_log_taken({ player: event.player, island: placeName(event.island) });
			case 'raided':
				return m.beachhead_log_raided({ player: event.player });
			case 'defended':
				return m.beachhead_log_defended({ player: event.player });
			case 'plundered':
				return m.beachhead_log_plundered({ player: event.player });
		}
	}

	const tone = (event: LogEvent): string =>
		event.kind === 'raided'
			? 'bg-tie-red text-paper'
			: event.kind === 'defended' || event.kind === 'plundered'
				? 'bg-[#3fa65a] text-paper'
				: '';
</script>

<section
	class="pointer-events-auto w-[min(17rem,52vw)] overflow-hidden rounded-[10px_6px_12px_8px] border-2 border-ink bg-paper/95 shadow-[2px_2px_0_var(--color-ink)]"
	aria-label={m.beachhead_log_title()}
>
	<button
		type="button"
		class="flex w-full items-center gap-1.5 px-2 py-1 font-display text-xs font-bold"
		aria-expanded={open}
		onclick={() => (open = !open)}
	>
		<IconScroll class="size-3.5 shrink-0" aria-hidden="true" />
		<span class="flex-1 text-start">{m.beachhead_log_title()}</span>
		{#if retakeIn !== null}
			<span
				class="flex items-center gap-0.5 rounded-full bg-tie-red px-1.5 text-paper tabular-nums"
				title={m.beachhead_log_retake({ time: retakeIn })}
			>
				<IconSkull class="size-3" aria-hidden="true" />
				{retakeIn}
			</span>
		{/if}
		<IconChevronDown
			class="size-3.5 shrink-0 transition-transform motion-reduce:transition-none {open
				? 'rotate-180'
				: ''}"
			aria-hidden="true"
		/>
	</button>

	{#if open}
		<ol class="max-h-[40vh] overflow-y-auto border-t-2 border-ink/20">
			{#each events as event (event.id ?? `${event.kind}-${event.atMs}`)}
				<li class="border-b border-ink/10 last:border-b-0">
					<button
						type="button"
						class="flex w-full items-center gap-1.5 px-2 py-1 text-start text-[0.7rem] leading-tight hover:bg-sand focus-visible:bg-sand {tone(
							event
						)}"
						onclick={() => onfocus(event.island)}
					>
						<span
							class="flex size-5 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-explosion-yellow text-ink"
							aria-hidden="true"
						>
							{#if event.kind === 'raiders'}
								<IconSkull class="size-3" />
							{:else if event.kind === 'taken'}
								<IconFlag class="size-3" />
							{:else if event.kind === 'defended'}
								<IconShield class="size-3" />
							{:else if event.kind === 'plundered' || event.kind === 'raided'}
								<IconCoins class="size-3" />
							{:else}
								<IconSwords class="size-3" />
							{/if}
						</span>
						<span
							dir="auto"
							class="min-w-0 flex-1 font-semibold {isPersonal(event) ? 'font-bold' : ''}"
						>
							{sentence(event)}
						</span>
						<span class="shrink-0 tabular-nums opacity-70">{ago(now, event.atMs)}</span>
					</button>
				</li>
			{:else}
				<li class="px-2 py-1.5 text-[0.7rem] opacity-70">{m.beachhead_log_empty()}</li>
			{/each}
		</ol>
	{/if}
</section>
