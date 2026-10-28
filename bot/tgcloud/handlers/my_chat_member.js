// handlers/my_chat_member.js — the bot's own membership changed; when it joins a group it explains
// /games and /top there.

import { welcomeGroup } from '../lib/bot.js';

const PRESENT = ['member', 'administrator'];

export default async function (update) {
  if (update.chat.type !== 'group' && update.chat.type !== 'supergroup') return;
  const joined = PRESENT.includes(update.new_chat_member.status) && !PRESENT.includes(update.old_chat_member.status);
  if (!joined) return;
  try {
    await welcomeGroup(update.chat, update.from);
  } catch (error) {
    // A group where only admins may post; /games still works for them
    console.warn('could not greet group', update.chat.id, error.description ?? error.message);
  }
}
