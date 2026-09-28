<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import { APP_NAME } from '$lib/config';
	import CharacterMascot from '$lib/components/CharacterMascot.svelte';
	import LocaleSwitcher from '$lib/components/LocaleSwitcher.svelte';
	import ModeSelect from '$lib/components/ModeSelect.svelte';
	import StraitScene from '$lib/components/scenery/StraitScene.svelte';
</script>

<main class="mx-auto flex max-w-5xl flex-col gap-8 px-4 pt-4 pb-12">
	<div class="flex justify-end">
		<LocaleSwitcher />
	</div>

	<header class="flex flex-col items-center gap-3 text-center">
		<h1
			class="pop-in inline-block rotate-1 rounded-[16px_8px_14px_10px] border-3 border-ink bg-banner-slate px-4 pt-2 pb-1 text-4xl leading-none font-bold text-paper shadow-[4px_4px_0_var(--color-ink)] sm:text-5xl"
		>
			{APP_NAME}
		</h1>
		<p class="text-lg font-semibold">{m.home_tagline({ location: m.location_name() })}</p>

		<div class="relative mt-2 w-full max-w-2xl">
			<div class="sticker overflow-hidden p-0" style:--tilt="-1deg">
				<StraitScene />
			</div>
			<CharacterMascot
				pose="idle"
				class="absolute -end-2 -bottom-6 w-24 rotate-6 drop-shadow-[3px_3px_0_var(--color-ink)] sm:w-32"
			/>
		</div>
	</header>

	<section class="flex flex-col gap-4" aria-labelledby="choose-mode">
		<h2 id="choose-mode" class="text-2xl font-bold">{m.home_choose_mode()}</h2>
		<ModeSelect />
	</section>
</main>
