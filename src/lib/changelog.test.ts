import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
	ChangelogError,
	changeSections,
	commitEntries,
	entriesMarkdown,
	groupByScope,
	parseChangelog,
	releaseAnchor,
	unseenReleases
} from './changelog';
import {
	appVersion,
	bumpVersion,
	compareVersions,
	isAppVersion,
	latestVersion,
	parseVersion
} from './version';
import { cutChangelog, fullChangelogLink } from '../../scripts/release';

const SAMPLE = `# Changelog

## Unreleased

### New
- Work in progress

## v1.1.0 - 2026-11-12

Formatting follows the learned language.

### New
- Format like setting
#### parking
- One hint per level
### Fixed
- Weekday names

## v1.0.0 - 2026-11-05

Baseline.

### New
- Everything
`;

describe('versions', () => {
	it('parses and validates versions', () => {
		expect(parseVersion('1.2.0')).toEqual({ major: 1, minor: 2, patch: 0, rc: null });
		expect(parseVersion('v2.0.0-rc.1')).toEqual({ major: 2, minor: 0, patch: 0, rc: 1 });
		expect(parseVersion('1.02.0')).toBeNull();
		expect(isAppVersion('1.1.0')).toBe(true);
		expect(isAppVersion('v1.1.0')).toBe(false);
		expect(appVersion('v1.1.0')).toBe('1.1.0');
	});

	it('orders versions numerically and bumps from the latest final tag', () => {
		expect(['1.10.0', '1.0.0', '1.2.0', '2.0.0', '1.2.0-rc.1'].sort(compareVersions)).toEqual([
			'1.0.0',
			'1.2.0-rc.1',
			'1.2.0',
			'1.10.0',
			'2.0.0'
		]);
		expect(latestVersion(['v1.0.0', 'v1.10.1', 'v1.11.0-rc.1', 'nightly'])).toBe('1.10.1');
		expect(bumpVersion('1.10.1', 'minor')).toBe('1.11.0');
		expect(bumpVersion('1.10.1', 'patch')).toBe('1.10.2');
		expect(bumpVersion('1.2.0-rc.2', 'major')).toBe('2.0.0');
	});
});

describe('changelog parsing', () => {
	it('lists tagged releases newest first, skips unreleased work and keeps each scope', () => {
		const releases = parseChangelog(SAMPLE);
		expect(releases.map((release) => release.version)).toEqual(['1.1.0', '1.0.0']);
		expect(releases[0]).toEqual({
			version: '1.1.0',
			date: '2026-11-12',
			summary: 'Formatting follows the learned language.',
			entries: {
				new: [
					{ scope: null, text: 'Format like setting' },
					{ scope: 'parking', text: 'One hint per level' }
				],
				fixed: [{ scope: null, text: 'Weekday names' }]
			}
		});
	});

	it('rejects malformed sections, entries and scopes', () => {
		expect(() => parseChangelog('## 2026.11 - 2026-11-12')).toThrow(ChangelogError);
		expect(() => parseChangelog('## v1.1.0 - 2026-11-12\n### Stuff\n- x')).toThrow(
			'unknown section'
		);
		expect(() => parseChangelog('## v1.1.0 - 2026-11-12\n- x')).toThrow('outside a section');
		expect(() => parseChangelog('## v1.1.0 - 2026-11-12\n#### parking\n- x')).toThrow(
			'scope outside a section'
		);
	});

	it('finds unseen releases and names anchors', () => {
		const releases = parseChangelog(SAMPLE);
		expect(unseenReleases(releases, null)).toHaveLength(2);
		expect(unseenReleases(releases, '1.0.0').map((release) => release.version)).toEqual(['1.1.0']);
		expect(unseenReleases(releases, '1.1.0')).toEqual([]);
		expect(releaseAnchor(appVersion('1.1.0'))).toBe('v1.1.0');
	});

	it('keeps the real CHANGELOG.md valid', () => {
		const releases = parseChangelog(
			readFileSync(new URL('../../CHANGELOG.md', import.meta.url), 'utf8')
		);
		expect(releases.at(-1)?.version).toBe('1.0.0');
		expect(changeSections(releases[0]!.entries).length).toBeGreaterThan(0);
	});
});

