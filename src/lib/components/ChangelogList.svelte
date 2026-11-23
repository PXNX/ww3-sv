<!--
	The release list shared by the "what's new" sheet and the public page. Each release is a
	disclosure; inside, entries are grouped first by change type and then by the Conventional Commit
	scope they came from. Release notes are written in English on purpose, like the commit subjects
	they are cut from, so they are not a translation job on every release.
-->
<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { changeSections, type ChangelogRelease, type ChangeType } from '#lib/changelog.js';

	let {
		releases,
		unseen = new Set<string>(),
		current = ''
	}: {
		releases: ChangelogRelease[];
		unseen?: Set<string>;
		current?: string;
	} = $props();

	const sectionTitle: Record<ChangeType, string> = {
		new: 'New features',
		improved: 'Improved',
		fixed: 'Fixes',
		migration: 'Migration',
		known: 'Known issues'
	};

	function releaseDate(date: string): string {
		return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', {
			day: 'numeric',
			month: 'short',
			year: 'numeric',
			timeZone: 'UTC'
		});
	}
</script>

<div class="flex flex-col gap-2" lang="en" dir="ltr">
	{#each releases as release, index (release.version)}
		<details
			class="rounded-xl border-2 border-ink/15 bg-paper/60 p-3"
			open={index < 2 || unseen.has(release.version) || release.version === current}
		>
			<summary class="flex cursor-pointer list-none flex-wrap items-center gap-2">
				<span class="font-display text-lg leading-tight font-bold">v{release.version}</span>
				{#if unseen.has(release.version)}
					<span
						class="rounded-full bg-explosion-yellow px-2 py-0.5 text-[0.65rem] font-black tracking-wide uppercase"
					>
						{m.changelog_unseen()}
					</span>
				{/if}
				<span class="ms-auto text-xs font-bold opacity-60">{releaseDate(release.date)}</span>
			</summary>

			{#if release.summary}
				<p class="mt-2 text-sm leading-snug font-bold">{release.summary}</p>
			{/if}

			{#each changeSections(release.entries) as section (section.type)}
				<h3 class="mt-3 mb-1 text-xs font-black tracking-widest uppercase opacity-70">
					{sectionTitle[section.type]}
				</h3>
				{#each section.groups as group}
					{#if group.scope}
						<h4 class="mt-2 mb-0.5 text-sm font-bold">{group.scope}</h4>
					{/if}
					<ul class="ms-5 list-disc text-sm leading-snug">
						{#each group.entries as entry}<li>{entry}</li>{/each}
					</ul>
				{/each}
			{/each}
		</details>
	{/each}
</div>
