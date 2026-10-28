<!--
	Friends on the start screen: invites the player received (joining leads to the raid lobby), the
	current squad, and the friends list with who is online or in a raid and a button to invite
	each online friend to the raid. Friends are the bot's own (people who joined through the
	player's invite link), so outside Telegram the panel only points the way there.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { inviteShareUrl, openTelegramLink } from '#lib/services/telegram.js';
	import { SQUAD_SIZE } from '#lib/services/squad.js';
	import { squad } from '#lib/stores/squad.svelte.js';
	import { telegram } from '#lib/stores/telegram.svelte.js';
	import RaidSquadPanel from './RaidSquadPanel.svelte';
	import SquadAvatar from './SquadAvatar.svelte';
	import SquadInviteCard from './SquadInviteCard.svelte';
	import { squadResultText } from './squadText';
	import IconCheck from '~icons/lucide/check';
	import IconHourglass from '~icons/lucide/hourglass';
	import IconSend from '~icons/lucide/send';
	import IconSwords from '~icons/lucide/swords';
	import IconUserPlus from '~icons/lucide/user-plus';
	import IconUsers from '~icons/lucide/users';

	const store = squad();
	const account = telegram();

	onMount(() => {
		store.start();
		store.inviteSurfaces += 1;
		return () => {
			store.inviteSurfaces -= 1;
			store.stop();
		};
	});

	let notice = $state<string | null>(null);
	let noticeTimer: ReturnType<typeof setTimeout> | undefined;

	function say(text: string | null) {
		clearTimeout(noticeTimer);
		notice = text;
		if (text) noticeTimer = setTimeout(() => (notice = null), 4000);
	}

	async function invite(friendId: string) {
		say(squadResultText(await store.invite(friendId)));
	}
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
			<p class="rounded-lg bg-black/25 px-2 py-1 text-[11px] font-semibold opacity-80">
				{m.friends_dev_note()}
			</p>
		{/if}

		{#each store.pendingInvites as squadInvite (squadInvite.id)}
			<SquadInviteCard invite={squadInvite} onnotice={say} />
		{/each}

		<!-- The squad: who is in, who is invited, room for more -->
		<div class="flex flex-col gap-1">
			<span class="font-display text-xs font-black uppercase italic opacity-80">
				{m.squad_count({ count: store.members.length, max: SQUAD_SIZE })}
				{#if !store.squad && store.outgoing.length === 0}
					<span class="ms-1 font-sans font-semibold normal-case not-italic opacity-90"
						>· {m.squad_alone()}</span
					>
				{/if}
			</span>
			<RaidSquadPanel invites={false} />
		</div>

		{#if store.friends.length === 0}
			<div class="flex flex-wrap items-center gap-3 rounded-xl bg-black/20 p-3">
				<p dir="auto" class="min-w-0 flex-1 text-sm leading-snug font-semibold">
					{m.friends_empty()}
				</p>
				{#if account.invite}
					{@const link = account.invite}
					<button
						type="button"
						class="flex -skew-x-6 items-center gap-1.5 rounded-lg border-b-4 border-[#b84300] bg-linear-to-b from-[#ff9a3c] to-[#ff6a10] px-3 py-1.5 font-display text-sm font-black uppercase italic shadow-[0_3px_0_rgb(0_0_0/0.25)] active:translate-y-0.5"
						onclick={() => openTelegramLink(inviteShareUrl(link, m.profile_invite_text()))}
					>
						<IconSend class="size-4" aria-hidden="true" />
						{m.profile_invite_share()}
					</button>
				{/if}
			</div>
		{:else}
			<ul class="grid gap-1.5 sm:grid-cols-2">
				{#each store.friends as friend (friend.id)}
					{@const member = store.isMember(friend.id)}
					{@const invited = store.invited(friend.id)}
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
									class="flex w-fit -skew-x-6 items-center gap-1 rounded bg-[#ffd23a] px-1.5 font-display text-[10px] font-black text-[#3b2470] uppercase italic"
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
						{#if member}
							<span
								class="flex items-center gap-1 font-display text-[11px] font-black text-[#22c3b0] uppercase italic"
							>
								<IconCheck class="size-4 stroke-[3]" aria-hidden="true" />
								{m.friends_in_squad()}
							</span>
						{:else if invited}
							<span
								class="flex items-center gap-1 font-display text-[11px] font-black uppercase italic opacity-85"
							>
								<IconHourglass class="size-3.5" aria-hidden="true" />
								{m.friends_invited()}
							</span>
						{:else}
							<button
								type="button"
								class="flex shrink-0 -skew-x-6 items-center gap-1 rounded-md border-b-4 border-[#0f7f73] bg-[#22c3b0] px-2.5 py-1 font-display text-xs font-black uppercase italic shadow-[0_2px_0_rgb(0_0_0/0.25)] active:translate-y-0.5 disabled:border-black/20 disabled:bg-white/15 disabled:text-white/60 disabled:shadow-none"
								disabled={!store.canInvite(friend)}
								title={store.isFull ? m.squad_full() : undefined}
								onclick={() => invite(friend.id)}
							>
								<IconUserPlus class="size-4 stroke-[2.5]" aria-hidden="true" />
								{m.friends_invite()}
							</button>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}

		{#if notice}
			<p role="status" dir="auto" class="text-sm font-bold text-[#ffd23a]">{notice}</p>
		{/if}
	{/if}
</section>
