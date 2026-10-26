<!--
	A clearly labelled demo advert: a short countdown, then the reward can be collected. The coins
	are paid by the caller through onClaim, so the same sheet serves the supply depot and the
	double-up button on the result screen. No network request and no tracking.
-->
<script lang="ts">
	import { AD_SECONDS } from '#lib/game/career/config.js';
	import { m } from '#lib/paraglide/messages.js';
	import { soundManager } from '#lib/sound/soundManager.svelte.js';
	import IconNewspaper from '~icons/lucide/newspaper';
	import IconTv from '~icons/lucide/tv';

	let {
		open,
		coins,
		onClaim,
		onClose
	}: {
		open: boolean;
		/** What the advert pays, shown on the claim button */
		coins: number;
		onClaim: () => void;
		onClose: () => void;
	} = $props();

	let dialog: HTMLDialogElement | undefined = $state();
	let secondsLeft = $state(AD_SECONDS);
	let claimed = $state(false);

	const ready = $derived(secondsLeft <= 0);
	const progress = $derived(Math.min(100, Math.max(0, 100 - (secondsLeft / AD_SECONDS) * 100)));

	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) {
			secondsLeft = AD_SECONDS;
			claimed = false;
			dialog.showModal();
		} else if (!open && dialog.open) {
			dialog.close();
		}
	});

	// One interval per viewing; it stops itself when the countdown is done or the sheet closes
	$effect(() => {
		if (!open || claimed) return;
		const timer = window.setInterval(() => {
			const next = Math.max(0, secondsLeft - 1);
			secondsLeft = next;
			if (next === 0) {
				window.clearInterval(timer);
				soundManager().play('chime-big');
			}
		}, 1000);
		return () => window.clearInterval(timer);
	});

	function claim() {
		if (!ready || claimed) return;
		claimed = true;
		soundManager().play('chime-big');
		onClaim();
	}

	function close() {
		onClose();
	}
</script>

<dialog
	bind:this={dialog}
	class="modal modal-bottom sm:modal-middle"
	aria-labelledby="ad-title"
	oncancel={(event) => {
		event.preventDefault();
		close();
	}}
>
	<div
		class="sticker relative modal-box flex max-h-[92dvh] flex-col items-center gap-3 overflow-y-auto rounded-[18px_10px_16px_8px] border-3 border-ink bg-paper p-5 text-center shadow-(--shadow-hard)"
		style:--tilt="0.8deg"
	>
		<h2 id="ad-title" class="font-display text-2xl font-bold">{m.ad_title()}</h2>

		<div
			class="flex aspect-video w-full flex-col items-center justify-center gap-1 rounded-[12px_6px_14px_8px] border-3 border-ink bg-banner-slate p-3 text-paper"
		>
			<IconTv class="size-10" stroke-width="2.5" aria-hidden="true" />
			<span class="font-display text-xl font-bold">{m.ad_demo()}</span>
		</div>

		<div class="w-full">
			<div
				class="h-3 w-full overflow-hidden rounded-full border-2 border-ink bg-sand"
				role="progressbar"
				aria-valuemin={0}
				aria-valuemax={100}
				aria-valuenow={Math.round(progress)}
			>
				<div class="h-full bg-khaki" style:width="{progress}%"></div>
			</div>
			<p class="mt-1 text-sm font-bold tabular-nums" aria-live="polite">
				{#if ready}
					{m.ad_ready()}
				{:else}
					{m.ad_wait({ seconds: secondsLeft })}
				{/if}
			</p>
		</div>

		<button
			type="button"
			class="btn-chunky w-full bg-explosion-yellow text-lg disabled:cursor-not-allowed disabled:opacity-55"
			disabled={!ready || claimed}
			onclick={claim}
		>
			<IconNewspaper class="size-5" aria-hidden="true" />
			{m.ad_claim({ coins })}
		</button>
		<button type="button" class="btn-chunky px-3 py-1 text-sm" onclick={close}>
			{m.ad_close()}
		</button>
		{#if claimed}
			<p role="status" class="text-sm font-bold text-khaki">{m.ad_done()}</p>
		{/if}
	</div>
</dialog>
