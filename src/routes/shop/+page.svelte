<!--
	The supply depot: spend the coins every finished run pays out. Revivals keep a crashed run alive,
	the sponsor break tops the wallet up once a day. Inside the Telegram Mini App a second shelf sells
	revival tokens and Pro for Telegram Stars through the bot; in a normal browser it only points to
	Telegram, because Stars can only be paid there.
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
	import CareerBar from '#lib/components/CareerBar.svelte';
	import RewardedAdModal from '#lib/components/RewardedAdModal.svelte';
	import StarsOffer from '#lib/components/StarsOffer.svelte';
	import { telegram } from '#lib/stores/telegram.svelte.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import IconArrowLeft from '~icons/lucide/arrow-left';
	import IconHeartPulse from '~icons/lucide/heart-pulse';
	import IconNewspaper from '~icons/lucide/newspaper';
	import IconPackage from '~icons/lucide/package';
	import IconSettings from '~icons/lucide/settings';
	import IconSend from '~icons/lucide/send';
	import IconSparkles from '~icons/lucide/sparkles';
	import IconStar from '~icons/lucide/star';
	import IconTv from '~icons/lucide/tv';

	const careerState = career();
	const account = telegram();

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
	class="mx-auto flex max-w-3xl flex-col gap-6 px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(3rem+env(safe-area-inset-bottom))]"
