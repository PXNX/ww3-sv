<!--
	About page: a short note that every character is fictional and that the jokes are satire aimed
	at governments, bureaucracy and situations (roadmap Section 1.4).
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { m } from '$lib/paraglide/messages';
	import { APP_NAME } from '$lib/config';
	import LocaleSwitcher from '$lib/components/LocaleSwitcher.svelte';
	import IconArrowLeft from '~icons/lucide/arrow-left';
</script>

<svelte:head>
	<title>{m.about_title()} | {APP_NAME}</title>
</svelte:head>

<main
	class="mx-auto flex max-w-2xl flex-col gap-6 px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(3rem+env(safe-area-inset-bottom))]"
>
	<div class="flex items-center justify-between gap-2">
		<a href={resolve('/')} class="btn-chunky px-3 py-1 text-sm">
			<IconArrowLeft class="size-4 rtl:rotate-180" aria-hidden="true" />
			{m.game_back()}
		</a>
		<LocaleSwitcher />
	</div>

	<h1
		class="inline-block self-start rounded-[16px_8px_14px_10px] border-3 border-ink bg-banner-slate px-4 py-2 text-3xl font-bold text-paper shadow-[4px_4px_0_var(--color-ink)]"
	>
		{m.about_title()}
	</h1>

	<section class="sticker flex flex-col gap-3 p-5" style:--tilt="-0.5deg">
		<h2 class="text-2xl font-bold">{m.about_fiction_heading()}</h2>
		<p class="leading-relaxed">{m.about_fiction_body()}</p>
		<p class="leading-relaxed">{m.about_satire_body()}</p>
	</section>
</main>
