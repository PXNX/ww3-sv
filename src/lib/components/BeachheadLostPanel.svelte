<!-- The defeat panel: the troops that fell and two round buttons, nothing to share and no score -->
<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { TROOP_ICONS } from '#lib/components/beachheadIcons.js';
	import { troopName } from '#lib/components/beachheadText.js';
	import type { TroopKind } from '#lib/game/beachhead/config.js';
	import IconMap from '~icons/lucide/map';
	import IconRotateCcw from '~icons/lucide/rotate-ccw';
	import IconTimer from '~icons/lucide/timer';

	let {
		open,
		lost,
		seconds,
		onRetry,
		onIslands
	}: {
		open: boolean;
		/** Troops the attack killed, by kind */
		lost: Partial<Record<TroopKind, number>>;
		seconds: number;
		onRetry: () => void;
		onIslands: () => void;
	} = $props();

	let dialog: HTMLDialogElement | undefined = $state();

	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		else if (!open && dialog.open) dialog.close();
	});

	const fallen = $derived(
		(Object.entries(lost) as [TroopKind, number][]).filter(([, count]) => count > 0)
	);
</script>

<dialog
	bind:this={dialog}
	class="modal modal-bottom sm:modal-middle"
	aria-labelledby="beachhead-lost-title"
	oncancel={(event) => event.preventDefault()}
>
	<div
		class="sticker modal-box flex max-h-[92dvh] flex-col items-center gap-3 overflow-y-auto border-3 border-ink p-5 text-center"
		style:--tilt="-1deg"
	>
		<h2
			id="beachhead-lost-title"
			class="bg-smoke rotate-2 rounded-[10px] border-3 border-ink px-6 py-1 text-3xl font-bold tracking-wide text-paper uppercase shadow-[3px_3px_0_var(--color-ink)]"
		>
			{m.beachhead_lost_title()}
		</h2>
		<p
			class="flex items-center gap-1.5 rounded-full border-2 border-ink bg-paper px-3 py-0.5 font-display text-lg font-bold tabular-nums"
			title={m.beachhead_win_time()}
		>
			<IconTimer class="size-5" aria-hidden="true" />
			{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
		</p>
		{#if fallen.length > 0}
			<ul class="flex flex-wrap justify-center gap-1.5" aria-label={m.beachhead_lost_troops()}>
				{#each fallen as [kind, count] (kind)}
					{@const LostIcon = TROOP_ICONS[kind]}
					<li
						class="flex items-center gap-1 rounded-full border-2 border-ink bg-tie-red px-2 py-0.5 font-display text-sm font-bold text-paper tabular-nums"
						title={troopName(kind)}
					>
						<LostIcon class="size-4" aria-hidden="true" />
						−{count}
					</li>
				{/each}
			</ul>
		{/if}
		<div class="flex gap-3">
			<button
				type="button"
				class="btn-chunky"
				aria-label={m.beachhead_retry()}
				title={m.beachhead_retry()}
				onclick={onRetry}
			>
				<IconRotateCcw class="size-6" aria-hidden="true" />
			</button>
			<button
				type="button"
				class="btn-chunky"
				aria-label={m.beachhead_to_map()}
				title={m.beachhead_to_map()}
				onclick={onIslands}
			>
				<IconMap class="size-6" aria-hidden="true" />
			</button>
		</div>
	</div>
</dialog>
