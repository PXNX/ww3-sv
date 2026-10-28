/*
 * The routes of the legal pages, resolved once. `resolve()` has one overload per route and gives
 * up on a union of paths, so every route is spelled out here; the pages themselves stay free of
 * `$app/paths`, which keeps `pages.ts` importable from plain unit tests.
 */
import { resolve } from '$app/paths';
import type { LegalPageId } from './pages.js';

export const LEGAL_HREFS: Record<LegalPageId, string> = {
	imprint: resolve('/legal/imprint'),
	privacy: resolve('/legal/privacy'),
	terms: resolve('/legal/terms'),
	withdrawal: resolve('/legal/withdrawal')
};
