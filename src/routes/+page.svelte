<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import { APP_NAME } from '$lib/config';
	import CharacterMascot from '$lib/components/CharacterMascot.svelte';
	import LocaleSwitcher from '$lib/components/LocaleSwitcher.svelte';
	import ModeSelect from '$lib/components/ModeSelect.svelte';
</script>

<main class="mx-auto flex max-w-5xl flex-col gap-8 px-4 pt-4 pb-12">
	<div class="flex justify-end">
		<LocaleSwitcher />
	</div>

	<header class="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-start">
		<CharacterMascot pose="idle" class="w-36 shrink-0 -rotate-3 sm:w-44" />
		<div class="flex flex-col gap-2">
			<h1
				class="pop-in inline-block rotate-1 self-center rounded-[16px_8px_14px_10px] border-3 border-ink bg-banner-slate px-4 pt-2 pb-1 text-4xl leading-none font-bold text-paper shadow-[4px_4px_0_var(--color-ink)] sm:self-start sm:text-5xl"
			>
				{APP_NAME}
			</h1>
			<p class="text-lg font-semibold">{m.home_tagline({ location: m.location_name() })}</p>
		</div>
	</header>

	<section class="flex flex-col gap-4" aria-labelledby="choose-mode">
		<h2 id="choose-mode" class="text-2xl font-bold">{m.home_choose_mode()}</h2>
		<ModeSelect />
	</section>
</main>
