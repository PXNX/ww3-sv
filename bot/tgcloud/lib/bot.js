// The chat side of the bot: opening the game (which is the login: a Mini App session carries the
// player's verified Telegram identity), the shop, the wallet, the legal pages and the purchase
// confirmation. Shared by handlers/message and handlers/callback_query.

import { api } from 'sdk';
import { PRODUCTS, product } from './catalogue.js';
import { ADMIN_IDS, APP_URL, OPERATOR, SALES_OPEN } from './generated.js';
import { createInvoice, hasConsent, recordConsent, upsertAccount, wallet } from './ledger.js';
import { isMuted, setMuted, texts as reminderTexts } from './reminders.js';
import { CONSENT_TEXT, CONSENT_VERSION, PAGES, escapeHtml, legalMessages, pageUrl } from './legal.js';

export async function send(chatId, text, extra = {}) {
  return await api.sendMessage({
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
    ...extra,
  });
}

function playButton(label = '🎮 Play World War 3', path = '') {
  return APP_URL ? [{ text: label, web_app: { url: `${APP_URL}/${path}` } }] : [];
}

const formatDate = (seconds) => new Date(seconds * 1000).toISOString().slice(0, 16).replace('T', ' ') + ' UTC';

export async function start(message, param) {
  await upsertAccount(message.from);
  if (param === 'shop') return await shop(message.chat.id);
  const keyboard = [playButton(), [{ text: '🛒 Supply depot', callback_data: 'shop' }]].filter((row) => row.length);
  await send(message.chat.id,
    `Welcome, ${escapeHtml(message.from.first_name)}! Open the game below: inside Telegram you are signed in ` +
    'with your Telegram account, so bought revival tokens and Pro follow you to every device.\n\n' +
    '/shop – revival tokens and Pro\n/wallet – what you bought\n/reminders – streak reminders on or off\n' +
    '/paysupport – help with purchases\n' +
    '/agb · /widerruf · /datenschutz · /impressum',
    { reply_markup: { inline_keyboard: keyboard } });
}

export async function login(message) {
  await upsertAccount(message.from);
  if (!APP_URL) return await send(message.chat.id, 'The game is not deployed yet.');
  await send(message.chat.id,
    'Tap below to open World War 3 signed in as your Telegram account. Your profile page shows who you are signed in as.',
    { reply_markup: { inline_keyboard: [playButton('🎮 Log in and play', 'profile')] } });
}

export async function shop(chatId) {
  await send(chatId,
    '<b>Supply depot</b>\nPrices in Telegram Stars. Bought revival tokens are credited to your Telegram ' +
    'account right away and can be used in the game inside Telegram.',
    { reply_markup: { inline_keyboard: PRODUCTS.map((item) => [{ text: `${item.title} · ${item.stars} ⭐`, callback_data: `buy:${item.sku}` }]) } });
}

export async function showWallet(chatId, user) {
  await upsertAccount(user);
  const current = await wallet(user.id);
  await send(chatId,
    `<b>Bought with Stars</b>\n❤️ ${current.revives} revival tokens\n` +
    `⭐ Pro: ${current.pro ? `active until ${formatDate(current.proUntil)}` : 'not active'}`);
}

function legalButtons() {
  return ['agb', 'widerruf'].map((page) =>
    pageUrl(page) ? { text: PAGES[page], url: pageUrl(page) } : { text: PAGES[page], callback_data: `legal:${page}` });
}

/** Sends the invoice, after asking for consent if the current terms were not agreed to yet */
export async function offer(chatId, user, sku) {
  const item = product(sku);
  if (!item) return await shop(chatId);
  await upsertAccount(user);
  if (!SALES_OPEN) {
    return await send(chatId, 'Purchases open soon. Until then every game is free to play.');
  }

  if (!(await hasConsent(user.id))) {
    return await send(chatId,
      `<b>${escapeHtml(item.title)} · ${item.stars} ⭐</b>\n${escapeHtml(item.description)}\n\n<i>${escapeHtml(CONSENT_TEXT)}</i>`,
      { reply_markup: { inline_keyboard: [
        [{ text: '✅ Agree and continue', callback_data: `consent:${item.sku}` }],
        legalButtons(),
        [{ text: 'Cancel', callback_data: 'cancel' }],
      ] } });
  }

  const invoice = await createInvoice(user.id, item);
  const label = item.subscription ? `Subscribe · ${item.stars} ⭐ / 30 days` : `Pay ${item.stars} ⭐`;
  await send(chatId,
    `<b>${escapeHtml(item.title)}</b>\n${escapeHtml(item.description)}` +
    (item.subscription ? '\nCancel any time in Telegram: Settings › My Stars › Subscriptions.' : ''),
    { reply_markup: { inline_keyboard: [[{ text: label, url: invoice.url }]] } });
}

