/**
 * House adverts through litfass: our own channels and features. The bot's server fetches the feed
 * from the litfass server and forwards the counts (views, clicks, completed viewings as daily
 * totals), so the player's browser never contacts the advert server. Until that feed arrives, or
 * without a server, the adverts bundled with the game are shown.
 */
import {
	adStyleVars,
	localize,
	openAdLink,
	parseFeed,
	pickAd,
	type Ad,
	type AdEvent,
	type AdText,
	type Feed
} from '@militaernews/litfass';
import { getLocale } from '#lib/paraglide/runtime.js';
import { apiUrl } from '#lib/services/telegram.js';
import raw from './feed.json';

/** What the game is about, for picking among the bundled adverts (the server matches its own) */
const CATEGORIES = ['gaming', 'military', 'news'];
const bundled = parseFeed(raw);

let feed: Feed = bundled;
let loading: Promise<void> | null = null;
let lastId: string | undefined;

export interface HouseAd {
	ad: Ad;
	text: AdText;
	/** The advert's own colours as CSS variables (--litfass-bg, --litfass-fg, --litfass-accent) */
	style: Record<string, string>;
}

/** Fetches the current adverts once per page load; the bundled ones stay when that fails */
export function loadHouseAds(): Promise<void> {
	const url = apiUrl();
	if (!url) return Promise.resolve();
	loading ??= fetch(`${url}/api/ads`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: '{}'
	})
		.then((response) => response.json())
		.then((body: unknown) => {
			const result = (body as { ok?: boolean; result?: unknown } | null)?.ok
				? (body as { result: unknown }).result
				: null;
			const remote = parseFeed(result);
			if (remote.ads.length) feed = remote;
		})
		.catch(() => {});
	return loading;
}

/** The next rewarded advert, avoiding the one shown last; null when there is none */
export function nextHouseAd(): HouseAd | null {
	const ad = pickAd(feed, {
		placement: 'rewarded',
		exclude: lastId ? [lastId] : [],
		categories: CATEGORIES
	});
	if (!ad) return null;
	lastId = ad.id;
	return { ad, text: localize(ad, getLocale()), style: adStyleVars(ad.style) };
}

let queue: { ad: string; event: AdEvent }[] = [];
let timer: ReturnType<typeof setTimeout> | undefined;

/** Counts a view, click or completed viewing; batched and sent through the bot's server */
export function reportHouseAd(ad: Ad, event: AdEvent): void {
	const url = apiUrl();
	if (!url) return;
	queue.push({ ad: ad.id, event });
	timer ??= setTimeout(() => {
		timer = undefined;
		const events = queue.splice(0, 20);
		void fetch(`${url}/api/adevent`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ events }),
			keepalive: true
		}).catch(() => {});
		queue = [];
	}, 1500);
}

/** Opens the advert's link (inside Telegram for t.me links) and counts the click */
export function openHouseAd(houseAd: HouseAd): void {
	reportHouseAd(houseAd.ad, 'click');
	openAdLink(houseAd.ad.url);
}
