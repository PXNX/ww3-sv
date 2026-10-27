<!--
	The "make your agent" card on the start screen. Folded it is one row: the agent, a line of text
	and a button; unfolded it holds the quick editor with only the looks already unlocked, since
	the full collection belongs on the profile. A player who never touched the look gets a louder
	nudge than one who already dressed up. Outside Telegram the agent is anonymous, and the card
	points to the Mini App instead of the editor.
-->
<script lang="ts">
	import { slide } from 'svelte/transition';
	import { resolve } from '$app/paths';
	import { avatar } from '#lib/game/avatar/store.svelte.js';
	import { m } from '#lib/paraglide/messages.js';
	import Avatar from './Avatar.svelte';
	import AvatarEditor from './AvatarEditor.svelte';
	import IconChevronUp from '~icons/lucide/chevron-up';
	import IconSend from '~icons/lucide/send';
	import IconShirt from '~icons/lucide/shirt';
	import IconUser from '~icons/lucide/user-round';

	const avatarState = avatar();
	let open = $state(false);
</script>

<section class="sticker flex flex-col gap-3 bg-paper p-3" style:--tilt="0.4deg">
	<div class="flex items-center gap-3">
		<button
			type="button"
			class="shrink-0 -rotate-3 rounded-[12px_6px_10px_8px] border-3 border-ink bg-flag-blue/25 p-0.5 transition-transform hover:rotate-2 active:scale-90"
			onclick={() => (open = !open && !avatarState.anonymous)}
			aria-label={m.avatar_edit()}
		>
			<Avatar size={52} expression={open ? 'surprised' : 'happy'} />
		</button>
		<div class="min-w-0 flex-1">
			<h2 class="font-display text-lg leading-tight font-bold">{m.avatar_title()}</h2>
			<p class="text-sm leading-snug opacity-80">
				{#if avatarState.anonymous}
					{m.avatar_anonymous()}
				{:else}
					{avatarState.customized ? m.avatar_intro_done() : m.avatar_intro()}
				{/if}
			</p>
		</div>
		<div class="flex shrink-0 flex-col items-end gap-1.5 sm:flex-row sm:items-center">
			{#if avatarState.anonymous}
				<a
					href="https://t.me/game_ww3_bot?startapp=profile"
					target="_blank"
					rel="noopener"
					class="btn-chunky bg-flag-blue px-3 py-1 text-sm"
				>
					<IconSend class="size-4" aria-hidden="true" />
					{m.profile_telegram_open()}
				</a>
			{:else}
				<button
					type="button"
					class="btn-chunky px-3 py-1 text-sm {avatarState.customized && !open
						? 'bg-paper'
						: 'bg-explosion-yellow'}"
					aria-expanded={open}
					onclick={() => (open = !open)}
				>
					{#if open}
						<IconChevronUp class="size-4" aria-hidden="true" />
						{m.avatar_done()}
					{:else}
						<IconShirt class="size-4" aria-hidden="true" />
						{m.avatar_edit()}
					{/if}
				</button>
			{/if}
			<a
				href={resolve('/profile')}
				class="inline-flex items-center gap-1 text-xs font-bold underline"
			>
				<IconUser class="size-3.5" aria-hidden="true" />
				{m.profile_link()}
			</a>
		</div>
	</div>

	{#if open && !avatarState.anonymous}
		<div transition:slide={{ duration: 220 }}>
			<AvatarEditor showUnlocks={false} />
		</div>
	{/if}
</section>
