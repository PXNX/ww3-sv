// handlers/message.js — commands, and `successful_payment`, the only place goods are granted.

import { product } from '../lib/catalogue.js';
import { ADMIN_IDS } from '../lib/generated.js';
import { bookPayment, findInvoice, stats, upsertAccount } from '../lib/ledger.js';
import { BOT_NAME, applyProfile } from '../lib/profile.js';
import { unblock } from '../lib/reminders.js';
import {
  confirmPurchase, login, notifyAdmins, offer, paysupport, reminderSettings, send, sendLegal, shop, showWallet, start,
} from '../lib/bot.js';
import { escapeHtml } from '../lib/legal.js';

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
    await send(message.chat.id,
      'Your payment arrived but could not be matched to an item. We will sort it out: /paysupport');
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
  await confirmPurchase(message.chat.id, item, payment, proUntil);
}

export default async function (message) {
  if (message.successful_payment) return await paid(message);
  if (message.chat.type !== 'private') return;
  // Writing to the bot means it may message the player again
  await unblock(message.from.id);
  if (!message.text?.startsWith('/')) return;

  const [head, ...args] = message.text.trim().split(/\s+/);
  const command = head.slice(1).split('@')[0].toLowerCase();
  const chatId = message.chat.id;

  if (LEGAL_COMMANDS[command]) return await sendLegal(chatId, LEGAL_COMMANDS[command]);
  switch (command) {
    case 'start': return await start(message, args[0]);
    case 'login': return await login(message);
    case 'shop': return await shop(chatId);
    case 'buy': return args[0] ? await offer(chatId, message.from, args[0]) : await shop(chatId);
    case 'wallet': return await showWallet(chatId, message.from);
    case 'paysupport': return await paysupport(chatId);
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
