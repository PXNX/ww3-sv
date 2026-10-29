<!--
	The supply depot. A short wallet strip on top, then one card per thing the player can get:
	revival tokens (with every way to pay in one place: Fake News, a crate of five, or Telegram Stars
	inside the Mini App), the Pro subscription (Stars), free Fake News from the sponsor break, and a
	gift code. Outside Telegram the Stars offers are replaced by one note that points to Telegram.
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { APP_NAME } from '#lib/config.js';
	import {
		AD_COINS,
		ADS_PER_DAY,
		REVIVE_COST,
		REVIVE_PACK_COST,
		REVIVE_PACK_SIZE
	} from '#lib/game/career/config.js';
	import { career } from '#lib/game/career/store.svelte.js';
	import { m } from '#lib/paraglide/messages.js';
	import { soundManager } from '#lib/sound/soundManager.svelte.js';
	import GiftCodeCard from '#lib/components/GiftCodeCard.svelte';
	import RewardedAdModal from '#lib/components/RewardedAdModal.svelte';
	import StarsOffer from '#lib/components/StarsOffer.svelte';
	import { telegram } from '#lib/stores/telegram.svelte.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import IconArrowLeft from '~icons/lucide/arrow-left';
	import IconHeartPulse from '~icons/lucide/heart-pulse';
	import IconNewspaper from '~icons/lucide/newspaper';
	import IconSend from '~icons/lucide/send';
	import IconSparkles from '~icons/lucide/sparkles';
	import IconStar from '~icons/lucide/star';
	import IconTv from '~icons/lucide/tv';

	const careerState = career();
	const account = telegram();

	const verified = $derived(account.status === 'verified');
	// Earned on this device plus bought with Stars, which live on the Telegram account
	const revives = $derived(careerState.profile.revives + (verified ? account.wallet.revives : 0));
	const proDate = $derived(
		account.proUntil
			? new Date(account.proUntil).toLocaleDateString(getLocale(), { dateStyle: 'medium' })
			: ''
	);

	let adOpen = $state(false);
	let notice = $state<{ text: string; ok: boolean } | null>(null);

	const singleAffordable = $derived(careerState.profile.coins >= REVIVE_COST);
	const packAffordable = $derived(careerState.profile.coins >= REVIVE_PACK_COST);

	function buy(count: number) {
		if (careerState.buyRevives(count)) {
			soundManager().play('chime-big');
			notice = { text: m.shop_bought(), ok: true };
		} else {
			soundManager().play('ui-error');
			notice = { text: m.shop_not_enough(), ok: false };
		}
	}

	function claimAd() {
		const result = careerState.watchAd(AD_COINS);
		adOpen = false;
		notice = result.watched
			? { text: m.shop_ad_done({ coins: result.coins }), ok: true }
			: { text: m.shop_ad_limit(), ok: false };
		if (result.watched) soundManager().play('chime-big');
	}
</script>

<svelte:head>
	<title>{m.shop_title()} | {APP_NAME}</title>
</svelte:head>

<main
	class="mx-auto flex max-w-2xl flex-col gap-5 px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(3rem+env(safe-area-inset-bottom))]"
