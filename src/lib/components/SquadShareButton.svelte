<!--
	Shares a link to join the player's squad. Inside Telegram it opens the share sheet to pick a
	chat; elsewhere the browser's own share sheet, or the link is copied. In dev mode the link opens
	the raid lobby of this machine, so a second tab can join through it.
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import { squadStartParam } from '#lib/services/squad.js';
	import { openTelegramLink, telegramAppLink, telegramShareUrl } from '#lib/services/telegram.js';
	import { squad } from '#lib/stores/squad.svelte.js';
	import { squadResultText } from './squadText';
	import IconSend from '~icons/lucide/send';

	let {
		compact = false,
		onnotice
	}: {
		/** A smaller button, for tight rows */
		compact?: boolean;
		/** Called with a message when the link could not be made, or was copied instead */
		onnotice?: (text: string) => void;
	} = $props();

	const store = squad();

	async function share() {
		const made = await store.link();
		if (typeof made === 'string') {
			onnotice?.(squadResultText(made) ?? m.squad_error_failed());
			return;
		}
		const text = m.squad_share_text();
		const url =
			store.mode === 'local'
				? `${window.location.origin}${resolve('/play/raid')}?squad=dev&join=${made.code}`
				: telegramAppLink(squadStartParam(made.code));
		if (store.mode !== 'local' && (await openTelegramLink(telegramShareUrl(url, text)))) return;
		if (navigator.share) {
			try {
				await navigator.share({ url, text });
				return;
			} catch (error) {
				// Closing the share sheet is a choice, not a failure
				if (error instanceof DOMException && error.name === 'AbortError') return;
			}
		}
		try {
			await navigator.clipboard.writeText(url);
			onnotice?.(m.squad_share_copied());
		} catch {
			onnotice?.(url);
		}
	}
</script>

<button
	type="button"
	class="flex shrink-0 -skew-x-6 items-center justify-center gap-1.5 rounded-lg border-b-4 border-[#1d5fa8] bg-linear-to-b from-[#4fb4ff] to-[#2a8ae8] font-display leading-none font-black text-white uppercase italic shadow-[0_3px_0_rgb(0_0_0/0.25)] active:translate-y-0.5 disabled:opacity-60 {compact
		? 'px-2.5 py-1.5 text-xs'
		: 'px-4 py-2 text-sm'}"
	title={store.isLeader ? m.squad_share_hint() : m.squad_error_not_leader()}
	disabled={!store.isLeader || store.busy === 'link'}
	onclick={share}
>
	<IconSend class={compact ? 'size-3.5' : 'size-4'} aria-hidden="true" />
	{m.squad_share()}
</button>
