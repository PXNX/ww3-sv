<!--
	The referral link: for people who have never played. Every new player who starts the bot through
	it earns the player a revival token, up to a cap. It is not a way to add a friend by choice and it
	does not join a squad: friends show up in the friends list on their own, and squads are formed in
	the raid lobby.
-->
<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { inviteShareUrl, openTelegramLink } from '#lib/services/telegram.js';
	import { telegram } from '#lib/stores/telegram.svelte.js';
	import IconGift from '~icons/lucide/gift';
	import IconSend from '~icons/lucide/send';

	const account = telegram();
	const invite = $derived(account.status === 'verified' ? account.invite : null);
</script>

{#if invite}
	<section class="sticker flex flex-col gap-2 p-4" style:--tilt="0.3deg" aria-labelledby="referral">
		<h2 id="referral" class="flex items-center gap-2 font-display text-xl font-bold">
			<IconGift class="size-5 text-flag-blue" aria-hidden="true" />
			{m.profile_invite_title()}
		</h2>
		<p dir="auto" class="text-sm leading-relaxed">
			{m.profile_invite_body({ revives: invite.revivesPerFriend, cap: invite.cap })}
		</p>
		<p dir="auto" class="text-sm font-bold tabular-nums">
			{m.profile_invite_count({ friends: invite.friends, cap: invite.cap })}
		</p>
		<button
			type="button"
			class="btn-chunky self-start bg-flag-blue px-3 py-1 text-sm"
			onclick={() => openTelegramLink(inviteShareUrl(invite, m.profile_invite_text()))}
		>
			<IconSend class="size-4" aria-hidden="true" />
			{m.profile_invite_share()}
		</button>
		<p dir="auto" class="text-xs leading-snug opacity-70">{m.profile_invite_hint()}</p>
	</section>
{/if}
