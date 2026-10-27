import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { PAGES, fillText, renderHtml } from '../scripts/legal-render.mjs';

const config = {
  operator: { name: 'Erika Muster', street: 'Weg 1', city: '12345 Ort', country: 'Deutschland', email: 'a@b.de', phone: '', vat_id: '' },
  legalUpdated: '27.10.2026',
};

test('every legal page fills all its placeholders', () => {
  for (const page of Object.keys(PAGES)) {
    const text = fillText(readFileSync(new URL(`../legal/${page}.txt`, import.meta.url), 'utf8'), config);
    assert.doesNotMatch(text, /\{\w+\}/, page);
    assert.match(text, /Stand: 27\.10\.2026/, page);
  }
});

test('the Impressum names the operator and omits empty optional lines', () => {
  const text = fillText(readFileSync(new URL('../legal/impressum.txt', import.meta.url), 'utf8'), config);
  assert.match(text, /Erika Muster\nWeg 1\n12345 Ort/);
  assert.doesNotMatch(text, /Telefon|Umsatzsteuer/);
});

test('missing operator data stops the build', () => {
  assert.throws(() => fillText('{name}', { operator: { name: 'x' } }), /operator\.street/);
});

test('unknown placeholders stop the build', () => {
  assert.throws(() => fillText('{nope}', config), /unknown placeholder/);
});

test('rendering escapes HTML and links URLs', () => {
  const html = renderHtml('datenschutz', '# Titel\n\n## A <b>\n\nSiehe https://telegram.org/privacy.\n\n- eins\n- zwei');
  assert.match(html, /<h1>Titel<\/h1>/);
  assert.match(html, /<h2>A &lt;b&gt;<\/h2>/);
  assert.match(html, /<a href="https:\/\/telegram.org\/privacy">https:\/\/telegram.org\/privacy<\/a>\./);
  assert.match(html, /<ul><li>eins<\/li><li>zwei<\/li><\/ul>/);
});
