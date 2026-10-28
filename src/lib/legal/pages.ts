/*
 * The four legal documents in the order the About page links them. Titles and summaries come from
 * the message files, so this one list feeds the About section, the cross-links on each document
 * and the link-preview metadata in `seo.ts`.
 */
import { m } from '#lib/paraglide/messages.js';

export type LegalPageId = 'imprint' | 'privacy' | 'terms' | 'withdrawal';

export type LegalPagePath =
	'/legal/imprint' | '/legal/privacy' | '/legal/terms' | '/legal/withdrawal';

export interface LegalPageInfo {
	id: LegalPageId;
	path: LegalPagePath;
	title: () => string;
	summary: () => string;
}

export const IMPRINT_PAGE: LegalPageInfo = {
	id: 'imprint',
	path: '/legal/imprint',
	title: m.legal_imprint_title,
	summary: m.legal_imprint_summary
};

export const PRIVACY_PAGE: LegalPageInfo = {
	id: 'privacy',
	path: '/legal/privacy',
	title: m.legal_privacy_title,
	summary: m.legal_privacy_summary
};

export const TERMS_PAGE: LegalPageInfo = {
	id: 'terms',
	path: '/legal/terms',
	title: m.legal_terms_title,
	summary: m.legal_terms_summary
};

export const WITHDRAWAL_PAGE: LegalPageInfo = {
	id: 'withdrawal',
	path: '/legal/withdrawal',
	title: m.legal_withdrawal_title,
	summary: m.legal_withdrawal_summary
};

export const LEGAL_PAGES: readonly LegalPageInfo[] = [
	IMPRINT_PAGE,
	PRIVACY_PAGE,
	TERMS_PAGE,
	WITHDRAWAL_PAGE
];
