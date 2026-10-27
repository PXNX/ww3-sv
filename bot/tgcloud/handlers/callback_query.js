// handlers/callback_query.js — the shop buttons and the consent step.

import { api } from 'sdk';
import { consent, offer, sendLegal, shop } from '../lib/bot.js';

export default async function (query) {
  const data = query.data ?? '';
  const chatId = query.message?.chat.id ?? query.from.id;
  await api.answerCallbackQuery({ callback_query_id: query.id });

  if (data === 'shop') return await shop(chatId);
  if (data === 'cancel' && query.message) {
    return await api.editMessageReplyMarkup({ chat_id: chatId, message_id: query.message.message_id });
  }
  const [action, value] = data.split(':');
  if (action === 'buy') return await offer(chatId, query.from, value);
  if (action === 'legal') return await sendLegal(chatId, value);
  if (action === 'consent') {
    if (query.message) {
      await api.editMessageReplyMarkup({ chat_id: chatId, message_id: query.message.message_id });
    }
    return await consent(chatId, query.from, value);
  }
}
