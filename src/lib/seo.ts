/*
 * Link-preview metadata (Open Graph and Twitter cards). Every page is a static shell that is
 * rendered in the browser, and crawlers do not run scripts, so these tags are written into the
 * prerendered HTML by the server hook rather than set from the pages. Link previews therefore
 * always come out in English, the base language.
 */
import { APP_DESCRIPTION, APP_NAME } from '#lib/config.js';
import { MODES } from '#lib/modes/registry.js';
import { m } from '#lib/paraglide/messages.js';

/** Shared by the start screen and the about page; each game has its own, see OG_GAME_IMAGE_DIR */
export const OG_IMAGE_PATH = '/og-image.png';
export const OG_GAME_IMAGE_DIR = '/og';
export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;

const DESCRIPTION_MAX = 200;

export interface PageMeta {
	title: string;
	description: string;
	/** Preview image path, defaults to OG_IMAGE_PATH */
	image?: string;
}

/** Cuts a long text at a word boundary so previews do not end mid-word */
function shorten(text: string): string {
	if (text.length <= DESCRIPTION_MAX) return text;
	const cut = text.slice(0, DESCRIPTION_MAX - 1);
	return `${cut.slice(0, cut.lastIndexOf(' '))}…`;
}

function buildPages(): Map<string, PageMeta> {
	const pages = new Map<string, PageMeta>();
	pages.set('/', { title: APP_NAME, description: APP_DESCRIPTION });
	pages.set('/about', {
		title: `${m.about_title()} | ${APP_NAME}`,
		description: shorten(m.about_fiction_body())
	});
	for (const mode of MODES) {
		if (mode.status !== 'playable') continue;
		pages.set(mode.href, {
			title: `${mode.name()} | ${APP_NAME}`,
			description: shorten(mode.description()),
			image: `${OG_GAME_IMAGE_DIR}/${mode.id}.png`
		});
	}
	return pages;
}

/** Metadata by pathname, built on first use because the messages are only needed then */
let pages: Map<string, PageMeta> | undefined;

/** The metadata of a page, or undefined for a path that has none, such as the error page */
export function pageMeta(pathname: string): PageMeta | undefined {
	pages ??= buildPages();
	const path = pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname;
	return pages.get(path);
}

function escapeAttribute(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('"', '&quot;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;');
}

/**
 * The head tags for one page. `siteUrl` is the public origin; without it the tags that need an
 * absolute URL (canonical link, og:url, the image) are left out, as a relative one is invalid.
 */
export function metaTags(meta: PageMeta, pathname: string, siteUrl?: string): string {
	const tag = (attribute: 'name' | 'property', key: string, content: string | number) =>
		`<meta ${attribute}="${key}" content="${escapeAttribute(String(content))}" />`;

	const tags = [
		`<title>${escapeAttribute(meta.title)}</title>`,
		tag('name', 'description', meta.description),
		tag('property', 'og:type', 'website'),
		tag('property', 'og:site_name', APP_NAME),
		tag('property', 'og:locale', 'en_US'),
		tag('property', 'og:title', meta.title),
		tag('property', 'og:description', meta.description),
		tag('name', 'twitter:card', 'summary_large_image'),
		tag('name', 'twitter:title', meta.title),
		tag('name', 'twitter:description', meta.description)
	];

	if (siteUrl) {
		const pageUrl = new URL(pathname, siteUrl).href;
		const imageUrl = new URL(meta.image ?? OG_IMAGE_PATH, siteUrl).href;
		tags.push(
			`<link rel="canonical" href="${escapeAttribute(pageUrl)}" />`,
			tag('property', 'og:url', pageUrl),
			tag('property', 'og:image', imageUrl),
			tag('property', 'og:image:type', 'image/png'),
			tag('property', 'og:image:width', OG_IMAGE_WIDTH),
			tag('property', 'og:image:height', OG_IMAGE_HEIGHT),
			tag('property', 'og:image:alt', meta.image ? meta.title : `${APP_NAME}: ${APP_DESCRIPTION}`),
			tag('name', 'twitter:image', imageUrl)
		);
	}

	return tags.join('\n\t\t');
}