>
	<div class="flex items-center justify-between gap-2">
		<a href={resolve('/')} class="btn-chunky px-3 py-1 text-sm">
			<IconArrowLeft class="size-4 rtl:rotate-180" aria-hidden="true" />
			{m.game_back()}
		</a>
		<a
			href={resolve('/settings')}
			class="btn-chunky size-9 rounded-full p-0"
			aria-label={m.settings_title()}
			title={m.settings_title()}
		>
			<IconSettings class="size-4" aria-hidden="true" />
		</a>
	</div>

	<div class="flex flex-col items-center gap-2 text-center">
		<h1
			class="pop-in inline-block -rotate-1 rounded-[16px_8px_14px_10px] border-3 border-ink bg-banner-slate px-4 py-2 text-3xl font-bold text-paper shadow-[4px_4px_0_var(--color-ink)] sm:text-4xl"
		>
			{m.shop_title()}
		</h1>
		<p class="max-w-xl text-sm leading-snug">{m.shop_intro()}</p>
	</div>

	<CareerBar />

	{#if notice}
		<p
			role="status"
			class="pop-in self-center rounded-[10px_5px_9px_6px] border-3 border-ink px-3 py-1 text-sm font-bold {notice.ok
				? 'bg-khaki text-paper'
				: 'bg-tie-red text-paper'}"
		>
			{notice.text}
		</p>
	{/if}

	<div class="grid gap-5 sm:grid-cols-2">
		<section class="sticker flex flex-col gap-3 p-4" style:--tilt="0.8deg">
			<h2 class="flex items-center gap-2 font-display text-xl font-bold">
				<IconHeartPulse class="size-5 text-tie-red" aria-hidden="true" />
				{m.shop_revive_name()}
			</h2>
			<p class="text-sm leading-snug">{m.shop_revive_body()}</p>
			<button
				type="button"
				class="btn-chunky mt-auto bg-khaki disabled:cursor-not-allowed disabled:opacity-55"
				disabled={!singleAffordable}
				onclick={() => buy(1)}
			>
				<IconNewspaper class="size-4" aria-hidden="true" />
				{m.shop_buy({ cost: m.career_coins({ count: REVIVE_COST }) })}
			</button>
			{#if !singleAffordable}
				<p class="text-center text-xs font-semibold text-tie-red">{m.shop_not_enough()}</p>
			{/if}
		</section>

		<section class="sticker flex flex-col gap-3 p-4" style:--tilt="-1.1deg">
			<h2 class="flex items-center gap-2 font-display text-xl font-bold">
				<IconPackage class="size-5" aria-hidden="true" />
				{m.shop_pack_name()}
			</h2>
			<p class="text-sm leading-snug">{m.shop_pack_body()}</p>
			<button
				type="button"
				class="btn-chunky mt-auto bg-explosion-yellow disabled:cursor-not-allowed disabled:opacity-55"
				disabled={!packAffordable}
				onclick={() => buy(REVIVE_PACK_SIZE)}
			>
				<IconNewspaper class="size-4" aria-hidden="true" />
				{m.shop_pack_buy({
					count: REVIVE_PACK_SIZE,
					cost: m.career_coins({ count: REVIVE_PACK_COST })
				})}
			</button>
			{#if !packAffordable}
				<p class="text-center text-xs font-semibold text-tie-red">{m.shop_not_enough()}</p>
			{/if}
		</section>
	</div>

	<section class="sticker flex flex-col gap-3 bg-sand p-4" style:--tilt="0.4deg">
		<h2 class="flex items-center gap-2 font-display text-xl font-bold">
			<IconTv class="size-5" aria-hidden="true" />
			{m.shop_ad_name()}
		</h2>
		<p class="text-sm leading-snug">
			{m.shop_ad_body({
				coins: AD_COINS,
				left: careerState.adsLeft,
				max: ADS_PER_DAY
			})}
		</p>
		{#if careerState.adsLeft > 0}
			<button type="button" class="btn-chunky bg-flag-blue" onclick={() => (adOpen = true)}>
				<IconTv class="size-5" aria-hidden="true" />
				{m.shop_ad_button()}
			</button>
		{:else}
			<p
				class="rounded-md border-2 border-dashed border-ink/50 px-3 py-1 text-center text-sm font-bold opacity-70"
			>
				{m.shop_ad_limit()}
			</p>
		{/if}
	</section>

	<section class="sticker flex flex-col gap-3 bg-paper p-4" style:--tilt="-0.5deg">
		<h2 class="flex items-center gap-2 font-display text-xl font-bold">
			<IconStar class="size-5 text-mustard" aria-hidden="true" />
			{m.stars_title()}
		</h2>
		<p class="text-sm leading-snug">{m.stars_intro()}</p>

		{#if account.status === 'verified'}
			<p class="flex items-center gap-1.5 text-sm font-bold">
				<IconHeartPulse class="size-4 text-tie-red" aria-hidden="true" />
				{m.stars_owned({ count: account.wallet.revives })}
			</p>
			<div class="grid gap-3 sm:grid-cols-2">
				{#if account.reviveItem}
					<div
						class="flex flex-col gap-2 rounded-[12px_6px_14px_8px] border-3 border-ink bg-sand/70 p-3"
					>
						<span class="flex items-center gap-1.5 font-bold">
							<IconHeartPulse class="size-5 text-tie-red" aria-hidden="true" />
							{m.shop_revive_name()}
						</span>
						<span class="text-xs leading-snug">{m.shop_revive_body()}</span>
						<StarsOffer item={account.reviveItem} />
					</div>
				{/if}
				{#if account.proItem}
					<div
						class="flex flex-col gap-2 rounded-[12px_6px_14px_8px] border-3 border-ink bg-sand/70 p-3"
					>
						<span class="flex items-center gap-1.5 font-bold">
							<IconSparkles class="size-5 text-mustard" aria-hidden="true" />
							{m.shop_pro_name()}
						</span>
						<span class="text-xs leading-snug">{m.shop_pro_body()}</span>
						{#if account.pro}
							<p
								class="rounded-md border-2 border-ink bg-khaki px-2 py-1 text-center text-sm font-bold text-paper"
							>
								{m.stars_pro_active({ date: proDate })}
							</p>
						{:else}
							<StarsOffer item={account.proItem} />
						{/if}
						<span class="text-[0.7rem] leading-snug opacity-70">{m.stars_pro_renews()}</span>
					</div>
				{/if}
			</div>
		{:else if account.status === 'checking'}
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
			<a href="https://t.me/game_ww3_bot?startapp=shop" class="btn-chunky self-start bg-flag-blue">
				<IconSend class="size-5" aria-hidden="true" />
				{m.profile_telegram_open()}
			</a>
		{/if}
	</section>

	<p class="text-center text-xs leading-snug opacity-75">{m.shop_demo()}</p>
</main>

<RewardedAdModal
	open={adOpen}
	coins={AD_COINS}
	onClaim={claimAd}
	onClose={() => (adOpen = false)}
/>
