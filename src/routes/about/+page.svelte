<!--
	About page: a short note that public figures appear as caricatures, other characters are fictional and that the jokes are satire aimed
	at governments, bureaucracy and situations (roadmap Section 1.4). The legal section at the bottom links the imprint, privacy policy,
	terms and withdrawal notice, which live as pages of their own under /legal.
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import { APP_NAME } from '#lib/config.js';
	import { LEGAL_PAGES } from '#lib/legal/pages.js';
	import { LEGAL_HREFS } from '#lib/legal/paths.js';
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

	<section class="sticker flex flex-col gap-3 p-5" style:--tilt="0.4deg">
		<h2 class="text-2xl font-bold">{m.about_legal_heading()}</h2>
		<p class="leading-relaxed">{m.about_legal_intro()}</p>
		<ul class="flex flex-col gap-2">
			{#each LEGAL_PAGES as page (page.id)}
				<li>
					<a
						href={LEGAL_HREFS[page.id]}
						class="flex flex-col gap-0.5 rounded-xl border-2 border-ink/15 px-3 py-2 transition hover:border-ink hover:bg-ink/5 focus-visible:border-ink focus-visible:bg-ink/5"
					>
						<span class="font-bold underline decoration-2 underline-offset-2">{page.title()}</span>
						<span class="text-sm leading-snug opacity-75">{page.summary()}</span>
					</a>
				</li>
			{/each}
		</ul>
	</section>

	<p class="text-center text-xs font-semibold opacity-60">
		{APP_NAME} v{__APP_VERSION__}
	</p>
</main>