describe('grouping by type and scope', () => {
	it('groups consecutive entries by scope, keeping unscoped ones first', () => {
		expect(
			groupByScope([
				{ scope: null, text: 'Manual' },
				{ scope: 'parking', text: 'First parking change' },
				{ scope: 'flamingo', text: 'Flamingo change' },
				{ scope: 'parking', text: 'Second parking change' }
			])
		).toEqual([
			{ scope: null, entries: ['Manual'] },
			{ scope: 'parking', entries: ['First parking change', 'Second parking change'] },
			{ scope: 'flamingo', entries: ['Flamingo change'] }
		]);
	});

	it('puts scope groups under their type in the canonical order', () => {
		const entries = commitEntries([
			'feat: a general improvement',
			'feat(parking): one hint per level',
			'feat(flamingo): a rare bridge',
			'feat(parking): a second hint',
			'fix(maze): a shared daily'
		]);
		expect(
			changeSections(entries).map(({ type, groups }) => [type, groups.map((g) => g.scope)])
		).toEqual([
			['new', [null, 'parking', 'flamingo']],
			['fixed', ['maze']]
		]);
	});

	it('writes scope subheadings under each type in markdown', () => {
		const entries = commitEntries([
			'feat: a general improvement',
			'feat(parking): one hint per level.',
			'feat(maze): a shared daily',
			'feat(parking): a second hint',
			'fix(flamingo): label the bridge'
		]);
		expect(entriesMarkdown(entries)).toBe(
			'### New\n- A general improvement\n\n#### parking\n- One hint per level\n- A second hint\n\n' +
				'#### maze\n- A shared daily\n\n### Fixed\n#### flamingo\n- Label the bridge'
		);
	});

	it('reads scope subheadings back per release', () => {
		const [newest, older] = parseChangelog(
			'## v1.1.0 - 2026-11-12\n\nHi.\n\n### New\n- General\n\n#### parking\n- Scoped\n\n' +
				'## v1.0.0 - 2026-11-05\n\nBase.\n\n### Fixed\n#### flamingo\n- Older\n'
		);
		expect(newest!.entries).toEqual({
			new: [
				{ scope: null, text: 'General' },
				{ scope: 'parking', text: 'Scoped' }
			]
		});
		expect(older!.entries).toEqual({ fixed: [{ scope: 'flamingo', text: 'Older' }] });
	});
});

describe('cutting a release', () => {
	const CUT_SAMPLE = `# Changelog

## Unreleased

### New
- Work in progress

## v1.0.0 - 2026-11-05

Base.

### New
- Everything
`;

	it('merges manual and commit entries as scope-grouped bullets', () => {
		const { changelog, notes } = cutChangelog(
			CUT_SAMPLE,
			appVersion('1.1.0'),
			'2026-11-12',
			'Next one.',
			['feat(parking): add a hint', 'fix(flamingo): label the bridge', 'chore(ci): bump']
		);
		expect(changelog).toContain(
			'## v1.1.0 - 2026-11-12\n\nNext one.\n\n### New\n- Work in progress\n\n' +
				'#### parking\n- Add a hint\n\n### Fixed\n#### flamingo\n- Label the bridge\n'
		);
		expect(changelog).not.toContain('bump');
		expect(notes).toContain('#### parking');
		expect(parseChangelog(changelog)[0]!.version).toBe('1.1.0');
		expect(() => cutChangelog(changelog, appVersion('1.2.0'), '2026-11-13', 'Empty')).toThrow(
			'Nothing to release'
		);
	});

	it('links the full changelog between the previous and new versions', () => {
		expect(fullChangelogLink('PXNX/ww3-sv', '1.0.0', '1.1.0')).toBe(
			'**Full Changelog**: https://github.com/PXNX/ww3-sv/compare/v1.0.0...v1.1.0'
		);
	});
});

describe('release notes from commits', () => {
	it('lists features and fixes with their scope, never docs or chore', () => {
		expect(
			commitEntries([
				'feat(parking): finish the per-level hint',
				'fix(flamingo): label the bridge.',
				'docs(todo): track the plan',
				'chore(release): 1.1.0',
				'refactor(format): cache week info',
				'feat(api)!: drop the old endpoint',
				'Merge branch main'
			])
		).toEqual({
			new: [{ scope: 'parking', text: 'Finish the per-level hint' }],
			fixed: [{ scope: 'flamingo', text: 'Label the bridge' }],
			migration: [{ scope: 'api', text: 'Drop the old endpoint' }]
		});
	});

	it('deduplicates by scope and text', () => {
		expect(
			commitEntries(['feat(parking): same', 'feat(parking): same', 'feat(maze): same'])
		).toEqual({
			new: [
				{ scope: 'parking', text: 'Same' },
				{ scope: 'maze', text: 'Same' }
			]
		});
	});
});
