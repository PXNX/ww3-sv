// The chat side of the bot: opening the game (which is the login: a Mini App session carries the
// player's verified Telegram identity), the shop, the wallet, invites, streak reminders, the legal
// pages and the purchase confirmation. Shared by handlers/message and handlers/callback_query.
// Every text comes from texts.js, in German or English after the player's Telegram language.

import { api } from 'sdk';
import { PRODUCTS, localized, product } from './catalogue.js';
import { ADMIN_IDS, APP_URL, OPERATOR, SALES_OPEN } from './generated.js';
import { accountLanguage, createInvoice, hasConsent, recordConsent, upsertAccount, wallet } from './ledger.js';
import { CONSENT_TEXT, CONSENT_VERSION, PAGES, escapeHtml, legalMessages, pageUrl } from './legal.js';
import { inviteLink, inviteStats, parseInvite, recordReferral } from './referrals.js';
import { isMuted, setMuted } from './reminders.js';
import { langOfUser, t } from './texts.js';

export async function send(chatId, text, extra = {}) {
  return await api.sendMessage({
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
    ...extra,
  });
}

function playButton(label, path = '') {
  return APP_URL ? [{ text: label, web_app: { url: `${APP_URL}/${path}` } }] : [];
}

const formatDate = (seconds) => new Date(seconds * 1000).toISOString().slice(0, 16).replace('T', ' ') + ' UTC';

export async function start(message, param) {
  const lang = langOfUser(message.from);
  // Before the account is written: only a player new to the bot earns the inviter a reward
  const referrer = parseInvite(param);
  const invited = referrer ? await recordReferral(referrer, message.from) : false;
  if (invited) await thankReferrer(referrer);
  await upsertAccount(message.from);
  if (invited) await send(message.chat.id, t(lang, 'invited'));
  if (param === 'shop') return await shop(message.chat.id, message.from);
  const keyboard = [playButton(t(lang, 'open_app')), [{ text: t(lang, 'shop_button'), callback_data: 'shop' }]]
    .filter((row) => row.length);
  await send(message.chat.id, t(lang, 'start', { name: escapeHtml(message.from.first_name) }),
    { reply_markup: { inline_keyboard: keyboard } });
}

export async function login(message) {
  const lang = langOfUser(message.from);
  await upsertAccount(message.from);
  if (!APP_URL) return await send(message.chat.id, t(lang, 'not_deployed'));
  await send(message.chat.id, t(lang, 'login'),
    { reply_markup: { inline_keyboard: [playButton(t(lang, 'open_profile'), 'profile')] } });
}

export async function shop(chatId, user) {
  const lang = langOfUser(user);
  await send(chatId, t(lang, 'shop'), {
    reply_markup: {
      inline_keyboard: PRODUCTS.map((entry) => {
        const item = localized(entry, lang);
        return [{ text: `${item.title} · ${item.stars} ⭐`, callback_data: `buy:${item.sku}` }];
      }),
    },
  });
}

export async function showWallet(chatId, user) {
  const lang = langOfUser(user);
  await upsertAccount(user);
  const current = await wallet(user.id);
  const pro = current.pro ? t(lang, 'pro_active', { date: formatDate(current.proUntil) }) : t(lang, 'pro_none');
  await send(chatId, t(lang, 'wallet', { revives: current.revives, pro }));
}

function legalButtons() {
  return ['agb', 'widerruf'].map((page) =>
    pageUrl(page) ? { text: PAGES[page], url: pageUrl(page) } : { text: PAGES[page], callback_data: `legal:${page}` });
}

