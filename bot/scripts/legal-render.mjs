// Fills the legal sources (legal/*.txt) with the operator data and renders them as small web pages.
// Pure functions, used by build.mjs and the tests.

export const PAGES = {
  impressum: 'Impressum',
  datenschutz: 'Datenschutz',
  agb: 'AGB',
  widerruf: 'Widerruf',
};

const REQUIRED = ['name', 'street', 'city', 'country', 'email'];

export function fillText(source, config) {
  const { operator } = config;
  for (const key of REQUIRED) {
    if (!operator?.[key]) throw new Error(`config.local.json: operator.${key} is missing`);
  }
  const values = {
    ...operator,
    updated: config.legalUpdated ?? '',
    phone_line: operator.phone ? `Telefon: ${operator.phone}` : '',
    vat_line: operator.vat_id ? `Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG: ${operator.vat_id}` : '',
  };
  return source.replace(/\{(\w+)\}/g, (match, key) => {
    if (!(key in values)) throw new Error(`legal text: unknown placeholder ${match}`);
    return values[key];
  });
}

const escapeHtml = (text) =>
  String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

// Plain https URLs in the texts become links
const linkify = (escaped) => escaped.replace(/https:\/\/[^\s<]+[^\s<.,)]/g, (url) => `<a href="${url}">${url}</a>`);

export function renderHtml(page, text) {
  const body = [];
  let title = PAGES[page];
  for (const raw of text.split(/\n\s*\n/)) {
    let block = raw.split('\n').filter((line) => line.trim());
    if (!block.length) continue;
    if (block[0].startsWith('# ')) {
      title = block[0].slice(2);
      body.push(`<h1>${escapeHtml(title)}</h1>`);
      block = block.slice(1);
    } else if (block[0].startsWith('## ')) {
      body.push(`<h2>${escapeHtml(block[0].slice(3))}</h2>`);
      block = block.slice(1);
    }
    if (!block.length) continue;
    if (block.every((line) => line.startsWith('- '))) {
      body.push(`<ul>${block.map((line) => `<li>${linkify(escapeHtml(line.slice(2)))}</li>`).join('')}</ul>`);
    } else {
      body.push(`<p>${block.map((line) => linkify(escapeHtml(line))).join('<br>')}</p>`);
    }
  }
  const nav = Object.entries(PAGES).map(([key, label]) => `<a href="/legal/${key}.html">${label}</a>`).join(' · ');
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} · World War 3</title>
<style>
body { font: 16px/1.55 system-ui, sans-serif; max-width: 46rem; margin: 0 auto; padding: 1.5rem 1rem 3rem; color: #1d1a16; background: #f6efe0; }
h1 { font-size: 1.7rem; } h2 { font-size: 1.15rem; margin-top: 1.8rem; }
nav { font-size: .9rem; margin-bottom: 1rem; } a { color: #7a4b12; overflow-wrap: anywhere; }
</style>
</head>
<body>
<nav><a href="/">World War 3</a> · ${nav}</nav>
${body.join('\n')}
</body>
</html>
`;
}
