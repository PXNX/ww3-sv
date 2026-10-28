<!--
	The squad as a compact strip for the raid lobby: three slots (the player and up to two
	friends), a crown on the leader, invites on their way, and empty slots that open a small list
	of online friends to invite. Beside it the button to leave the squad, and below it any invites
	the player received. Outside Telegram it only says where friends can be found.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { SQUAD_SIZE } from '#lib/services/squad.js';
	import { squad } from '#lib/stores/squad.svelte.js';
	import SquadAvatar from './SquadAvatar.svelte';
	import SquadInviteCard from './SquadInviteCard.svelte';
	import { squadResultText } from './squadText';
	import IconCrown from '~icons/lucide/crown';
	import IconHourglass from '~icons/lucide/hourglass';
	import IconLogOut from '~icons/lucide/log-out';
	import IconPlus from '~icons/lucide/plus';
	import IconUserPlus from '~icons/lucide/user-plus';
	import IconUsers from '~icons/lucide/users';

	let {
		invites = true,
		class: className = ''
	}: {
		/** Lists the invites the player received below the strip */
		invites?: boolean;
		class?: string;
	} = $props();

	const store = squad();
	const uid = $props.id();

	onMount(() => {
		store.start();
		if (invites) store.inviteSurfaces += 1;
		return () => {
			if (invites) store.inviteSurfaces -= 1;
			store.stop();
		};
	});

	/** Who is waiting for an answer, by friend */
	const pending = $derived(
		store.outgoing
			.filter((invite) => invite.expiresAt > store.now)
			.map((invite) => ({
				invite,
				friend: store.friends.find((friend) => friend.id === invite.toId)
			}))
	);
	const emptySlots = $derived(
		Math.max(0, SQUAD_SIZE - store.members.length - Math.min(pending.length, SQUAD_SIZE))
	);

	let picking = $state(false);
	let notice = $state<string | null>(null);
	let noticeTimer: ReturnType<typeof setTimeout> | undefined;

	function say(text: string | null) {
		clearTimeout(noticeTimer);
		notice = text;
		if (text) noticeTimer = setTimeout(() => (notice = null), 4000);
	}

	async function invite(friendId: string) {
		say(squadResultText(await store.invite(friendId)));
		picking = false;
	}

	async function leave() {
		say(squadResultText(await store.leave()));
	}

	function onkeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') picking = false;
	}
</script>

<svelte:window {onkeydown} />

