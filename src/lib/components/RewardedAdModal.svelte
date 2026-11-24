<!--
	A clearly labelled house advert from litfass (our own channels and features): a short
	countdown, then the reward can be collected. The reward is paid by the caller through onClaim,
	so the same sheet serves the supply depot, the double-up button and continuing a run. The feed
	is bundled with the game: no network request and no tracking.
-->
<script lang="ts">
	import {
		loadHouseAds,
		nextHouseAd,
		openHouseAd,
		reportHouseAd,
		type HouseAd
	} from '#lib/ads/houseAds.js';
	import { AD_SECONDS } from '#lib/game/career/config.js';
	import { m } from '#lib/paraglide/messages.js';
	import { soundManager } from '#lib/sound/soundManager.svelte.js';
	import IconExternalLink from '~icons/lucide/external-link';
	import IconNewspaper from '~icons/lucide/newspaper';
	import IconTv from '~icons/lucide/tv';

	let {
		open,
		coins,
		claimLabel,
		onClaim,
		onClose
	}: {
		open: boolean;
		/** What the advert pays, shown on the claim button */
		coins: number;
		/** Replaces the coin text on the claim button when the advert pays something else */
		claimLabel?: string;
		onClaim: () => void;
		onClose: () => void;
	} = $props();

	let dialog: HTMLDialogElement | undefined = $state();
	let secondsLeft = $state(AD_SECONDS);
	let claimed = $state(false);
	let houseAd = $state<HouseAd | null>(null);

	// The current adverts are fetched in the background; until then the bundled ones are shown
	$effect(() => {
		void loadHouseAds();
	});

	const ready = $derived(secondsLeft <= 0);
	const progress = $derived(Math.min(100, Math.max(0, 100 - (secondsLeft / AD_SECONDS) * 100)));

	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) {
			secondsLeft = AD_SECONDS;
			claimed = false;
			houseAd = nextHouseAd();
			if (houseAd) reportHouseAd(houseAd.ad, 'view');
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
		if (houseAd) reportHouseAd(houseAd.ad, 'reward');
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

		<!-- The advert's own colours come from litfass as --litfass-* variables -->
		<div
			class="relative flex aspect-video w-full flex-col items-center justify-center gap-1 rounded-[12px_6px_14px_8px] border-3 border-ink bg-(--litfass-bg,var(--color-banner-slate)) p-3 text-(--litfass-fg,var(--color-paper))"
			style={houseAd
				? Object.entries(houseAd.style)
						.map(([name, value]) => `${name}:${value}`)
						.join(';')
				: undefined}
		>
			{#if houseAd}
				<!-- Adverts must be recognisable as such (§ 6 DDG) -->
				<span
					class="absolute start-2 top-1.5 rounded-sm bg-paper/90 px-1.5 text-xs font-bold tracking-wide text-ink uppercase"
				>
					{m.ad_label()}
				</span>
				{#if houseAd.ad.emoji}
					<span class="text-4xl leading-none" aria-hidden="true">{houseAd.ad.emoji}</span>
				{/if}
				<span class="font-display text-xl leading-tight font-bold">{houseAd.text.title}</span>
				<span class="text-sm leading-snug">{houseAd.text.body}</span>
				<button
					type="button"
					class="btn-chunky mt-1 bg-(--litfass-accent,var(--color-paper)) px-3 py-1 text-sm text-(--litfass-bg,var(--color-ink))"
					onclick={() => houseAd && openHouseAd(houseAd)}
				>
					<IconExternalLink class="size-4" aria-hidden="true" />
					{houseAd.text.cta}
				</button>
			{:else}
				<IconTv class="size-10" stroke-width="2.5" aria-hidden="true" />
				<span class="font-display text-xl font-bold">{m.ad_demo()}</span>
			{/if}
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
			{claimLabel ?? m.ad_claim({ coins })}
		</button>
		<button type="button" class="btn-chunky px-3 py-1 text-sm" onclick={close}>
			{m.ad_close()}
		</button>
		{#if claimed}
			<p role="status" class="text-sm font-bold text-khaki">{m.ad_done()}</p>
		{/if}
	</div>
</dialog>
