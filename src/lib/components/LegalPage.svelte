<!--
	Shared frame for the four legal pages: back link, settings shortcut, the title, a warning that
	the text is still a template, the document itself, the last-updated date and links to the other
	three documents. The warning disappears once the operator data is real; until then it is the
	one thing a visitor must not miss.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { resolve } from '$app/paths';
	import { APP_NAME } from '#lib/config.js';
	import { LEGAL_UPDATED } from '#lib/legal/config.js';
	import { LEGAL_PAGES, type LegalPageInfo } from '#lib/legal/pages.js';
	import { LEGAL_HREFS } from '#lib/legal/paths.js';
	import { m } from '#lib/paraglide/messages.js';
	import IconArrowLeft from '~icons/lucide/arrow-left';
	import IconSettings from '~icons/lucide/settings';
	import IconTriangleAlert from '~icons/lucide/triangle-alert';

	interface Props {
		page: LegalPageInfo;
		children: Snippet;
	}

	let { page, children }: Props = $props();

	const others = $derived(LEGAL_PAGES.filter((entry) => entry.id !== page.id));
</script>

<svelte:head>
	<title>{page.title()} | {APP_NAME}</title>
</svelte:head>

<main
	class="mx-auto flex max-w-2xl flex-col gap-6 px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(3rem+env(safe-area-inset-bottom))]"
>
	<div class="flex items-center justify-between gap-2">
		<a href={resolve('/about')} class="btn-chunky px-3 py-1 text-sm whitespace-nowrap">
			<IconArrowLeft class="size-4 rtl:rotate-180" aria-hidden="true" />
			{m.legal_back_about()}
		</a>
		<a
			href={resolve('/settings')}
			class="btn-chunky size-9 rounded-full p-0"
			aria-label={m.settings_title()}
			title={m.settings_title()}
		>
			<IconSettings class="size-4" aria-hidden="true" />
		</a>
	</div>

	<h1
		class="inline-block self-start rounded-[16px_8px_14px_10px] border-3 border-ink bg-banner-slate px-4 py-2 text-3xl font-bold text-paper shadow-[4px_4px_0_var(--color-ink)]"
	>
		{page.title()}
	</h1>

	<aside
		class="flex items-start gap-2 rounded-[14px_8px_12px_9px] border-3 border-ink bg-mustard px-4 py-3 text-sm font-semibold shadow-[3px_3px_0_var(--color-ink)]"
		role="note"
	>
		<IconTriangleAlert class="mt-0.5 size-5 shrink-0" aria-hidden="true" />
		<p>{m.legal_template_notice()}</p>
	</aside>

	<article class="sticker flex flex-col gap-5 p-5" style:--tilt="-0.4deg">
		{@render children()}
	</article>

	<p class="text-center text-xs font-semibold opacity-60">
		{m.legal_updated({ date: LEGAL_UPDATED })}
	</p>

	<nav class="flex flex-col gap-3" aria-labelledby="legal-more-heading">
		<h2 id="legal-more-heading" class="text-lg font-bold">{m.legal_more_heading()}</h2>
		<ul class="flex flex-col gap-2">
			{#each others as entry (entry.id)}
				<li>
					<a
						href={LEGAL_HREFS[entry.id]}
						class="sticker sticker-interactive flex flex-col gap-1 p-4"
					>
						<span class="font-bold underline decoration-2 underline-offset-2">{entry.title()}</span>
						<span class="text-sm leading-snug opacity-75">{entry.summary()}</span>
					</a>
				</li>
			{/each}
		</ul>
	</nav>
</main>
