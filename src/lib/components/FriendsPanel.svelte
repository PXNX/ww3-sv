<!--
	Friends on the profile: who the player's friends are and who of them is online or in a raid.
	Only that, plus a button to share the invite link, which is how a friend is added. Squads exist in
	the raid alone, so inviting someone to one is done in the raid lobby, and the referral card on the
	profile explains what the same link earns.
	Friends are the bot's own (people who joined through the player's referral link or through a
	squad link), so outside Telegram the panel only points the way there.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { inviteShareUrl, openTelegramLink } from '#lib/services/telegram.js';
	import { squad } from '#lib/stores/squad.svelte.js';
	import { telegram } from '#lib/stores/telegram.svelte.js';
	import SquadAvatar from './SquadAvatar.svelte';
	import IconSend from '~icons/lucide/send';
	import IconSwords from '~icons/lucide/swords';
	import IconUsers from '~icons/lucide/users';

	const store = squad();
	const account = telegram();

	// The squad line is what tells the player who is online, so it is kept open while the panel is
	onMount(() => {
		store.start();
		return () => store.stop();
	});
</script>

<section
	class="flex flex-col gap-3 rounded-2xl bg-linear-to-br from-[#3b2470] to-[#24164a] p-3 text-white shadow-[0_4px_0_rgb(0_0_0/0.3)] sm:p-4"
	aria-labelledby="friends-title"
>
	<header class="flex items-center gap-2">
		<span
			class="flex size-8 -skew-x-6 items-center justify-center rounded-md bg-[#22c3b0] shadow-[0_2px_0_rgb(0_0_0/0.25)]"
		>
			<IconUsers class="size-5" aria-hidden="true" />
		</span>
		<h2
			id="friends-title"
			class="font-display text-2xl leading-none font-black uppercase italic drop-shadow-[0_2px_0_rgb(0_0_0/0.3)]"
		>
			{m.friends_title()}
		</h2>
		{#if store.availability === 'ready' && store.friends.length > 0}
			<span
				class="ms-auto flex items-center gap-1.5 rounded-full bg-black/25 px-2.5 py-0.5 font-display text-xs font-bold"
			>
				<span class="size-2 rounded-full bg-[#3ddc84]" aria-hidden="true"></span>
				{m.friends_online_count({ count: store.onlineFriends.length })}
			</span>
		{/if}
	</header>

	{#if store.loading && store.availability !== 'ready'}
		<p class="text-sm font-semibold opacity-80">{m.friends_loading()}</p>
	{:else if store.availability !== 'ready'}
		<div class="flex flex-wrap items-center gap-3">
			<p dir="auto" class="min-w-0 flex-1 text-sm leading-snug font-semibold">
				{store.availability === 'signed-out' ? m.friends_signed_out() : m.friends_unavailable()}
			</p>
			{#if !account.inTelegram}
				<a
					href="https://t.me/game_ww3_bot"
					target="_blank"
					rel="noopener"
					class="flex -skew-x-6 items-center gap-1.5 rounded-lg border-b-4 border-[#0f7f73] bg-[#22c3b0] px-3 py-1.5 font-display text-sm font-black uppercase italic shadow-[0_3px_0_rgb(0_0_0/0.25)] active:translate-y-0.5"
				>
					<IconSend class="size-4" aria-hidden="true" />
					{m.profile_telegram_open()}
				</a>
			{/if}
		</div>
	{:else}
		{#if store.mode === 'local'}
			<p class="rounded-lg bg-black/25 px-2 py-1 text-xs font-semibold opacity-80">
				{m.friends_dev_note()}
			</p>
		{/if}

		{#if store.friends.length === 0}
			<div class="flex flex-col gap-1 rounded-xl bg-black/20 p-3">
				<p dir="auto" class="text-sm leading-snug font-semibold">{m.friends_empty()}</p>
				<p dir="auto" class="text-xs leading-snug font-semibold opacity-80">
					{m.friends_how_added()}
				</p>
			</div>
		{:else}
			<ul class="grid gap-1.5 sm:grid-cols-2">
				{#each store.friends as friend (friend.id)}
					<li
						class="flex items-center gap-2.5 rounded-xl px-2 py-1.5 {friend.online
							? 'bg-[#2a1a52]/85'
							: 'bg-[#2a1a52]/45'}"
					>
						<SquadAvatar
							id={friend.id}
							name={friend.name}
							photoUrl={friend.photoUrl}
							online={friend.online}
							size={38}
						/>
						<span class="flex min-w-0 flex-1 flex-col">
							<span
								dir="auto"
								class="truncate leading-tight font-bold {friend.online ? '' : 'opacity-70'}"
								>{friend.name}</span
							>
							{#if friend.online && friend.inRaid}
								<span
									class="flex w-fit -skew-x-6 items-center gap-1 rounded bg-[#ffd23a] px-1.5 font-display text-[0.7rem] font-black text-[#3b2470] uppercase italic"
								>
									<IconSwords class="size-3" aria-hidden="true" />
									{m.friends_status_in_raid()}
								</span>
							{:else}
								<span
									class="text-xs font-semibold {friend.online ? 'text-[#3ddc84]' : 'opacity-60'}"
								>
									{friend.online ? m.friends_status_online() : m.friends_status_offline()}
								</span>
							{/if}
						</span>
					</li>
				{/each}
			</ul>
		{/if}

		<!-- Adding a friend: share the invite link, whoever joins through it becomes a friend -->
		{#if account.invite}
			{@const link = account.invite}
			<div class="flex flex-wrap items-center gap-2 rounded-xl bg-black/20 p-2.5">
				<p dir="auto" class="min-w-0 flex-1 text-xs leading-snug font-semibold opacity-90">
					{m.friends_invite_hint()}
				</p>
				<button
					type="button"
					class="flex shrink-0 -skew-x-6 items-center gap-1.5 rounded-lg border-b-4 border-[#b84300] bg-linear-to-b from-[#ff9a3c] to-[#ff6a10] px-3 py-1.5 font-display text-sm font-black uppercase italic shadow-[0_3px_0_rgb(0_0_0/0.25)] active:translate-y-0.5"
					onclick={() => openTelegramLink(inviteShareUrl(link, m.profile_invite_text()))}
				>
					<IconSend class="size-4" aria-hidden="true" />
					{m.friends_invite_button()}
				</button>
			</div>
		{/if}
	{/if}
</section>