/** Sends the invoice, after asking for consent if the current terms were not agreed to yet */
export async function offer(chatId, user, sku) {
  const lang = langOfUser(user);
  const entry = product(sku);
  if (!entry) return await shop(chatId, user);
  const item = localized(entry, lang);
  await upsertAccount(user);
  if (!SALES_OPEN) return await send(chatId, t(lang, 'sales_closed'));

  if (!(await hasConsent(user.id))) {
    return await send(chatId,
      `<b>${escapeHtml(item.title)} · ${item.stars} ⭐</b>\n${escapeHtml(item.description)}\n\n<i>${escapeHtml(CONSENT_TEXT)}</i>`,
      { reply_markup: { inline_keyboard: [
        [{ text: t(lang, 'agree'), callback_data: `consent:${item.sku}` }],
        legalButtons(),
        [{ text: t(lang, 'cancel'), callback_data: 'cancel' }],
      ] } });
  }

  const invoice = await createInvoice(user.id, item);
  const label = t(lang, item.subscription ? 'subscribe' : 'pay', { stars: item.stars });
  await send(chatId,
    `<b>${escapeHtml(item.title)}</b>\n${escapeHtml(item.description)}` +
    (item.subscription ? `\n${t(lang, 'cancel_hint')}` : ''),
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
export async function confirmPurchase(chatId, user, entry, payment, proUntil) {
  const lang = langOfUser(user);
  const item = localized(entry, lang);
  const grants = [t(lang, 'grant_revives', { count: item.revives })];
  if (proUntil) grants.push(t(lang, 'grant_pro', { date: formatDate(proUntil) }));
  await send(chatId, t(lang, 'confirmation', {
    title: escapeHtml(item.title),
    stars: payment.total_amount,
    period: item.subscription ? t(lang, 'every_30_days') : '',
    date: formatDate(Math.floor(Date.now() / 1000)),
    charge: escapeHtml(payment.telegram_payment_charge_id),
    operator: `${escapeHtml(OPERATOR.name)}, ${escapeHtml(OPERATOR.email)}`,
    grants: grants.join(', '),
    version: CONSENT_VERSION,
    consent: escapeHtml(CONSENT_TEXT),
  }), { reply_markup: { inline_keyboard: [playButton(t(lang, 'back_to_game'))].filter((row) => row.length) } });
}

export async function paysupport(chatId, user) {
  await send(chatId, t(langOfUser(user), 'paysupport', { email: escapeHtml(OPERATOR.email) }));
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

function reminderKeyboard(lang, muted) {
  return { inline_keyboard: [[muted
    ? { text: t(lang, 'reminder_unmute'), callback_data: 'reminders:on' }
    : { text: t(lang, 'reminder_mute'), callback_data: 'reminders:off' }]] };
}

/** /reminders: whether streak reminders are on, with a button to switch */
export async function reminderSettings(chatId, user) {
  const lang = langOfUser(user);
  const muted = await isMuted(user.id);
  await send(chatId, t(lang, muted ? 'reminders_off' : 'reminders_on'), { reply_markup: reminderKeyboard(lang, muted) });
}

/** The reminder's and /reminders' button; edits the message in place so the button flips */
export async function toggleReminders(chatId, user, on, message) {
  await setMuted(user.id, !on);
  const lang = langOfUser(user);
  const text = t(lang, on ? 'reminders_on' : 'reminders_off');
  if (message) {
    try {
      return await api.editMessageText({ chat_id: chatId, message_id: message.message_id, text, reply_markup: reminderKeyboard(lang, !on) });
    } catch {
      // The reminder itself may be too old to edit; answer with a new message instead
    }
  }
  await send(chatId, text, { reply_markup: reminderKeyboard(lang, !on) });
}

function shareUrl(userId, lang) {
  const text = t(lang, 'invite_share_text');
  return `https://t.me/share/url?url=${encodeURIComponent(inviteLink(userId))}&text=${encodeURIComponent(text)}`;
}

/** /invite: the player's link, what it earned so far, and a button to share it */
export async function invite(chatId, user) {
  const lang = langOfUser(user);
  await upsertAccount(user);
  const stats = await inviteStats(user.id);
  const left = Math.max(0, stats.cap - stats.friends);
  await send(chatId, t(lang, 'invite', {
    perFriend: stats.perFriend,
    cap: stats.cap,
    link: escapeHtml(stats.link),
    friends: stats.friends,
    left: left === 0 ? t(lang, 'invite_all') : t(lang, 'invite_left', { left }),
  }), { reply_markup: { inline_keyboard: [[{ text: t(lang, 'invite_share'), url: shareUrl(user.id, lang) }]] } });
}

async function thankReferrer(referrerId) {
  const stats = await inviteStats(referrerId);
  const lang = await accountLanguage(referrerId);
  try {
    await send(referrerId, t(lang, 'referral_thanks', { perFriend: stats.perFriend, friends: stats.friends, cap: stats.cap }));
  } catch (error) {
    // The inviter may have blocked the bot; the token is booked either way
    console.warn('could not thank referrer', referrerId, error.description ?? error.message);
  }
}
