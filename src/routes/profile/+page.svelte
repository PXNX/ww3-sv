<!--
	The player's profile: the agent big and editable, the career at a glance, and the Telegram
	account when the game runs as a Mini App. The Telegram card shows the account the Mini App was
	opened with right away (name and photo), and what the player bought once the bot confirmed it;
	buying happens elsewhere.
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { APP_NAME } from '#lib/config.js';
	import { career } from '#lib/game/career/store.svelte.js';
	import { m } from '#lib/paraglide/messages.js';
	import { telegram } from '#lib/stores/telegram.svelte.js';
	import AvatarEditor from '#lib/components/AvatarEditor.svelte';
	import CareerBar from '#lib/components/CareerBar.svelte';
	import LocaleSwitcher from '#lib/components/LocaleSwitcher.svelte';
	import SoundToggle from '#lib/components/SoundToggle.svelte';
	import IconArrowLeft from '~icons/lucide/arrow-left';
	import IconBadgeCheck from '~icons/lucide/badge-check';
	import IconFlame from '~icons/lucide/flame';
	import IconGamepad from '~icons/lucide/gamepad-2';
	import IconHeartPulse from '~icons/lucide/heart-pulse';
	import IconNewspaper from '~icons/lucide/newspaper';
	import IconRefresh from '~icons/lucide/refresh-cw';
	import IconSend from '~icons/lucide/send';

	const careerState = career();
	const session = telegram();

	const displayName = $derived.by(() => {
		const user = session.user;
		if (!user) return '';
		return user.username ? `@${user.username}` : user.firstName;
	});
	const proUntil = $derived.by(() => {
		const until = session.proUntil ? new Date(session.proUntil) : null;
		return until && Number.isFinite(until.getTime()) ? until.toLocaleDateString() : null;
	});
</script>

<svelte:head>
	<title>{m.profile_title()} | {APP_NAME}</title>
</svelte:head>

<main
	class="mx-auto flex max-w-3xl flex-col gap-6 px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(3rem+env(safe-area-inset-bottom))]"
>
	<div class="flex items-center justify-between gap-2">
		<a href={resolve('/')} class="btn-chunky px-3 py-1 text-sm">
			<IconArrowLeft class="size-4 rtl:rotate-180" aria-hidden="true" />
			{m.game_back()}
		</a>
		<div class="flex gap-2">
			<SoundToggle />
			<LocaleSwitcher />
		</div>
	</div>

	<h1
		class="inline-block self-start rounded-[16px_8px_14px_10px] border-3 border-ink bg-banner-slate px-4 py-2 text-3xl font-bold text-paper shadow-[4px_4px_0_var(--color-ink)]"
	>
		{m.profile_title()}
	</h1>

	<section class="sticker flex flex-col gap-3 p-4" style:--tilt="-0.4deg">
		<h2 class="font-display text-xl font-bold">{m.avatar_title()}</h2>
		<AvatarEditor large />
	</section>

	<CareerBar />

	<section class="sticker grid grid-cols-2 gap-2 bg-sand p-4 sm:grid-cols-4" style:--tilt="0.5deg">
		<h2 class="col-span-full font-display text-xl font-bold">{m.profile_stats()}</h2>
		{#each [{ icon: IconGamepad, label: m.profile_runs(), value: careerState.profile.runs }, { icon: IconFlame, label: m.profile_streak(), value: careerState.profile.streak }, { icon: IconNewspaper, label: m.profile_coins(), value: careerState.profile.coins }, { icon: IconHeartPulse, label: m.profile_revives(), value: careerState.profile.revives }] as stat (stat.label)}
			{@const Icon = stat.icon}
			<div
				class="flex flex-col items-center gap-0.5 rounded-[10px_5px_9px_6px] border-2 border-ink bg-paper px-2 py-2 text-center"
			>
				<Icon class="size-5" aria-hidden="true" />
				<span class="font-display text-2xl leading-none font-bold tabular-nums">{stat.value}</span>
				<span class="text-xs font-semibold opacity-70">{stat.label}</span>
			</div>
		{/each}
	</section>

	<section class="sticker flex flex-col gap-2 p-4" style:--tilt="-0.3deg">
		<h2 class="flex items-center gap-2 font-display text-xl font-bold">
			<IconSend class="size-5 text-flag-blue" aria-hidden="true" />
			{m.profile_telegram()}
		</h2>

		{#if session.user}
			<div class="flex items-center gap-3">
				{#if session.user.photoUrl}
					<img
						src={session.user.photoUrl}
						alt=""
						class="size-12 shrink-0 rounded-full border-2 border-ink object-cover"
						referrerpolicy="no-referrer"
					/>
				{:else}
					<span
						class="grid size-12 shrink-0 place-items-center rounded-full border-2 border-ink bg-flag-blue font-display text-xl font-bold text-paper"
						aria-hidden="true">{session.user.firstName.slice(0, 1).toUpperCase()}</span
					>
				{/if}
				<p class="flex items-center gap-1.5 font-bold">
					{#if session.status === 'verified'}
						<IconBadgeCheck class="size-5 shrink-0 text-khaki" aria-hidden="true" />
					{/if}
					{m.profile_telegram_signed_in({ name: displayName })}
				</p>
			</div>
		{/if}

		{#if session.status === 'verified'}
			<p class="text-sm">{m.profile_telegram_wallet({ revives: session.wallet.revives })}</p>
			{#if session.pro}
				<p class="text-sm font-bold">
					{proUntil ? m.profile_telegram_pro_until({ date: proUntil }) : m.profile_telegram_pro()}
				</p>
			{/if}
		{:else if session.status === 'checking'}
			<p class="text-sm opacity-80">{m.profile_telegram_checking()}</p>
		{:else if session.status === 'rejected' || session.status === 'error'}
			<p class="text-sm">
				{session.status === 'rejected'
					? m.profile_telegram_rejected()
					: m.profile_telegram_offline()}
			</p>
			<button
				type="button"
				class="btn-chunky self-start px-3 py-1 text-sm"
				onclick={() => session.refresh()}
			>
				<IconRefresh class="size-4" aria-hidden="true" />
				{m.profile_telegram_retry()}
			</button>
		{:else}
			<p class="text-sm leading-relaxed">{m.profile_telegram_browser()}</p>
			<a
				href="https://t.me/game_ww3_bot?startapp=profile"
				target="_blank"
				rel="noopener"
				class="btn-chunky self-start bg-flag-blue px-3 py-1 text-sm"
			>
				<IconSend class="size-4" aria-hidden="true" />
				{m.profile_telegram_open()}
			</a>
		{/if}
		<p class="text-xs opacity-70">{m.profile_local_note()}</p>
	</section>
</main>