<div class="flex flex-col gap-1.5 text-white {className}">
	{#if store.availability !== 'ready'}
		{#if !store.loading}
			<div
				class="flex items-center gap-2 rounded-xl bg-[#2a1a52]/85 px-3 py-2 shadow-[0_3px_0_rgb(0_0_0/0.3)]"
			>
				<IconUsers class="size-4 shrink-0 text-[#22c3b0]" aria-hidden="true" />
				<span dir="auto" class="text-xs leading-tight font-semibold">
					{store.availability === 'signed-out' ? m.friends_signed_out() : m.friends_unavailable()}
				</span>
			</div>
		{/if}
	{:else}
		<div class="flex items-stretch gap-1.5" role="group" aria-label={m.squad_title()}>
			{#each store.members as member (member.id)}
				{@const self = member.id === store.you}
				{@const leader = member.id === (store.squad?.leaderId ?? store.you)}
				<div
					class="relative flex w-28 min-w-0 items-center gap-1.5 rounded-xl px-1.5 py-1.5 shadow-[0_3px_0_rgb(0_0_0/0.3)] {self
						? 'bg-[#2a1a52]/90 ring-2 ring-[#22c3b0]'
						: 'bg-[#2a1a52]/85'}"
				>
					<SquadAvatar
						id={member.id}
						name={member.name}
						photoUrl={member.photoUrl}
						{self}
						size={32}
					/>
					<span
						dir="auto"
						class="min-w-0 flex-1 truncate font-display text-xs leading-tight font-bold"
						title={member.name}>{self ? m.squad_you() : member.name}</span
					>
					{#if leader && store.squad}
						<span
							class="absolute -start-1 -top-2 flex size-5 items-center justify-center rounded-full border-2 border-white bg-[#ffb020]"
							title={m.squad_leader()}
						>
							<IconCrown class="size-3 fill-white" aria-hidden="true" />
							<span class="sr-only">{m.squad_leader()}</span>
						</span>
					{/if}
				</div>
			{/each}

			{#each pending as { invite, friend } (invite.id)}
				<div
					class="flex w-28 min-w-0 items-center gap-1.5 rounded-xl border-2 border-dashed border-white/40 bg-[#2a1a52]/60 px-1.5 py-1"
					title={m.squad_slot_pending()}
				>
					<SquadAvatar
						id={invite.toId}
						name={friend?.name ?? '?'}
						photoUrl={friend?.photoUrl}
						size={28}
					/>
					<span class="flex min-w-0 flex-1 flex-col">
						<span dir="auto" class="truncate font-display text-xs leading-tight font-bold"
							>{friend?.name ?? '…'}</span
						>
						<span class="flex items-center gap-0.5 text-[10px] font-semibold opacity-80">
							<IconHourglass class="size-2.5" aria-hidden="true" />
							{store.secondsLeft(invite)}s
						</span>
					</span>
				</div>
			{/each}

			{#each { length: emptySlots }, index (index)}
				<div class="relative">
					<button
						type="button"
						class="flex h-full w-28 items-center justify-center gap-1 rounded-xl border-2 border-dashed border-white/50 bg-[#2a1a52]/50 px-1.5 py-1.5 font-display text-[11px] leading-tight font-black uppercase italic hover:bg-[#2a1a52]/75 disabled:opacity-50"
						aria-haspopup="true"
						aria-expanded={picking && index === 0}
						aria-controls={index === 0 ? `${uid}-pick` : undefined}
						title={store.isLeader ? m.squad_slot_invite() : m.squad_waiting_leader()}
						disabled={!store.isLeader}
						onclick={() => (picking = !picking)}
					>
						<IconPlus class="size-4 shrink-0 stroke-[3] text-[#22c3b0]" aria-hidden="true" />
						<span class="line-clamp-2">{m.squad_slot_invite()}</span>
					</button>
				</div>
			{/each}

			{#if store.squad}
				<button
					type="button"
					class="flex w-10 shrink-0 -skew-x-6 items-center justify-center rounded-lg border-b-4 border-[#7a1f3a] bg-[#e0457b] shadow-[0_3px_0_rgb(0_0_0/0.25)] active:translate-y-0.5 disabled:opacity-60"
					aria-label={m.squad_leave()}
					title={m.squad_leave()}
					disabled={store.busy === 'leave'}
					onclick={leave}
				>
					<IconLogOut class="size-4 stroke-[3] rtl:rotate-180" aria-hidden="true" />
				</button>
			{/if}
		</div>

		{#if picking}
			<!-- Click outside closes the list -->
			<button
				type="button"
				class="fixed inset-0 z-40 cursor-default"
				aria-label={m.squad_close()}
				tabindex="-1"
				onclick={() => (picking = false)}
			></button>
			<div class="relative z-50">
				<div
					id="{uid}-pick"
					class="absolute start-0 top-0 flex max-h-56 w-64 flex-col gap-1 overflow-y-auto rounded-xl bg-[#1f1340]/95 p-2 shadow-[0_6px_0_rgb(0_0_0/0.3)] ring-2 ring-white/15"
				>
					<span class="px-1 font-display text-xs font-black uppercase italic opacity-80"
						>{m.squad_slot_invite()}</span
					>
					{#each store.onlineFriends.filter((friend) => !store.isMember(friend.id)) as friend (friend.id)}
						<div class="flex items-center gap-2 rounded-lg bg-white/5 px-1.5 py-1">
							<SquadAvatar
								id={friend.id}
								name={friend.name}
								photoUrl={friend.photoUrl}
								online
								size={28}
							/>
							<span class="flex min-w-0 flex-1 flex-col">
								<span dir="auto" class="truncate text-sm leading-tight font-bold"
									>{friend.name}</span
								>
								{#if friend.inRaid}
									<span class="text-[10px] font-bold text-[#ffd23a] uppercase"
										>{m.friends_status_in_raid()}</span
									>
								{/if}
							</span>
							<button
								type="button"
								class="flex size-8 -skew-x-6 items-center justify-center rounded-md border-b-4 border-[#0f7f73] bg-[#22c3b0] shadow-[0_2px_0_rgb(0_0_0/0.25)] active:translate-y-0.5 disabled:opacity-50"
								aria-label="{m.friends_invite()}: {friend.name}"
								title={store.invited(friend.id) ? m.friends_invited() : m.friends_invite()}
								disabled={!store.canInvite(friend)}
								onclick={() => invite(friend.id)}
							>
								<IconUserPlus class="size-4 stroke-[2.5]" aria-hidden="true" />
							</button>
						</div>
					{:else}
						<p class="px-1 py-2 text-xs font-semibold opacity-80">{m.squad_no_online()}</p>
					{/each}
				</div>
			</div>
		{/if}

		{#if store.squad && !store.isLeader}
			<p dir="auto" class="text-[11px] font-semibold opacity-85">{m.squad_waiting_leader()}</p>
		{/if}

		{#if invites}
			{#each store.pendingInvites as invite (invite.id)}
				<SquadInviteCard {invite} compact onnotice={say} />
			{/each}
		{/if}
	{/if}

	{#if notice}
		<p
			role="status"
			dir="auto"
			class="self-start rounded-lg bg-[#16245a]/80 px-2 py-1 text-xs font-bold text-[#ffd23a]"
		>
			{notice}
		</p>
	{/if}
</div>
