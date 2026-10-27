<!--
	One thing sold for Telegram Stars, with the consent German law asks for before digital goods are
	delivered at once. The consent box only shows until the player has agreed to the current terms;
	its wording comes from the bot in German, because that is the text that is stored. The purchase
	itself is granted by the bot, so the button waits for the wallet to change before saying thanks.
-->
<script lang="ts">
	import type { CatalogueItem } from '#lib/services/telegram.js';
	import { telegram, type PurchaseResult } from '#lib/stores/telegram.svelte.js';
	import { m } from '#lib/paraglide/messages.js';
	import { soundManager } from '#lib/sound/soundManager.svelte.js';
	import IconLoader from '~icons/lucide/loader-circle';
	import IconStar from '~icons/lucide/star';

	interface Props {
		item: CatalogueItem;
		/** Shorter layout for the result sheet */
		compact?: boolean;
		/** Called once the purchase has arrived in the wallet */
		onDone?: () => void;
	}

	let { item, compact = false, onDone }: Props = $props();

	const account = telegram();

	let agreed = $state(false);
	let notice = $state<{ text: string; ok: boolean } | null>(null);

	const needsConsent = $derived(!account.consented && account.consent !== null);

	const NOTICES: Record<PurchaseResult, (() => string) | null> = {
		done: m.stars_done,
		processing: m.stars_processing,
		cancelled: null,
		failed: m.stars_failed,
		consent: m.stars_consent_needed,
		busy: m.stars_busy
	};

	async function buy() {
		if (needsConsent && !agreed) {
			notice = { text: m.stars_consent_needed(), ok: false };
			return;
		}
		notice = null;
		const result = await account.buy(item.sku, agreed);
		const text = NOTICES[result]?.();
		notice = text ? { text, ok: result === 'done' || result === 'processing' } : null;
		if (result === 'done') {
			soundManager().play('chime-big');
			onDone?.();
		} else if (result !== 'cancelled' && result !== 'processing') {
			soundManager().play('ui-error');
		}
	}
</script>

<div class="flex flex-col gap-2" class:text-sm={compact}>
	{#if needsConsent && account.consent}
		<label class="flex items-start gap-2 text-xs leading-snug">
			<input type="checkbox" class="checkbox mt-0.5 checkbox-sm" bind:checked={agreed} />
			<span class="flex flex-col gap-0.5">
				<span class="font-semibold opacity-70">{m.stars_consent_hint()}</span>
				<span lang="de">{account.consent.text}</span>
				<span class="flex flex-wrap gap-x-3">
					{#if account.consent.terms}
						<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- external page -->
						<a href={account.consent.terms} target="_blank" rel="noopener" class="underline">
							{m.stars_terms()}
						</a>
					{/if}
					{#if account.consent.withdrawal}
						<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- external page -->
						<a href={account.consent.withdrawal} target="_blank" rel="noopener" class="underline">
							{m.stars_withdrawal()}
						</a>
					{/if}
				</span>
			</span>
		</label>
	{/if}

	<button
		type="button"
		class="btn-chunky bg-explosion-yellow"
		class:text-sm={compact}
		disabled={account.busy}
		onclick={buy}
	>
		{#if account.busy}
			<IconLoader class="size-5 animate-spin" aria-hidden="true" />
		{:else}
			<IconStar class="size-5" aria-hidden="true" />
		{/if}
		{item.subscription
			? m.stars_subscribe({ stars: item.stars })
			: compact
				? m.gameover_buy_revive({ stars: item.stars })
				: m.stars_buy({ stars: item.stars })}
	</button>

	{#if notice}
		<p
			role="status"
			class="pop-in text-center text-xs font-bold {notice.ok ? 'text-khaki' : 'text-tie-red'}"
		>
			{notice.text}
		</p>
	{/if}
</div>
