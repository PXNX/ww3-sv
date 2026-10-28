<!--
	An incoming squad invite: who sends it, a bar running down until it expires, and Join and
	Decline. Joining takes the player to the raid lobby, where the squad gathers.
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import { INVITE_TTL_MS, type SquadInvite } from '#lib/services/squad.js';
	import { squad } from '#lib/stores/squad.svelte.js';
	import SquadAvatar from './SquadAvatar.svelte';
	import { squadResultText } from './squadText';
	import IconCheck from '~icons/lucide/check';
	import IconX from '~icons/lucide/x';

	let {
		invite,
		compact = false,
		onnotice
	}: {
		invite: SquadInvite;
		/** One tight row, for the raid lobby and the toast */
		compact?: boolean;
		/** Called with a message when joining or declining did not work */
		onnotice?: (text: string) => void;
	} = $props();

	const store = squad();
	const left = $derived(Math.max(0, invite.expiresAt - store.now) / INVITE_TTL_MS);
	const busy = $derived(store.busy === invite.id);

	async function join() {
		const result = await store.accept(invite.id);
		const text = squadResultText(result);
		if (text) onnotice?.(text);
		else await goto(resolve('/play/raid'));
	}

	async function decline() {
		const text = squadResultText(await store.decline(invite.id));
		if (text) onnotice?.(text);
	}
</script>

<div
	class="relative flex items-center gap-2 overflow-hidden rounded-xl bg-linear-to-r from-[#ff7a2f] to-[#ff4f7b] text-white shadow-[0_3px_0_rgb(0_0_0/0.3)] {compact
		? 'px-2 py-1.5'
		: 'px-3 py-2.5'}"
	role="group"
	aria-label={m.squad_invite_from({ name: invite.from.name })}
>
	<SquadAvatar
		id={invite.from.id}
		name={invite.from.name}
		photoUrl={invite.from.photoUrl}
		size={compact ? 30 : 40}
	/>
	<div class="flex min-w-0 flex-1 flex-col">
		<span dir="auto" class="truncate leading-tight font-bold {compact ? 'text-xs' : 'text-sm'}"
			>{m.squad_invite_from({ name: invite.from.name })}</span
		>
		<span class="font-display text-[11px] font-bold tabular-nums opacity-85"
			>{m.squad_invite_expires({ seconds: store.secondsLeft(invite) })}</span
		>
	</div>
	<button
		type="button"
		class="flex -skew-x-6 items-center gap-1 rounded-md border-b-4 border-[#0f7f73] bg-[#22c3b0] font-display font-black uppercase italic shadow-[0_2px_0_rgb(0_0_0/0.25)] active:translate-y-0.5 disabled:opacity-60 {compact
			? 'px-2 py-1 text-xs'
			: 'px-3 py-1.5 text-sm'}"
		disabled={busy}
		onclick={join}
	>
		<IconCheck class="size-4 stroke-[3]" aria-hidden="true" />
		{m.squad_invite_accept()}
	</button>
	<button
		type="button"
		class="flex size-8 shrink-0 -skew-x-6 items-center justify-center rounded-md border-b-4 border-black/30 bg-white/20 active:translate-y-0.5 disabled:opacity-60"
		aria-label={m.squad_invite_decline()}
		title={m.squad_invite_decline()}
		disabled={busy}
		onclick={decline}
	>
		<IconX class="size-4 stroke-[3]" aria-hidden="true" />
	</button>
	<!-- Time left to answer -->
	<span
		class="absolute start-0 bottom-0 h-1 bg-white/70 transition-[width] duration-1000 ease-linear"
		style:width="{left * 100}%"
		aria-hidden="true"
	></span>
</div>
