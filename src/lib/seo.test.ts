import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MODES } from '#lib/modes/registry.js';
import { metaTags, pageMeta } from './seo';

describe('page metadata', () => {
	it('covers the start screen, the about page, the shop and every playable game', () => {
		expect(pageMeta('/')?.title).toBe('World War 3');
		expect(pageMeta('/about')?.title).toBe('About | World War 3');
		expect(pageMeta('/shop')?.title).toBe('Supply depot | World War 3');
		for (const mode of MODES) {
			if (mode.status === 'playable') expect(pageMeta(mode.href), mode.id).toBeDefined();
		}
	});

	it('ignores a trailing slash and returns nothing for an unknown path', () => {
		expect(pageMeta('/play/chess/')).toEqual(pageMeta('/play/chess'));
		expect(pageMeta('/nope')).toBeUndefined();
	});

	it('gives every game its own preview image that exists', () => {
		for (const mode of MODES) {
			if (mode.status !== 'playable') continue;
			const image = pageMeta(mode.href)!.image!;
			expect(image, mode.id).toBe(`/og/${mode.id}.png`);
			expect(existsSync(`static${image}`), mode.id).toBe(true);
		}
	});

	it('keeps every description short enough for a preview', () => {
		for (const mode of MODES) {
			if (mode.status === 'playable') {
				expect(pageMeta(mode.href)!.description.length, mode.id).toBeLessThanOrEqual(200);
			}
		}
	});
});

describe('meta tags', () => {
	const meta = { title: 'A "quoted" <title>', description: 'Fish & chips' };

	it('escapes attribute values', () => {
		const html = metaTags(meta, '/about');
		expect(html).toContain('content="A &quot;quoted&quot; &lt;title&gt;"');
		expect(html).toContain('content="Fish &amp; chips"');
	});

	it('adds absolute URLs only when the site URL is known', () => {
		expect(metaTags(meta, '/about')).not.toContain('og:image');
		const html = metaTags(meta, '/about', 'https://example.test');
		expect(html).toContain('<link rel="canonical" href="https://example.test/about" />');
		expect(
			metaTags({ ...meta, image: '/og/chess.png' }, '/play/chess', 'https://example.test')
		).toContain('content="https://example.test/og/chess.png"');
		expect(html).toContain('property="og:image" content="https://example.test/og-image.png"');
	});
});
