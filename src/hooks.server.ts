import type { Handle } from '@sveltejs/kit/hooks';
import { metaTags, pageMeta } from '#lib/seo.js';

// Read from process.env because the dynamic env module is empty while pages are prerendered.
// The public origin that link previews point at: set SITE_URL, or build on Vercel, which provides
// the production domain. Without either the tags that need an absolute URL are left out.
function siteUrl(): string | undefined {
	if (process.env.SITE_URL) return process.env.SITE_URL;
	if (process.env.VERCEL_PROJECT_PRODUCTION_URL)
		return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
	return undefined;
}

// Writes the Open Graph tags into the HTML of each page, since the pages render in the browser
export const handle: Handle = ({ event, resolve }) => {
	const { pathname } = event.url;
	const meta = pageMeta(pathname);
	if (!meta) return resolve(event);

	const tags = metaTags(meta, pathname, siteUrl());
	return resolve(event, {
		transformPageChunk: ({ html }) => html.replace('</head>', `\t${tags}\n\t</head>`)
	});
};
