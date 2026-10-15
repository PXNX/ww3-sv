<!--
	The crisis card: a price spike, sanctions, pipeline maintenance or a protest. It shows what
	happened, two answers and a bar that runs down while the player decides. Paying answers are
	disabled when the barrels are not there; if nobody answers, the crisis takes its course.
-->
<script lang="ts">
	import { EVENT_DECISION_MS } from '#lib/game/tycoon/config.js';
	import { formatBig } from '#lib/game/tycoon/format.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { TycoonGame } from '#lib/stores/tycoonGame.svelte.js';
	import { eventChoices, eventText, eventTitle } from './tycoonText.js';
	import IconSiren from '~icons/lucide/siren';

	let { game }: { game: TycoonGame } = $props();

	const locale = getLocale();
	const event = $derived(game.event);
	const choices = $derived(
		event
			? eventChoices(
					event.kind,
					formatBig(event.kind === 'spike' ? game.sellValue : game.eventCost, locale)
				)
			: null
	);
	const secondsLeft = $derived(event ? Math.max(0, Math.ceil(event.remainingMs / 1000)) : 0);
	const share = $derived(
		event ? Math.max(0, Math.min(1, event.remainingMs / EVENT_DECISION_MS)) : 0
	);
</script>

{#if event && choices}
	<div
		class="tycoon-event sticker pop-in flex flex-col gap-2 bg-explosion-yellow p-3"
		style:--tilt="-0.8deg"
		role="alert"
	>
		<div class="flex items-center gap-2">
			<IconSiren class="size-6 shrink-0 text-tie-red" aria-hidden="true" />
			<h2 dir="auto" class="font-display text-xl leading-tight font-bold">
				{eventTitle(event.kind)}
			</h2>
			<span class="ms-auto font-display text-sm font-bold tabular-nums">
				{m.tycoon_event_seconds({ seconds: secondsLeft })}
			</span>
		</div>
		<p dir="auto" class="text-sm leading-snug">{eventText(event.kind, event.producer)}</p>
		<div
			class="h-3 overflow-hidden rounded-full border-2 border-ink bg-paper"
			role="progressbar"
			aria-label={m.tycoon_event_label({ seconds: secondsLeft })}
			aria-valuemin="0"
			aria-valuemax="100"
			aria-valuenow={Math.round(share * 100)}
		>
			<div class="h-full bg-tie-red" style:width="{share * 100}%"></div>
		</div>
		<div class="grid grid-cols-2 gap-2">
			<button
				type="button"
				class="btn-chunky justify-center bg-paper px-2 py-2 text-sm leading-tight"
				disabled={!game.canPayEvent}
				onclick={() => game.choose('a')}
			>
				<span dir="auto">{choices.a}</span>
			</button>
			<button
				type="button"
				class="btn-chunky justify-center bg-paper px-2 py-2 text-sm leading-tight"
				onclick={() => game.choose('b')}
			>
				<span dir="auto">{choices.b}</span>
			</button>
		</div>
	</div>
{/if}
