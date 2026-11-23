// Cuts a release: moves the Unreleased entries of CHANGELOG.md under a new version, adds the
// feat/fix commits since the last tag, bumps package.json and publishes the tag and GitHub release.
//
//   bun scripts/release.ts "One-line summary" [--major | --patch] [--dry-run]
//
// Run it on a clean, pushed `main`. The summary is the highlight shown in the app's changelog.
// Entries carry their Conventional Commit scope, so the written sections use `#### <scope>`
// subheadings under each `### <type>` heading.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import {
	commitEntries,
	entriesMarkdown,
	parseChangelog,
	type ChangeEntries,
	type ChangeEntry,
	type ChangeType
} from '../src/lib/changelog.js';
import { bumpVersion, latestVersion, type AppVersion } from '../src/lib/version.js';

/**
 * Moves the Unreleased section under a new heading, merging manual entries with the ones derived
 * from commit subjects (deduplicated by scope and text); throws when there is nothing to release.
 */
export function cutChangelog(
	markdown: string,
	version: AppVersion,
	date: string,
	summary: string,
	commitSubjects: readonly string[] = []
): { changelog: string; notes: string } {
	const start = markdown.search(/^## \[?unreleased\]?.*$/imu);
	if (start < 0) throw new Error('CHANGELOG.md has no "## Unreleased" section');
	const headingEnd = markdown.indexOf('\n', start) + 1;
	const nextRelease = markdown.slice(headingEnd).search(/^## /mu);
	const end = nextRelease < 0 ? markdown.length : headingEnd + nextRelease;
	const manual = parseChangelog(`## v0.0.0 - 2000-01-01\n\n${markdown.slice(headingEnd, end)}`)[0]!
		.entries;
	const fromCommits = commitEntries(commitSubjects);
	const entries: ChangeEntries = {};
	for (const source of [manual, fromCommits]) {
		for (const [type, items] of Object.entries(source) as Array<[ChangeType, ChangeEntry[]]>) {
			const list = (entries[type] ??= []);
			for (const item of items) {
				if (!list.some((existing) => existing.scope === item.scope && existing.text === item.text))
					list.push(item);
			}
		}
	}
	const body = entriesMarkdown(entries);
	if (!body)
		throw new Error('Nothing to release: no entries under "Unreleased" and no feat/fix commits');
	const section = `## v${version} - ${date}\n\n${summary.trim()}\n\n${body}\n`;
	const changelog =
		`${markdown.slice(0, start)}## Unreleased\n\n${section}\n${markdown.slice(end)}`.replace(
			/\n{3,}/gu,
			'\n\n'
		);
	parseChangelog(changelog);
	return { changelog, notes: `${summary.trim()}\n\n${body}\n` };
}

/** GitHub's "Full Changelog" line: every commit between the previous release and this one. */
export function fullChangelogLink(repository: string, previous: string, version: string): string {
	return `**Full Changelog**: https://github.com/${repository}/compare/v${previous}...v${version}`;
}

function run(command: string, args: string[], dryRun: boolean) {
	console.log(`$ ${command} ${args.join(' ')}`);
	if (!dryRun) execFileSync(command, args, { stdio: 'inherit' });
}

if (import.meta.main) {
	const args = process.argv.slice(2);
	const dryRun = args.includes('--dry-run');
	const summary = args.find((arg) => !arg.startsWith('--'));
	if (!summary)
		throw new Error(
			'Usage: bun scripts/release.ts "One-line summary" [--major | --patch] [--dry-run]'
		);

	if (
		execFileSync('git', ['status', '--porcelain', '--', 'CHANGELOG.md', 'package.json'], {
			encoding: 'utf8'
		}).trim()
	) {
		throw new Error('CHANGELOG.md or package.json has uncommitted changes');
	}
	execFileSync('git', ['fetch', '--tags', '--quiet']);
	const tags = execFileSync('git', ['tag', '--list', 'v*'], { encoding: 'utf8' })
		.split('\n')
		.filter(Boolean);
	const previous = latestVersion(tags);
	const now = new Date();
	const bump = args.includes('--major') ? 'major' : args.includes('--patch') ? 'patch' : 'minor';
	const version = bumpVersion(previous, bump);
	const date = now.toISOString().slice(0, 10);
	const subjects = execFileSync('git', ['log', '--format=%s', `v${previous}..HEAD`], {
		encoding: 'utf8'
	})
		.split('\n')
		.filter(Boolean)
		.reverse();
	const { changelog, notes } = cutChangelog(
		readFileSync('CHANGELOG.md', 'utf8'),
		version,
		date,
		summary,
		subjects
	);
	const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };
	pkg.version = version;

	const repository = execFileSync(
		'gh',
		['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner'],
		{
			encoding: 'utf8'
		}
	).trim();
	const releaseNotes = `${notes}\n${fullChangelogLink(repository, previous, version)}\n`;
	console.log(`Releasing ${version}\n\n${releaseNotes}`);
	if (!dryRun) {
		writeFileSync('CHANGELOG.md', changelog);
		writeFileSync('package.json', `${JSON.stringify(pkg, null, 2)}\n`);
	}
	run('git', ['add', 'CHANGELOG.md', 'package.json'], dryRun);
	run('git', ['commit', '-m', `chore(release): ${version}`], dryRun);
	run('git', ['tag', '-a', `v${version}`, '-m', `World War 3 ${version}: ${summary}`], dryRun);
	run('git', ['push', 'origin', 'HEAD', `v${version}`], dryRun);
	run(
		'gh',
		[
			'release',
			'create',
			`v${version}`,
			'--title',
			`World War 3 ${version}`,
			'--notes',
			releaseNotes
		],
		dryRun
	);
}
