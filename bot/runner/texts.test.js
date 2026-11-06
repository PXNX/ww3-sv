// The bot's texts: both languages carry the same keys and placeholders, and the language follows
// the player's Telegram setting.
import { expect, test } from 'bun:test';

process.env.TELEGRAM ??= 'test';
process.env.DB_PATH = ':memory:';
const { LANGUAGES, langOf, t, textKeys } = await import('../tgcloud/lib/texts.js');

test('German and English have the same keys and placeholders', () => {
  const [de, en] = ['de', 'en'].map(textKeys);
  expect([...de].sort()).toEqual([...en].sort());
  const placeholders = (lang, key) => [...t(lang, key, {}).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  for (const key of en) expect(placeholders('de', key)).toEqual(placeholders('en', key));
  expect(LANGUAGES).toEqual(['de', 'en']);
});

test('German Telegram users get German, everyone else English', () => {
  expect(langOf('de')).toBe('de');
  expect(langOf('de-AT')).toBe('de');
  expect(langOf('en')).toBe('en');
  expect(langOf('uk')).toBe('en');
  expect(langOf(undefined)).toBe('en');
});

test('placeholders are filled and the legal footer is added', () => {
  const text = t('de', 'start', { name: 'Ada' });
  expect(text).toContain('Ada');
  expect(text).toContain('/impressum');
  expect(text).not.toMatch(/\{\w+\}/);
});
