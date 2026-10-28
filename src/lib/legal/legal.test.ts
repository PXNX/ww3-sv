/*
 * Guards for the legal pages: every string exists in all six languages, the operator data is still
 * marked as a placeholder (so the template warning cannot ship by accident), and each document has
 * a unique route with link-preview metadata.
 */
import { describe, expect, it } from 'vitest';
import { pageMeta } from '#lib/seo.js';
import {
	hasPersianScript,
	loadMessages,
	messageKeys,
	missingMessages
} from '#lib/testing/messages.js';
import { LEGAL_OPERATOR, LEGAL_UPDATED } from './config.js';
import { LEGAL_PAGES } from './pages.js';

describe('legal pages', () => {
	it('has messages in every language', () => {
		expect(missingMessages(['legal_', 'about_legal_'])).toEqual([]);
	});

	it('keeps a TODO in every operator field until the real data arrives', () => {
		for (const [field, value] of Object.entries(LEGAL_OPERATOR)) {
			expect(value, field).toMatch(/^TODO:/);
		}
		expect(LEGAL_UPDATED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});

	it('lists four unique documents, each with a title, a summary and metadata', () => {
		expect(LEGAL_PAGES).toHaveLength(4);
		expect(new Set(LEGAL_PAGES.map((page) => page.path)).size).toBe(4);
		for (const page of LEGAL_PAGES) {
			expect(page.path, page.id).toBe(`/legal/${page.id}`);
			expect(page.title(), page.id).not.toBe('');
			expect(page.summary(), page.id).not.toBe('');
			expect(pageMeta(page.path), page.id).toBeDefined();
		}
	});

	it('has Persian text for every legal message', () => {
		const fa = loadMessages('fa');
		const untranslated = messageKeys(['legal_']).filter((key) => !hasPersianScript(fa[key]));
		expect(untranslated).toEqual([]);
	});
});
