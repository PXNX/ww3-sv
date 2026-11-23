<!--
	Global "what's new" sheet mounted once in the root layout. Returning players with a newer release
	get it automatically; a fresh install is left alone. Settings and the About page can open the same
	sheet at any time. Opening it marks the newest release as seen, so it is shown only once.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import { unseenReleases } from '#lib/changelog.js';
	import { lastSeenVersion, markVersionSeen } from '#lib/changelogSeen.js';
	import { releases } from '#lib/releases.js';
	import { changelogSheet } from '#lib/stores/changelog.svelte.js';
	import ChangelogList from './ChangelogList.svelte';
	import IconX from '~icons/lucide/x';

	let dialog: HTMLDialogElement | undefined = $state();
	let unseen = $state<Set<string>>(new Set());

	onMount(() => {
		const lastSeen = lastSeenVersion();
		if (lastSeen && unseenReleases(releases, lastSeen).length) changelogSheet.show();
	});

	// Read the badges before the newest release counts as seen, so they last for this visit.
	$effect(() => {
		if (!changelogSheet.open) return;
		unseen = new Set(unseenReleases(releases, lastSeenVersion()).map((release) => release.version));
		const newest = releases[0];
		if (newest) markVersionSeen(newest.version);
	});

	$effect(() => {
		if (!dialog) return;
		if (changelogSheet.open && !dialog.open) dialog.showModal();
		else if (!changelogSheet.open && dialog.open) dialog.close();
	});
</script>

<dialog
	bind:this={dialog}
	class="modal modal-bottom sm:modal-middle"
	aria-labelledby="whats-new-title"
	onclose={() => (changelogSheet.open = false)}
>
	<div
		class="sticker relative modal-box flex max-h-[92dvh] flex-col gap-3 overflow-y-auto rounded-[18px_10px_16px_8px] border-3 border-ink bg-paper p-5 shadow-(--shadow-hard)"
		style:--tilt="1deg"
	>
		<div class="flex items-start justify-between gap-3 pe-10">
			<div>
				<h2 id="whats-new-title" class="font-display text-3xl leading-tight font-bold">
					{m.changelog_title()}
				</h2>
				<p class="text-xs font-bold opacity-60" dir="ltr">v{__APP_VERSION__}</p>
			</div>
			<button
				type="button"
				class="btn-chunky absolute top-2 right-2 flex size-9 items-center justify-center rounded-full p-0"
				aria-label={m.changelog_close()}
				onclick={() => dialog?.close()}
			>
				<IconX class="size-4" aria-hidden="true" />
			</button>
		</div>

		<ChangelogList {releases} {unseen} current={__APP_VERSION__} />

		<a href={resolve('/changelog')} class="btn-chunky self-start px-3 py-1.5 text-sm">
			{m.changelog_all()}
		</a>
	</div>

	<form method="dialog" class="modal-backdrop">
		<button aria-label={m.changelog_close()}>{m.changelog_close()}</button>
	</form>
</dialog>
