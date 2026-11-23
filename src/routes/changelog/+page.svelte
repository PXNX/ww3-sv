<!--
	Public version history. The same release list as the "what's new" sheet, but as a page that can be
	linked to from the About page, the settings and link previews. Opening it counts as seeing the
	newest release, so the sheet does not pop up afterwards.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import { APP_NAME } from '#lib/config.js';
	import { markVersionSeen } from '#lib/changelogSeen.js';
	import { releases } from '#lib/releases.js';
	import ChangelogList from '#lib/components/ChangelogList.svelte';
	import IconArrowLeft from '~icons/lucide/arrow-left';

	onMount(() => {
		const newest = releases[0];
		if (newest) markVersionSeen(newest.version);
	});
</script>

<svelte:head>
	<title>{m.changelog_page_title()} | {APP_NAME}</title>
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
		{m.changelog_page_title()}
	</h1>

	<p class="leading-relaxed">{m.changelog_intro()}</p>

	<ChangelogList {releases} current={__APP_VERSION__} />

	<p class="text-center text-xs font-semibold opacity-60">
		{APP_NAME} v{__APP_VERSION__}
	</p>
</main>
