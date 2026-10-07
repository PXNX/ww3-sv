<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale, isLocale, locales, setLocale } from '#lib/paraglide/runtime.js';
	import { LOCALE_NAMES } from '#lib/i18n.js';
	import IconLanguages from '~icons/lucide/languages';

	function onchange(event: Event & { currentTarget: HTMLSelectElement }) {
		const locale = event.currentTarget.value;
		// Stored in local storage by the Paraglide localStorage strategy, then the page reloads
		if (isLocale(locale)) setLocale(locale);
	}
</script>

<label class="btn-chunky py-1 ps-3 pe-1 has-[:focus-visible]:outline-none">
	<IconLanguages class="size-5" aria-hidden="true" />
	<span class="sr-only">{m.language_label()}</span>
	<select
		class="cursor-pointer bg-transparent py-1 font-bold outline-none"
		value={getLocale()}
		{onchange}
	>
		{#each locales as locale (locale)}
			<option value={locale} lang={locale}>{LOCALE_NAMES[locale]}</option>
		{/each}
	</select>
</label>
