<!--
	The activity log on the chart, a panel down the left edge in the manner of a base builder: a title
	bar with a close button and one tinted row per event, newest first. Each row has a big round icon,
	a short headline, how long ago, and a chevron. Red rows are losses, blue ones held or won, sand
	ones loot you took, purple ones other players on the move. Tapping a row flies the chart to the
	island it happened on (or to your home bay for raids on your base) and makes that island pulse.
-->
<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { ago, isPersonal, type LogEvent, type LogPlace } from '#lib/game/beachhead/mapLog.js';
	import { islandName } from './beachheadText';
	import IconChevronRight from '~icons/lucide/chevron-right';
	import IconX from '~icons/lucide/x';
	import IconFlag from '~icons/lucide/flag-triangle-right';
	import IconShield from '~icons/lucide/shield-check';
	import IconSkull from '~icons/lucide/skull';
	import IconSwords from '~icons/lucide/swords';
	import IconCoins from '~icons/lucide/coins';

	let {
		events,
		retakeIn,
		now,
		onfocus,
		onclose
	}: {
		events: readonly LogEvent[];
		/** Time left until the enemy retakes one of your islands, already formatted; null when none */
		retakeIn: string | null;
		now: number;
		onfocus: (place: LogPlace) => void;
		onclose: () => void;
	} = $props();

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

	/** The tint of a row: losses red, wins blue, loot sand, other players purple, raiders slate */
	const tone = (event: LogEvent): string =>
		event.kind === 'raided' || event.kind === 'taken'
			? 'bg-[#b9575a] text-paper'
			: event.kind === 'defended'
				? 'bg-[#3f7ea3] text-paper'
				: event.kind === 'plundered'
					? 'bg-[#efe4c2] text-ink'
					: event.kind === 'attack'
						? 'bg-[#7a4fb5] text-paper'
						: 'bg-[#5b6f80] text-paper';
</script>

<section
	class="log-in pointer-events-auto flex h-full w-[min(19rem,44vw)] flex-col border-e-3 border-ink bg-ink/85 shadow-[4px_0_0_rgb(0_0_0/0.25)]"
	aria-label={m.beachhead_log_title()}
>
	<header class="flex items-center gap-2 bg-[#3c5468] px-2 py-1.5 text-paper">
		<h2
			class="log-title min-w-0 flex-1 truncate font-display text-lg font-bold tracking-wide uppercase"
		>
			{m.beachhead_log_title()}
		</h2>
		<button
			type="button"
			class="btn-chunky flex size-9 shrink-0 items-center justify-center rounded-full p-0 text-ink"
			aria-label={m.beachhead_tutorial_close()}
			title={m.beachhead_tutorial_close()}
			onclick={onclose}
		>
			<IconX class="size-5" aria-hidden="true" />
		</button>
	</header>

	{#if retakeIn !== null}
		<p
			class="flex items-center gap-1.5 border-b-2 border-ink bg-tie-red px-2 py-1 font-display text-xs font-bold text-paper tabular-nums"
		>
			<IconSkull class="size-4 shrink-0" aria-hidden="true" />
			{m.beachhead_log_retake({ time: retakeIn })}
		</p>
	{/if}

	<ol class="min-h-0 flex-1 overflow-y-auto">
		{#each events as event, index (event.id ?? `${event.kind}-${event.atMs}`)}
			<li class="log-row border-b-2 border-ink/40" style:--row={index}>
				<button
					type="button"
					class="flex w-full items-center gap-2 px-2 py-1.5 text-start transition-[filter] hover:brightness-110 focus-visible:brightness-110 {tone(
						event
					)}"
					onclick={() => onfocus(event.island)}
				>
					<span
						class="flex size-11 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-paper text-ink shadow-[1px_2px_0_var(--color-ink)]"
						aria-hidden="true"
					>
						{#if event.kind === 'raiders'}
							<IconSkull class="size-6" />
						{:else if event.kind === 'taken'}
							<IconFlag class="size-6" />
						{:else if event.kind === 'defended'}
							<IconShield class="size-6" />
						{:else if event.kind === 'plundered' || event.kind === 'raided'}
							<IconCoins class="size-6" />
						{:else}
							<IconSwords class="size-6" />
						{/if}
					</span>
					<span class="flex min-w-0 flex-1 flex-col">
						<span
							dir="auto"
							class="text-sm leading-tight font-bold {isPersonal(event) ? '' : 'font-semibold'}"
						>
							{sentence(event)}
						</span>
						<span class="text-xs font-semibold tabular-nums opacity-80">{ago(now, event.atMs)}</span
						>
					</span>
					<IconChevronRight class="size-5 shrink-0 rtl:rotate-180" aria-hidden="true" />
				</button>
			</li>
		{:else}
			<li class="px-3 py-3 text-sm text-paper opacity-80">{m.beachhead_log_empty()}</li>
		{/each}
	</ol>
</section>

<style>
	/* The panel slides in from the edge and its rows follow one after another */
	.log-in {
		animation: log-in 260ms cubic-bezier(0.2, 1.2, 0.4, 1);
	}

	.log-row {
		animation: log-row 320ms cubic-bezier(0.3, 1.5, 0.5, 1) both;
		animation-delay: calc(var(--row, 0) * 45ms + 120ms);
	}

	.log-title {
		paint-order: stroke fill;
		-webkit-text-stroke: 3px var(--color-ink);
	}

	@keyframes log-in {
		from {
			transform: translateX(-100%);
		}
	}

	@keyframes log-row {
		from {
			opacity: 0;
			transform: translateX(-24px);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.log-in,
		.log-row {
			animation: none;
		}
	}
</style>
