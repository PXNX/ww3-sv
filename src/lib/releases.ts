// The releases bundled with the app (no network needed), parsed from CHANGELOG.md at build time.
import changelog from '../../CHANGELOG.md?raw';
import { parseChangelog } from './changelog.js';

export const releases = parseChangelog(changelog);
