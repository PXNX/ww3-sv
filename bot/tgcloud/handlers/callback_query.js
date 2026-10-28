// handlers/callback_query.js — the shop buttons, the consent step, and the games of a chat.

import { api } from 'sdk';
import { consent, isGroup, offer, openGame, postGame, sendLegal, shop, showTop, toggleReminders } from '../lib/bot.js';
import { langOfUser, t } from '../lib/texts.js';

export default async function (query) {
  // A Play button: answered with the game's link instead of the plain acknowledgement
  if (query.game_short_name) return await openGame(query);

  const data = query.data ?? '';
  const chatId = query.message?.chat.id ?? query.from.id;
  const [action, value] = data.split(':');
  // Games and leaderboards only in groups, even for a menu that was forwarded elsewhere
  if ((action === 'game' || action === 'top') && !isGroup(query.message?.chat)) {
    return await api.answerCallbackQuery({ callback_query_id: query.id, text: t(langOfUser(query.from), 'group_only_alert'), show_alert: true });
  }
  await api.answerCallbackQuery({ callback_query_id: query.id });

  if (data === 'shop') return await shop(chatId, query.from);
  if (data === 'cancel' && query.message) {
    return await api.editMessageReplyMarkup({ chat_id: chatId, message_id: query.message.message_id });
  }
  if (action === 'buy') return await offer(chatId, query.from, value);
  if (action === 'legal') return await sendLegal(chatId, value);
  if (action === 'reminders') return await toggleReminders(chatId, query.from, value === 'on', query.message);
  if (action === 'game') return await postGame(chatId, query.from, value);
  if (action === 'top') return await showTop(chatId, query.from, value);
  if (action === 'consent') {
    if (query.message) {
      await api.editMessageReplyMarkup({ chat_id: chatId, message_id: query.message.message_id });
    }
    return await consent(chatId, query.from, value);
  }
}
