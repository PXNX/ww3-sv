<!--
	The settings page: how the game looks, the language and the sound. The theme choice and the
	language both live here so the start screen and the other pages stay free of small controls.
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { APP_NAME } from '#lib/config.js';
	import { LOCALE_NAMES } from '#lib/i18n.js';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale, isLocale, locales, setLocale } from '#lib/paraglide/runtime.js';
	import { clipPreload } from '#lib/sound/preload.svelte.js';
	import { soundManager } from '#lib/sound/soundManager.svelte.js';
	import { appearance, THEME_CHOICES, type ThemeChoice } from '#lib/stores/appearance.svelte.js';
	import IconArrowLeft from '~icons/lucide/arrow-left';
	import IconLanguages from '~icons/lucide/languages';
	import IconMoon from '~icons/lucide/moon';
	import IconSmartphone from '~icons/lucide/smartphone';
	import IconSun from '~icons/lucide/sun';
	import IconVolume2 from '~icons/lucide/volume-2';
	import IconVolumeX from '~icons/lucide/volume-x';

	const look = appearance();
	const sound = soundManager();

	const THEME_LABELS: Record<ThemeChoice, () => string> = {
		auto: m.settings_theme_auto,
		light: m.settings_theme_light,
		dark: m.settings_theme_dark
	};

	const THEME_ICONS = {
		auto: IconSmartphone,
		light: IconSun,
		dark: IconMoon
	} as const;

	function toggleSound() {
		sound.toggleMuted();
		// Unmuting is the first moment prefetching makes sense for someone who started muted
		if (!sound.muted) clipPreload().start();
	}
</script>

<svelte:head>
	<title>{m.settings_title()} | {APP_NAME}</title>
</svelte:head>

<main
	class="mx-auto flex max-w-2xl flex-col gap-6 px-4 pt-[calc(1rem+var(--top-inset))] pb-[calc(3rem+env(safe-area-inset-bottom))]"
>
	<div class="flex items-center gap-2 pr-(--top-right-inset) pl-(--top-left-inset)">
		<a href={resolve('/')} class="btn-chunky px-3 py-1 text-sm">
			<IconArrowLeft class="size-4 rtl:rotate-180" aria-hidden="true" />
			{m.game_back()}
		</a>
	</div>

	<h1
		class="inline-block self-start rounded-[16px_8px_14px_10px] border-3 border-ink bg-banner-slate px-4 py-2 text-3xl font-bold text-paper shadow-[4px_4px_0_var(--color-ink)]"
	>
		{m.settings_title()}
	</h1>

	<section class="sticker flex flex-col gap-3 p-4" style:--tilt="-0.5deg">
		<h2 id="settings-appearance" class="font-display text-xl font-bold">
			{m.settings_appearance()}
		</h2>
		<div class="grid grid-cols-3 gap-2" role="group" aria-labelledby="settings-appearance">
			{#each THEME_CHOICES as choice (choice)}
				{@const Icon = THEME_ICONS[choice]}
				<button
					type="button"
					class="btn-chunky flex-col gap-1 px-2 py-3 text-sm leading-tight"
					class:bg-explosion-yellow={look.choice === choice}
					aria-pressed={look.choice === choice}
					onclick={() => look.set(choice)}
				>
					<Icon class="size-5" aria-hidden="true" />
					{THEME_LABELS[choice]()}
				</button>
			{/each}
		</div>
		<p class="text-xs leading-relaxed opacity-70">{m.settings_theme_hint()}</p>
	</section>

	<section class="sticker flex flex-col gap-3 p-4" style:--tilt="0.4deg">
		<h2 id="settings-language" class="flex items-center gap-2 font-display text-xl font-bold">
			<IconLanguages class="size-5 text-flag-blue" aria-hidden="true" />
			{m.language_label()}
		</h2>
		<div class="grid grid-cols-2 gap-2 sm:grid-cols-3" role="group" aria-labelledby="settings-language">
			{#each locales as locale (locale)}
				<button
					type="button"
					class="btn-chunky px-2 py-2 text-sm"
					class:bg-explosion-yellow={getLocale() === locale}
					lang={locale}
					aria-pressed={getLocale() === locale}
					onclick={() => {
						if (isLocale(locale)) setLocale(locale);
					}}
				>
					{LOCALE_NAMES[locale]}
				</button>
			{/each}
		</div>
	</section>

	<section class="sticker flex flex-col gap-3 p-4" style:--tilt="-0.3deg">
		<h2 id="settings-sound" class="font-display text-xl font-bold">{m.settings_sound()}</h2>
		<button
			type="button"
			class="btn-chunky self-start px-3 py-2 text-sm"
			aria-pressed={!sound.muted}
			onclick={toggleSound}
		>
			{#if sound.muted}
				<IconVolumeX class="size-4" aria-hidden="true" />
			{:else}
				<IconVolume2 class="size-4" aria-hidden="true" />
			{/if}
			{sound.muted ? m.settings_sound_off() : m.settings_sound_on()}
		</button>
	</section>
</main>
