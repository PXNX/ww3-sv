<!--
	The squad section of the raid lobby: the squad's slots (with invites received and a shared link
	the app was opened with), every online friend with a button to invite them, and a button to
	share a join link in any Telegram chat, for raiders who are not friends yet.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { SQUAD_SIZE } from '#lib/services/squad.js';
	import { squad } from '#lib/stores/squad.svelte.js';
	import { telegram } from '#lib/stores/telegram.svelte.js';
	import RaidSquadPanel from './RaidSquadPanel.svelte';
	import SquadAvatar from './SquadAvatar.svelte';
	import SquadLinkCard from './SquadLinkCard.svelte';
	import SquadShareButton from './SquadShareButton.svelte';
	import { squadResultText } from './squadText';
	import IconHourglass from '~icons/lucide/hourglass';
	import IconSend from '~icons/lucide/send';
	import IconSwords from '~icons/lucide/swords';
	import IconUserPlus from '~icons/lucide/user-plus';

	const store = squad();
	const account = telegram();

	onMount(() => {
		store.start();
		return () => store.stop();
	});

	/** Online friends not in the squad yet, the ones free to raid first */
	const candidates = $derived(store.onlineFriends.filter((friend) => !store.isMember(friend.id)));

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

<div
	class="flex flex-col gap-2.5 rounded-2xl bg-linear-to-br from-[#3b2470]/90 to-[#24164a]/90 p-2.5 shadow-[0_4px_0_rgb(0_0_0/0.3)]"
>
	<div class="flex flex-wrap items-start gap-2.5">
		<RaidSquadPanel class="min-w-0 flex-1" />
		{#if store.availability === 'ready'}
			<div class="flex flex-col items-end gap-1">
				<SquadShareButton onnotice={say} />
				<span
					dir="auto"
					class="max-w-52 text-end text-[11px] leading-tight font-semibold opacity-80"
					>{m.squad_share_hint()}</span
				>
			</div>
		{:else if !store.loading && !account.inTelegram}
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

	{#if store.availability === 'ready'}
		{#if store.joinCode}
			<SquadLinkCard compact onnotice={say} />
		{/if}

		<!-- Online friends, to invite with one tap -->
		<div class="flex flex-col gap-1">
			<span class="font-display text-xs font-black uppercase italic opacity-80">
				{m.squad_online_friends()}
				<span class="ms-1 font-sans font-semibold normal-case not-italic opacity-90"
					>· {m.squad_count({ count: store.members.length, max: SQUAD_SIZE })}</span
				>
			</span>
			{#if candidates.length === 0}
				<p dir="auto" class="text-xs font-semibold opacity-80">{m.squad_no_online()}</p>
			{:else}
				<ul class="friends flex gap-2 overflow-x-auto pb-1">
					{#each candidates as friend (friend.id)}
						{@const invited = store.invited(friend.id)}
						<li
							class="flex w-24 shrink-0 flex-col items-center gap-1 rounded-xl bg-[#2a1a52]/85 px-1.5 pt-2 pb-1.5"
						>
							<SquadAvatar
								id={friend.id}
								name={friend.name}
								photoUrl={friend.photoUrl}
								online
								size={40}
							/>
							<span
								dir="auto"
								class="w-full truncate text-center text-xs leading-tight font-bold"
								title={friend.name}>{friend.name}</span
							>
							{#if friend.inRaid}
								<span
									class="flex -skew-x-6 items-center gap-0.5 rounded bg-[#ffd23a] px-1 font-display text-[9px] font-black text-[#3b2470] uppercase italic"
								>
									<IconSwords class="size-2.5" aria-hidden="true" />
									{m.friends_status_in_raid()}
								</span>
							{/if}
							{#if invited}
								<span
									class="mt-auto flex items-center gap-1 font-display text-[11px] font-black uppercase italic opacity-85"
								>
									<IconHourglass class="size-3" aria-hidden="true" />
									{m.friends_invited()}
								</span>
							{:else}
								<button
									type="button"
									class="mt-auto flex w-full -skew-x-6 items-center justify-center gap-1 rounded-md border-b-4 border-[#0f7f73] bg-[#22c3b0] py-1 font-display text-[11px] font-black uppercase italic shadow-[0_2px_0_rgb(0_0_0/0.25)] active:translate-y-0.5 disabled:border-black/20 disabled:bg-white/15 disabled:text-white/60 disabled:shadow-none"
									aria-label="{m.friends_invite()}: {friend.name}"
									title={store.isFull ? m.squad_full() : m.friends_invite()}
									disabled={!store.canInvite(friend)}
									onclick={() => invite(friend.id)}
								>
									<IconUserPlus class="size-3.5 stroke-[2.5]" aria-hidden="true" />
									{m.squad_invite_short()}
								</button>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	{/if}

	{#if notice}
		<p role="status" dir="auto" class="text-xs font-bold text-[#ffd23a]">{notice}</p>
	{/if}
</div>

<style>
	.friends {
		scrollbar-width: none;
	}
</style>
