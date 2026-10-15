<!--
	"Nationalize and restart": the prestige panel. It shows what a restart would pay, asks for a
	confirmation in a dialog with the oil baron's (fictional, cartoon) comment, and lists the
	lifetime statistics. A small "reset progress" button at the bottom wipes the whole save after a
	second tap.
-->
<script lang="ts">
	import { onDestroy } from 'svelte';
	import { PRESTIGE_BONUS, PRESTIGE_UNIT } from '#lib/game/tycoon/config.js';
	import { formatBig, formatCount, formatMultiplier } from '#lib/game/tycoon/format.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { TycoonGame } from '#lib/stores/tycoonGame.svelte.js';
	import { cameoAsset } from '#lib/theme/cameos.js';
	import IconCrown from '~icons/lucide/crown';
	import IconRotate from '~icons/lucide/rotate-ccw';

	let { game }: { game: TycoonGame } = $props();

	const locale = getLocale();
	const CONFIRM_MS = 3000;

	let dialog: HTMLDialogElement | undefined = $state();
	let confirmingReset = $state(false);
	let resetTimer: ReturnType<typeof setTimeout> | undefined;
	onDestroy(() => clearTimeout(resetTimer));

	const stats = $derived([
		{ label: m.tycoon_stat_taps(), value: formatCount(game.taps, locale) },
		{ label: m.tycoon_stat_crises(), value: formatCount(game.crisesAnswered, locale) },
		{ label: m.tycoon_stat_evaded(), value: formatCount(game.sanctionsEvaded, locale) },
		{ label: m.tycoon_stat_prestiges(), value: formatCount(game.prestiges, locale) }
	]);

	function confirmNationalize() {
		dialog?.close();
		game.nationalize();
	}

	function onReset() {
		if (!confirmingReset) {
			confirmingReset = true;
			clearTimeout(resetTimer);
			resetTimer = setTimeout(() => (confirmingReset = false), CONFIRM_MS);
			return;
		}
		clearTimeout(resetTimer);
		confirmingReset = false;
		game.reset();
	}
</script>

<div class="flex flex-col gap-3">
	<div class="sticker flex flex-col gap-2 bg-paper p-3" style:--tilt="0.5deg">
		<h2 dir="auto" class="font-display text-xl font-bold">{m.tycoon_prestige_title()}</h2>
		<p dir="auto" class="text-sm leading-snug">
			{m.tycoon_prestige_text({ percent: formatCount(PRESTIGE_BONUS * 100, locale) })}
		</p>
		<p dir="auto" class="font-display text-sm font-bold">
			{m.tycoon_prestige_points({
				points: formatCount(game.prestigePoints, locale),
				multiplier: formatMultiplier(game.multiplier, locale)
			})}
		</p>
		<p dir="auto" class="text-sm tabular-nums">
			{m.tycoon_prestige_run({ amount: formatBig(game.runTotal, locale) })}
		</p>
		{#if game.pendingPoints >= 1}
			<p dir="auto" class="font-display text-base font-bold text-tie-red">
				{m.tycoon_prestige_pending({ points: formatCount(game.pendingPoints, locale) })}
			</p>
			<button
				type="button"
				class="btn-chunky justify-center bg-explosion-yellow text-lg"
				onclick={() => dialog?.showModal()}
			>
				<IconCrown class="size-5" aria-hidden="true" />
				{m.tycoon_prestige_button()}
			</button>
		{:else}
			<p dir="auto" class="text-sm font-semibold">
				{m.tycoon_prestige_locked({ amount: formatBig(PRESTIGE_UNIT, locale) })}
			</p>
		{/if}
	</div>

	<dl class="grid grid-cols-2 gap-2 font-display text-sm">
		{#each stats as stat (stat.label)}
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt dir="auto" class="text-center font-bold">{stat.label}</dt>
				<dd class="text-xl font-bold tabular-nums">{stat.value}</dd>
			</div>
		{/each}
	</dl>

	<button
		type="button"
		class="btn-chunky justify-center self-center px-3 py-1 text-sm"
		class:bg-tie-red={confirmingReset}
		onclick={onReset}
	>
		<IconRotate class="size-4" aria-hidden="true" />
		{confirmingReset ? m.tycoon_reset_confirm() : m.tycoon_reset()}
	</button>
</div>

<dialog
	bind:this={dialog}
	class="modal modal-bottom sm:modal-middle"
	aria-labelledby="tycoon-confirm-title"
>
	<div
		class="sticker modal-box flex max-h-[92dvh] flex-col gap-3 overflow-y-auto rounded-[18px_10px_16px_8px] border-3 border-ink bg-paper p-5 shadow-(--shadow-hard)"
		style:--tilt="-1deg"
	>
		<h2 id="tycoon-confirm-title" dir="auto" class="text-2xl font-bold">
			{m.tycoon_prestige_confirm_title()}
		</h2>
		<div class="flex items-center gap-3">
			<img
				src={cameoAsset('tycoon-baron.svg')}
				alt={m.tycoon_cameo_alt()}
				class="size-24 shrink-0 rounded-lg border-3 border-ink bg-sand"
			/>
			<div class="flex flex-col gap-1">
				<p dir="auto" class="font-display text-xs font-bold uppercase">{m.tycoon_cameo_label()}</p>
				<p dir="auto" class="text-sm leading-snug italic">{m.tycoon_cameo_message()}</p>
			</div>
		</div>
		<p dir="auto" class="text-sm leading-snug">
			{m.tycoon_prestige_confirm_text({
				points: formatCount(game.pendingPoints, locale),
				percent: formatCount(game.pendingPoints * PRESTIGE_BONUS * 100, locale)
			})}
		</p>
		<div class="flex flex-wrap justify-end gap-2">
			<button type="button" class="btn-chunky" onclick={() => dialog?.close()}>
				{m.tycoon_prestige_confirm_no()}
			</button>
			<button type="button" class="btn-chunky bg-explosion-yellow" onclick={confirmNationalize}>
				{m.tycoon_prestige_confirm_yes()}
			</button>
		</div>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button type="submit" aria-label={m.tycoon_prestige_confirm_no()}></button>
	</form>
</dialog>