>
	<div class="flex items-center gap-2">
		<a href={resolve('/')} class="btn-chunky px-3 py-1 text-sm">
			<IconArrowLeft class="size-4 rtl:rotate-180" aria-hidden="true" />
			{m.game_back()}
		</a>
	</div>

	<div class="flex flex-col items-center gap-2 text-center">
		<h1
			class="inline-block rounded-[16px_8px_14px_10px] border-3 border-ink bg-banner-slate px-4 py-2 text-3xl font-bold text-paper shadow-[4px_4px_0_var(--color-ink)] sm:text-4xl"
		>
			{m.shop_title()}
		</h1>
		<p class="max-w-xl text-sm leading-snug">{m.shop_intro()}</p>
	</div>

	<!-- The wallet: what there is to spend and what it buys -->
	<div class="grid grid-cols-2 gap-3">
		<div
			class="flex items-center gap-2 rounded-2xl border-3 border-ink bg-explosion-yellow px-3 py-2 shadow-[3px_3px_0_var(--color-ink)]"
		>
			<IconNewspaper class="size-6 shrink-0" aria-hidden="true" />
			<span class="font-display text-lg leading-tight font-bold tabular-nums">
				{m.career_coins({ count: careerState.profile.coins })}
			</span>
		</div>
		<div
			class="flex items-center gap-2 rounded-2xl border-3 border-ink bg-paper px-3 py-2 shadow-[3px_3px_0_var(--color-ink)]"
		>
			<IconHeartPulse class="size-6 shrink-0 text-tie-red" aria-hidden="true" />
			<span class="font-display text-lg leading-tight font-bold tabular-nums">
				{m.career_revives({ count: revives })}
			</span>
		</div>
	</div>

	{#if notice}
		<p
			role="status"
			class="pop-in self-center rounded-xl border-3 border-ink px-3 py-1 text-sm font-bold {notice.ok
				? 'bg-khaki text-paper'
				: 'bg-tie-red text-paper'}"
		>
			{notice.text}
		</p>
	{/if}

	<!-- Revival tokens: described once, every way to get them as a row -->
	<section class="sticker flex flex-col gap-3 p-4" aria-labelledby="shop-revive">
		<h2 id="shop-revive" class="flex items-center gap-2 font-display text-xl font-bold">
			<IconHeartPulse class="size-5 text-tie-red" aria-hidden="true" />
			{m.shop_revive_name()}
		</h2>
		<p class="text-sm leading-snug">{m.shop_revive_body()}</p>

		<ul class="flex flex-col gap-2">
			<li class="flex items-center gap-3 rounded-xl border-2 border-ink bg-sand/70 px-3 py-2">
				<span class="min-w-0 flex-1 font-bold" dir="ltr">×1</span>
				<button
					type="button"
					class="btn-chunky bg-khaki px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-55"
					disabled={!singleAffordable}
					onclick={() => buy(1)}
				>
					<IconNewspaper class="size-4" aria-hidden="true" />
					{m.shop_buy({ cost: m.career_coins({ count: REVIVE_COST }) })}
				</button>
			</li>
			<li class="flex items-center gap-3 rounded-xl border-2 border-ink bg-sand/70 px-3 py-2">
				<span class="flex min-w-0 flex-1 flex-col">
					<span class="font-bold">{m.shop_pack_name()}</span>
					<span class="text-xs leading-snug opacity-75">{m.shop_pack_body()}</span>
				</span>
				<button
					type="button"
					class="btn-chunky bg-explosion-yellow px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-55"
					disabled={!packAffordable}
					onclick={() => buy(REVIVE_PACK_SIZE)}
				>
					<IconNewspaper class="size-4" aria-hidden="true" />
					{m.shop_pack_buy({
						count: REVIVE_PACK_SIZE,
						cost: m.career_coins({ count: REVIVE_PACK_COST })
					})}
				</button>
			</li>
			{#if verified && account.reviveItem}
				<li class="flex flex-col gap-2 rounded-xl border-2 border-ink bg-sand/70 px-3 py-2">
					<span class="flex items-center gap-1.5 font-bold">
						<IconStar class="size-4 text-mustard" aria-hidden="true" />
						{m.stars_title()}
					</span>
					<StarsOffer item={account.reviveItem} />
					<span class="text-xs leading-snug opacity-75">{m.stars_intro()}</span>
				</li>
			{/if}
		</ul>
		{#if !singleAffordable}
			<p class="text-xs font-semibold text-tie-red">{m.shop_not_enough()}</p>
		{/if}
	</section>

	<!-- Pro, or the one note about Telegram Stars when they cannot be used here -->
	{#if verified}
		{#if account.proItem}
			<section class="sticker flex flex-col gap-3 p-4" aria-labelledby="shop-pro">
				<h2 id="shop-pro" class="flex items-center gap-2 font-display text-xl font-bold">
					<IconSparkles class="size-5 text-mustard" aria-hidden="true" />
					{m.shop_pro_name()}
				</h2>
				<p class="text-sm leading-snug">{m.shop_pro_body()}</p>
				{#if account.pro}
					<p
						class="rounded-xl border-2 border-ink bg-khaki px-2 py-1 text-center text-sm font-bold text-paper"
					>
						{m.stars_pro_active({ date: proDate })}
					</p>
				{:else}
					<StarsOffer item={account.proItem} />
				{/if}
				<p class="text-xs leading-snug opacity-70">{m.stars_pro_renews()}</p>
			</section>
		{/if}
	{:else}
		<section class="sticker flex flex-col gap-3 p-4" aria-labelledby="shop-stars">
			<h2 id="shop-stars" class="flex items-center gap-2 font-display text-xl font-bold">
				<IconStar class="size-5 text-mustard" aria-hidden="true" />
				{m.stars_title()}
			</h2>
			{#if account.status === 'checking'}
				<p class="text-sm font-semibold opacity-70">{m.profile_telegram_checking()}</p>
			{:else if account.inTelegram}
				<p class="text-sm font-semibold text-tie-red">{m.stars_unavailable()}</p>
				<button
					type="button"
					class="btn-chunky self-start bg-paper"
					onclick={() => account.refresh()}
				>
					{m.profile_telegram_retry()}
				</button>
			{:else}
				<p class="text-sm leading-snug">{m.profile_telegram_browser()}</p>
				<a
					href="https://t.me/game_ww3_bot?startapp=shop"
					class="btn-chunky self-start bg-flag-blue"
				>
					<IconSend class="size-5" aria-hidden="true" />
					{m.profile_telegram_open()}
				</a>
			{/if}
		</section>
	{/if}

	<!-- Free Fake News -->
	<section class="sticker flex flex-col gap-3 p-4" aria-labelledby="shop-ad">
		<h2 id="shop-ad" class="flex items-center gap-2 font-display text-xl font-bold">
			<IconTv class="size-5" aria-hidden="true" />
			{m.shop_ad_name()}
		</h2>
		<p class="text-sm leading-snug">
			{m.shop_ad_body({ coins: AD_COINS, left: careerState.adsLeft, max: ADS_PER_DAY })}
		</p>
		{#if careerState.adsLeft > 0}
			<button
				type="button"
				class="btn-chunky self-start bg-flag-blue"
				onclick={() => (adOpen = true)}
			>
				<IconTv class="size-5" aria-hidden="true" />
				{m.shop_ad_button()}
			</button>
		{:else}
			<p
				class="rounded-xl border-2 border-dashed border-ink/50 px-3 py-1 text-center text-sm font-bold opacity-70"
			>
				{m.shop_ad_limit()}
			</p>
		{/if}
	</section>

	<GiftCodeCard />

	<p class="text-center text-xs leading-snug opacity-75">{m.shop_demo()}</p>
</main>

<RewardedAdModal
	open={adOpen}
	coins={AD_COINS}
	onClaim={claimAd}
	onClose={() => (adOpen = false)}
/>
