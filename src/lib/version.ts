/*
 * App versions: semantic `MAJOR.MINOR.PATCH` as in package.json, with `-rc.N` for previews. Pure
 * module so both the app and the release script can use it, including in unit tests (where the
 * `__APP_VERSION__` define is not present).
 */

declare const versionBrand: unique symbol;
export type AppVersion = string & { readonly [versionBrand]: true };

export interface ParsedVersion {
	major: number;
	minor: number;
	patch: number;
	/** Release-candidate number, or null for a final release. */
	rc: number | null;
}

const VERSION = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-rc\.([1-9]\d*))?$/u;

export function parseVersion(value: string): ParsedVersion | null {
	const match = VERSION.exec(value.trim());
	if (!match) return null;
	return {
		major: Number(match[1]),
		minor: Number(match[2]),
		patch: Number(match[3]),
		rc: match[4] ? Number(match[4]) : null
	};
}

export function isAppVersion(value: unknown): value is AppVersion {
	return typeof value === 'string' && parseVersion(value) !== null && !value.startsWith('v');
}

export function appVersion(value: string): AppVersion {
	const parsed = parseVersion(value);
	if (!parsed) throw new Error(`Not a version: ${value}`);
	return format(parsed);
}

function format(parsed: ParsedVersion): AppVersion {
	return `${parsed.major}.${parsed.minor}.${parsed.patch}${parsed.rc ? `-rc.${parsed.rc}` : ''}` as AppVersion;
}

/** Negative when a < b, positive when a > b; a release candidate sorts before its release. */
export function compareVersions(a: string, b: string): number {
	const left = parseVersion(a);
	const right = parseVersion(b);
	if (!left || !right) throw new Error(`Cannot compare ${a} and ${b}`);
	return (
		left.major - right.major ||
		left.minor - right.minor ||
		left.patch - right.patch ||
		(left.rc ?? Infinity) - (right.rc ?? Infinity) ||
		0
	);
}

export type VersionBump = 'major' | 'minor' | 'patch';

/** The highest final release among git tags (`v1.2.3`), or 1.0.0 when none is tagged yet. */
export function latestVersion(tags: readonly string[]): AppVersion {
	let latest: AppVersion | null = null;
	for (const tag of tags) {
		const parsed = parseVersion(tag);
		if (!parsed || parsed.rc !== null) continue;
		const version = format(parsed);
		if (!latest || compareVersions(version, latest) > 0) latest = version;
	}
	return latest ?? ('1.0.0' as AppVersion);
}

/** The next version after `current`: features bump MINOR, fixes PATCH, breaking changes MAJOR. */
export function bumpVersion(current: string, bump: VersionBump): AppVersion {
	const parsed = parseVersion(current);
	if (!parsed) throw new Error(`Not a version: ${current}`);
	if (bump === 'major') return format({ major: parsed.major + 1, minor: 0, patch: 0, rc: null });
	if (bump === 'minor')
		return format({ major: parsed.major, minor: parsed.minor + 1, patch: 0, rc: null });
	return format({ ...parsed, patch: parsed.patch + 1, rc: null });
}
