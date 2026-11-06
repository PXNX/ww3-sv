<!--
	In a normal browser: a small card saying that progress only lives in this browser, with a button
	that carries it into the Telegram Mini App, where it is saved to the account. Hidden in Telegram,
	for a browser with nothing to carry yet, and once closed.
-->
<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { cloudSave } from '#lib/stores/cloudSave.svelte.js';
	import { telegram } from '#lib/stores/telegram.svelte.js';
	import IconCloud from '~icons/lucide/cloud';
	import IconX from '~icons/lucide/x';

	const cloud = cloudSave();
	const account = telegram();
</script>

{#if !account.inTelegram && cloud.hasLocalProgress && !cloud.hintDismissed}
	<aside
		class="sticker flex items-start gap-3 border-ink bg-sand p-3"
		style:--tilt="-0.5deg"
		aria-label={m.cloud_hint_title()}
	>
		<IconCloud class="mt-0.5 size-7 shrink-0" aria-hidden="true" />
		<div class="flex min-w-0 flex-1 flex-col gap-2">
			<p class="font-bold">{m.cloud_hint_title()}</p>
			<p class="text-sm leading-snug">{m.cloud_hint_body()}</p>
			<button
				type="button"
				class="btn-chunky w-fit bg-explosion-yellow px-3 py-1 text-sm"
				disabled={cloud.transferring}
				onclick={() => void cloud.moveToTelegram()}
			>
				{m.cloud_hint_button()}
			</button>
		</div>
		<button
			type="button"
			class="btn-chunky shrink-0 px-2 py-1"
			aria-label={m.cloud_hint_dismiss()}
			title={m.cloud_hint_dismiss()}
			onclick={() => cloud.dismissHint()}
		>
			<IconX class="size-4" aria-hidden="true" />
		</button>
	</aside>
{/if}
