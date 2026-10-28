// handlers/message.js — commands (in groups only the game commands), and `successful_payment`, the
// only place goods are granted.

import { product } from '../lib/catalogue.js';
import { ADMIN_IDS } from '../lib/generated.js';
import { bookPayment, findInvoice, stats, upsertAccount } from '../lib/ledger.js';
import { BOT_NAME, applyProfile } from '../lib/profile.js';
import { BOT_USERNAME } from '../lib/referrals.js';
import { unblock } from '../lib/reminders.js';
import {
  confirmPurchase, gamesMenu, invite, login, notifyAdmins, offer, paysupport, postGame, reminderSettings, send, sendLegal, shop,
  showTop, showWallet, start,
} from '../lib/bot.js';
import { escapeHtml } from '../lib/legal.js';
import { langOfUser, t } from '../lib/texts.js';

const LEGAL_COMMANDS = {
  impressum: 'impressum', imprint: 'impressum',
  datenschutz: 'datenschutz', privacy: 'datenschutz',
  agb: 'agb', terms: 'agb',
  widerruf: 'widerruf', withdrawal: 'widerruf',
};

async function paid(message) {
  const payment = message.successful_payment;
  const user = message.from;
  // Renewals of a subscription carry the first invoice's payload, so the invoice row still matches
  const invoice = await findInvoice(payment.invoice_payload);
  const item = invoice ? product(invoice.sku) : null;
  if (!invoice || !item || invoice.userId !== user.id || payment.currency !== 'XTR' || payment.total_amount !== item.stars) {
    console.error('unmatched payment', payment.telegram_payment_charge_id, user.id, payment.invoice_payload);
    await send(message.chat.id, t(langOfUser(user), 'unmatched_payment'));
    await notifyAdmins(`⚠️ Unmatched payment ${payment.telegram_payment_charge_id} from ${user.id}`);
    return;
  }

  await upsertAccount(user);
  const { granted, proUntil } = await bookPayment({ userId: user.id, item, payment });
  if (!granted) {
    console.info('duplicate payment ignored', payment.telegram_payment_charge_id);
    return;
  }
  console.info('granted', item.sku, 'to', user.id, payment.telegram_payment_charge_id);
  await confirmPurchase(message.chat.id, user, item, payment, proUntil);
  // Like ptb-words: every payment shows up in the admins' chat
  await notifyAdmins(
    `⭐ ${payment.total_amount} Stars: ${escapeHtml(item.title)} from ${escapeHtml(user.first_name ?? '')} (${user.username ? `@${escapeHtml(user.username)}, ` : ''}ID ${user.id})` +
    (payment.is_recurring && !payment.is_first_recurring ? ' – renewal' : ''),
  );
}

/** `/top@game_ww3_bot minefield` → `{ command: 'top', args: ['minefield'] }`; null for plain text or another bot's command */
export function parseCommand(text) {
  if (!text?.startsWith('/')) return null;
  const [head, ...args] = text.trim().split(/\s+/);
  const [command, target] = head.slice(1).split('@');
  if (target && target.toLowerCase() !== BOT_USERNAME.toLowerCase()) return null;
  return { command: command.toLowerCase(), args };
}

/** The game commands, the same in a group and in the private chat */
async function gameCommand(message, command, args) {
  const chatId = message.chat.id;
  const id = args[0]?.toLowerCase();
  switch (command) {
    case 'games': return await gamesMenu(chatId, message.from);
    case 'game': return id ? await postGame(chatId, message.from, id) : await gamesMenu(chatId, message.from);
    case 'top':
    case 'leaderboard': return await showTop(chatId, message.from, id);
  }
}

/** In a group the bot only plays: /games, /game <id> and /top; /start there opens the games menu */
async function groupMessage(message) {
  if (message.chat.type !== 'group' && message.chat.type !== 'supergroup') return;
  const parsed = parseCommand(message.text);
  if (!parsed) return;
  if (parsed.command === 'start') return await gamesMenu(message.chat.id, message.from);
  await gameCommand(message, parsed.command, parsed.args);
}

export default async function (message) {
  if (message.successful_payment) return await paid(message);
  if (message.chat.type !== 'private') return await groupMessage(message);
  // Writing to the bot means it may message the player again
  await unblock(message.from.id);
  const parsed = parseCommand(message.text);
  if (!parsed) return;

  const { command, args } = parsed;
  const chatId = message.chat.id;

  if (LEGAL_COMMANDS[command]) return await sendLegal(chatId, LEGAL_COMMANDS[command]);
  switch (command) {
    case 'games':
    case 'game':
    case 'top':
    case 'leaderboard': return await gameCommand(message, command, args);
    case 'start': return await start(message, args[0]);
    case 'login': return await login(message);
    case 'shop': return await shop(chatId, message.from);
    case 'buy': return args[0] ? await offer(chatId, message.from, args[0]) : await shop(chatId, message.from);
    case 'wallet': return await showWallet(chatId, message.from);
    case 'invite': return await invite(chatId, message.from);
    case 'paysupport': return await paysupport(chatId, message.from);
    case 'reminders': return await reminderSettings(chatId, message.from);
    case 'set_cmd': {
      // Admins only: it changes the bot's public profile
      if (!ADMIN_IDS.includes(message.from.id)) return;
      const errors = await applyProfile();
      return await send(chatId, errors.length
        ? `⚠️ Not everything could be set:\n${errors.map(escapeHtml).join('\n')}`
        : `✅ Profile photo, name (“${BOT_NAME}”), description, info, commands and menu button updated.`);
    }
    case 'stats': {
      if (!ADMIN_IDS.includes(message.from.id)) return;
      const numbers = await stats();
      return await send(chatId,
        `Accounts: ${numbers.accounts}\nPurchases: ${numbers.purchases}\nStars: ${numbers.stars}\nPro active: ${numbers.pro}`);
    }
  }
}