export async function consent(chatId, user, sku) {
  await upsertAccount(user);
  await recordConsent(user.id, 'bot');
  await offer(chatId, user, sku);
}

export async function sendLegal(chatId, page) {
  if (!PAGES[page]) return;
  for (const text of legalMessages(page)) await send(chatId, text);
}

/** The confirmation on a durable medium (§ 312f Abs. 3 BGB), including the consent given */
export async function confirmPurchase(chatId, item, payment, proUntil) {
  const grants = [`❤️ ${item.revives} revival tokens`];
  if (proUntil) grants.push(`⭐ Pro until ${formatDate(proUntil)}`);
  await send(chatId,
    `<b>Kaufbestätigung / Purchase confirmation</b>\n` +
    `Artikel: ${escapeHtml(item.title)}\n` +
    `Preis: ${payment.total_amount} Telegram Stars${item.subscription ? ' alle 30 Tage' : ''}\n` +
    `Datum: ${formatDate(Math.floor(Date.now() / 1000))}\n` +
    `Zahlungs-ID: <code>${escapeHtml(payment.telegram_payment_charge_id)}</code>\n` +
    `Anbieter: ${escapeHtml(OPERATOR.name)}, ${escapeHtml(OPERATOR.email)} (/impressum)\n\n` +
    `Gutgeschrieben: ${grants.join(', ')}\n\n` +
    `Ihre Zustimmung (Version ${CONSENT_VERSION}): <i>${escapeHtml(CONSENT_TEXT)}</i>\n\n` +
    `AGB: /agb · Widerrufsbelehrung: /widerruf`,
    { reply_markup: { inline_keyboard: [playButton('🎮 Back to the game')].filter((row) => row.length) } });
}

export async function paysupport(chatId) {
  await send(chatId,
    '<b>Hilfe zu Käufen / Help with purchases</b>\n' +
    `Schreib uns an ${escapeHtml(OPERATOR.email)} mit der Zahlungs-ID aus deiner Kaufbestätigung. ` +
    'Telegram selbst kann bei Käufen in diesem Bot nicht helfen.\n\n' +
    'Gekaufte Inhalte werden nicht erstattet; deine gesetzlichen Rechte (Widerruf, Gewährleistung) ' +
    'bleiben unberührt: /agb · /widerruf');
}

export async function notifyAdmins(text) {
  for (const admin of ADMIN_IDS) {
    try {
      await send(admin, text);
    } catch (error) {
      console.warn('could not notify admin', admin, error.description ?? error.message);
    }
  }
}

const reminderLanguage = (user) => (String(user.language_code ?? '').startsWith('de') ? 'de' : 'en');

function reminderKeyboard(language, muted) {
  const t = reminderTexts(language);
  return { inline_keyboard: [[muted
    ? { text: t.unmute, callback_data: 'reminders:on' }
    : { text: t.mute, callback_data: 'reminders:off' }]] };
}

/** /reminders: whether streak reminders are on, with a button to switch */
export async function reminderSettings(chatId, user) {
  const language = reminderLanguage(user);
  const muted = await isMuted(user.id);
  const t = reminderTexts(language);
  await send(chatId, muted ? t.muted : t.unmuted, { reply_markup: reminderKeyboard(language, muted) });
}

/** The reminder's and /reminders' button; edits the message in place so the button flips */
export async function toggleReminders(chatId, user, on, message) {
  await setMuted(user.id, !on);
  const language = reminderLanguage(user);
  const t = reminderTexts(language);
  const text = on ? t.unmuted : t.muted;
  if (message) {
    try {
      return await api.editMessageText({ chat_id: chatId, message_id: message.message_id, text, reply_markup: reminderKeyboard(language, !on) });
    } catch {
      // The reminder itself may be too old to edit; answer with a new message instead
    }
  }
  await send(chatId, text, { reply_markup: reminderKeyboard(language, !on) });
}
