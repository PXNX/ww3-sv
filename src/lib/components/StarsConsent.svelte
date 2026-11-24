<!--
	The consent German law asks for before digital goods are delivered at once (§ 356 BGB), in the
	bot's German wording, with the AGB and the Widerrufsbelehrung. Shown until the player has agreed
	to the current terms; one box can serve several offers.
-->
<script lang="ts">
	import { telegram } from '#lib/stores/telegram.svelte.js';
	import { m } from '#lib/paraglide/messages.js';

	let { agreed = $bindable(false) }: { agreed?: boolean } = $props();

	const account = telegram();
</script>

{#if account.consent}
	<label class="flex items-start gap-2 text-xs leading-snug">
		<input type="checkbox" class="checkbox mt-0.5 checkbox-sm" bind:checked={agreed} />
		<span class="flex flex-col gap-0.5">
			<span class="font-semibold opacity-70">{m.stars_consent_hint()}</span>
			<span lang="de">{account.consent.text}</span>
			<span class="flex flex-wrap gap-x-3">
				{#if account.consent.terms}
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- external page -->
					<a href={account.consent.terms} target="_blank" rel="noopener" class="underline">
						{m.stars_terms()}
					</a>
				{/if}
				{#if account.consent.withdrawal}
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- external page -->
					<a href={account.consent.withdrawal} target="_blank" rel="noopener" class="underline">
						{m.stars_withdrawal()}
					</a>
				{/if}
			</span>
		</span>
	</label>
{/if}
