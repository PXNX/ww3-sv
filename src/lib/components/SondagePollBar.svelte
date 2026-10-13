<!--
	The poll bar at the top of Sondage Surge: your share of the map grows from the left, La Candidate's
	bloc from the right, the undecided départements sit in between, and a marker in the middle shows
	the line an absolute majority has to cross. The bar itself stays left to right in every language.
-->
<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { SIDE_COLOR } from '#lib/game/sondage/board.js';

	let {
		you,
		rival,
		total,
		needed
	}: {
		/** Départements held by each side, and in all */
		you: number;
		rival: number;
		total: number;
		/** Départements for an absolute majority */
		needed: number;
	} = $props();

	const percent = (count: number) => (total > 0 ? Math.round((count / total) * 100) : 0);
	const youPercent = $derived(percent(you));
	const rivalPercent = $derived(percent(rival));
	const undecided = $derived(total - you - rival);
</script>

<div class="flex flex-col gap-1">
	<div dir="ltr" class="flex items-baseline justify-between gap-2 text-xs font-bold sm:text-sm">
		<span dir="auto" class="tabular-nums" style:color={SIDE_COLOR.you}>
			{m.sondage_poll_you({ percent: youPercent })}
		</span>
		<span dir="auto" class="hidden text-center sm:inline">{m.sondage_poll_title()}</span>
		<span dir="auto" class="tabular-nums" style:color={SIDE_COLOR.rival}>
			{m.sondage_poll_rival({ percent: rivalPercent })}
		</span>
	</div>
	<div
		class="relative flex h-5 w-full overflow-hidden rounded-full border-3 border-ink bg-paper"
		dir="ltr"
		role="img"
		aria-label={m.sondage_poll_aria({ you, rival, undecided, needed })}
	>
		<div
			class="h-full transition-[width] duration-500"
			style:width="{(you / Math.max(1, total)) * 100}%"
			style:background={SIDE_COLOR.you}
		></div>
		<div class="h-full flex-1 bg-sand"></div>
		<div
			class="h-full transition-[width] duration-500"
			style:width="{(rival / Math.max(1, total)) * 100}%"
			style:background={SIDE_COLOR.rival}
		></div>
		<!-- The majority marker -->
		<div
			class="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-ink"
			style:left="50%"
			aria-hidden="true"
		></div>
	</div>
	<p dir="auto" class="text-center text-[0.7rem] leading-none font-semibold">
		{m.sondage_poll_majority({ needed })}
	</p>
</div>
