<!--
	The app was opened through a shared squad link: offers joining that squad, or dismissing it.
	Joining takes the player to the raid lobby, where the squad gathers.
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { m } from '#lib/paraglide/messages.js';
	import { squad } from '#lib/stores/squad.svelte.js';
	import { squadResultText } from './squadText';
	import IconCheck from '~icons/lucide/check';
	import IconLink from '~icons/lucide/link';
	import IconX from '~icons/lucide/x';

	let {
		compact = false,
		onnotice
	}: {
		/** One tight row, for the raid lobby */
		compact?: boolean;
		/** Called with a message once joined, or when joining did not work */
		onnotice?: (text: string) => void;
	} = $props();

	const store = squad();
	const busy = $derived(store.busy === 'join');

	async function join() {
		const result = await store.joinLink();
		if (result !== 'ok') {
			onnotice?.(squadResultText(result) ?? m.squad_error_failed());
			return;
		}
		const leader = store.squad?.members.find((member) => member.id === store.squad?.leaderId);
		onnotice?.(m.squad_link_joined({ name: leader?.name ?? '…' }));
		if (page.url.pathname !== resolve('/play/raid')) await goto(resolve('/play/raid'));
	}
</script>

<div
	class="flex items-center gap-2 rounded-xl bg-linear-to-r from-[#2a8ae8] to-[#7a3fe0] text-white shadow-[0_3px_0_rgb(0_0_0/0.3)] {compact
		? 'px-2 py-1.5'
		: 'px-3 py-2.5'}"
	role="group"
	aria-label={m.squad_link_title()}
>
	<span
		class="flex shrink-0 -skew-x-6 items-center justify-center rounded-md bg-white/20 {compact
			? 'size-7'
			: 'size-9'}"
	>
		<IconLink class={compact ? 'size-4' : 'size-5'} aria-hidden="true" />
	</span>
	<div class="flex min-w-0 flex-1 flex-col">
		<span
			class="font-display leading-tight font-black uppercase italic {compact
				? 'text-xs'
				: 'text-sm'}">{m.squad_link_title()}</span
		>
		<span dir="auto" class="text-[11px] leading-tight font-semibold opacity-90"
			>{m.squad_link_body()}</span
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
		onclick={() => store.dismissJoin()}
	>
		<IconX class="size-4 stroke-[3]" aria-hidden="true" />
	</button>
</div>
