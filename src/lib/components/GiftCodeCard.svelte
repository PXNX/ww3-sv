<!--
	Redeem a gift code in the supply depot: a text field and a button. The reward, revival tokens or
	Fake News, goes straight into the wallet; a code works once per device.
-->
<script lang="ts">
	import { career } from '#lib/game/career/store.svelte.js';
	import { accountGiftCode } from '#lib/game/giftcode/config.js';
	import { telegram } from '#lib/stores/telegram.svelte.js';
	import { m } from '#lib/paraglide/messages.js';
	import { soundManager } from '#lib/sound/soundManager.svelte.js';
	import IconGift from '~icons/lucide/gift';

	const careerState = career();
	const account = telegram();
	let busy = $state(false);

	// A gift link opened the app: show what the bot credited, once
	$effect(() => {
		const gift = account.giftNotice;
		if (!gift) return;
		notice =
			gift.status === 'ok'
				? { ok: true, text: m.shop_gift_done_revive({ count: gift.revives }) }
				: { ok: false, text: m.shop_gift_used() };
		account.giftNotice = null;
	});

	/** Inside Telegram an account code goes to the bot, which credits it once per account */
	async function redeemWithAccount(gift: string) {
		busy = true;
		const result = await account.redeemGift(gift);
		busy = false;
		if (result.status === 'ok') {
			code = '';
			soundManager().play('chime-big');
			notice = { ok: true, text: m.shop_gift_done_revive({ count: result.revives }) };
			return;
		}
		soundManager().play('ui-error');
		notice = {
			ok: false,
			text: result.status === 'used' ? m.shop_gift_used() : m.shop_gift_unknown()
		};
	}

	let code = $state('');
	let notice = $state<{ text: string; ok: boolean } | null>(null);

	function redeem(event: SubmitEvent) {
		event.preventDefault();
		const gift = accountGiftCode(code);
		if (gift && account.status === 'verified') {
			void redeemWithAccount(gift);
			return;
		}
		const result = careerState.redeemGift(code);
		if (result.status === 'ok') {
			code = '';
			soundManager().play('chime-big');
			notice = {
				ok: true,
				text:
					result.gift.reward === 'revive'
						? m.shop_gift_done_revive({ count: result.gift.value })
						: m.shop_gift_done_coins({ count: result.gift.value })
			};
			return;
		}
		soundManager().play('ui-error');
		notice = {
			ok: false,
			text:
				result.status === 'used'
					? m.shop_gift_used()
					: result.status === 'expired'
						? m.shop_gift_expired()
						: m.shop_gift_unknown()
		};
	}
</script>

<section class="sticker flex flex-col gap-3 p-4" aria-labelledby="shop-gift">
	<h2 id="shop-gift" class="flex items-center gap-2 font-display text-xl font-bold">
		<IconGift class="size-5 text-flag-blue" aria-hidden="true" />
		{m.shop_gift_title()}
	</h2>
	<p class="text-sm leading-snug">{m.shop_gift_body()}</p>
	<form class="flex gap-2" onsubmit={redeem}>
		<input
			type="text"
			class="input min-w-0 flex-1 font-display text-base tracking-widest uppercase"
			placeholder={m.shop_gift_placeholder()}
			aria-label={m.shop_gift_title()}
			autocomplete="off"
			autocapitalize="characters"
			spellcheck="false"
			bind:value={code}
			oninput={() => (notice = null)}
		/>
		<button type="submit" class="btn-chunky bg-explosion-yellow px-4" disabled={busy || code.trim() === ''}>
			{m.shop_gift_redeem()}
		</button>
	</form>
	{#if notice}
		<p
			role="status"
			class="text-sm font-bold {notice.ok ? 'text-khaki' : 'text-tie-red'}"
			dir="auto"
		>
			{notice.text}
		</p>
	{/if}
</section>
