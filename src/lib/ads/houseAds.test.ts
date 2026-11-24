import { describe, expect, it } from 'vitest';
import { parseFeed } from '@militaernews/litfass';
import raw from './feed.json';
import { nextHouseAd } from './houseAds';

describe('house adverts', () => {
	it('keeps every advert of the bundled feed, each with a text for every language', () => {
		const feed = parseFeed(raw);
		expect(feed.ads).toHaveLength(raw.ads.length);
		for (const ad of feed.ads) {
			expect(Object.keys(ad.text).sort()).toEqual(['ar', 'de', 'en', 'fa', 'ru', 'uk']);
		}
	});

	it('does not repeat the advert just shown and carries its colours', () => {
		const first = nextHouseAd();
		const second = nextHouseAd();
		expect(first).not.toBeNull();
		expect(second?.ad.id).not.toBe(first?.ad.id);
		expect(first?.style['--litfass-bg']).toBe('#0c3a6b');
	});
});
