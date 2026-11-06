// The legal texts German law asks for when selling digital goods: Impressum, Datenschutzerklärung,
// AGB and Widerrufsbelehrung. Their sources are legal/*.txt; `npm run build` fills in the operator
// data from config.local.json and writes them to generated.js (and as web pages next to the Mini
// App). This module renders them as Telegram messages.

import { LEGAL_URL, TEXTS } from './generated.js';

export const PAGES = {
  impressum: 'Impressum',
  datenschutz: 'Datenschutz',
  agb: 'AGB',
  widerruf: 'Widerruf',
};

// Bump when the AGB or the Widerrufsbelehrung change; buyers consent again on their next purchase
export const CONSENT_VERSION = '2026-10-27';

// The wording § 356 Abs. 4 and 5 BGB asks for, shown before the first purchase of a version
export const CONSENT_TEXT =
  'Ich stimme ausdrücklich zu, dass mit der Ausführung des Vertrags vor Ablauf der Widerrufsfrist ' +
  'begonnen wird. Mir ist bekannt, dass ich bei Revival-Token mit Beginn der Ausführung und bei ' +
  'World War 3 Pro mit vollständiger Erbringung mein Widerrufsrecht verliere. Ich akzeptiere die AGB.';

const TELEGRAM_LIMIT = 4000;

export function escapeHtml(text) {
  return String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

export function pageUrl(page) {
  return LEGAL_URL ? `${LEGAL_URL}/${page}.html` : '';
}

function blocks(text) {
  return text.split(/\n\s*\n/).map((block) => block.split('\n').filter((line) => line.trim())).filter((b) => b.length);
}

/** A legal page as Telegram HTML messages, each under the message length limit */
export function legalMessages(page) {
  const parts = [];
  for (let block of blocks(TEXTS[page])) {
    if (block[0].startsWith('#')) {
      parts.push(`<b>${escapeHtml(block[0].replace(/^#+\s*/, ''))}</b>`);
      block = block.slice(1);
    }
    if (block.length) {
      parts.push(block.map((line) => (line.startsWith('- ') ? `• ${escapeHtml(line.slice(2))}` : escapeHtml(line))).join('\n'));
    }
  }
  const messages = [];
  let current = '';
  for (const part of parts) {
    const candidate = current ? `${current}\n\n${part}` : part;
    if (candidate.length > TELEGRAM_LIMIT && current) {
      messages.push(current);
      current = part;
    } else {
      current = candidate;
    }
  }
  if (current) messages.push(current);
  return messages;
}
