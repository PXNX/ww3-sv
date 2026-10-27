// Streak reminders: the game reports when the player's daily-reward streak breaks, and two hours
// before that the bot sends one message, unless the player muted reminders. Claiming a deadline and
// sending for it are separate steps, but the claim is a single conditional UPDATE, so two runs of
// the job never send the same reminder twice.

import { api, db } from 'sdk';
import { sql } from 'sdk/db';
import { APP_URL } from './generated.js';
import { nowSeconds } from './ledger.js';
import { langOf, t } from './texts.js';

// `write_access: true` in a report means the Mini App just got the player's permission to message them
export const REMIND_BEFORE = 2 * 3600;
// A reminder this close to the deadline is skipped (the job was down); it would only annoy
const TOO_LATE = 10 * 60;
// The game reports deadlines at most this far ahead (tomorrow's midnight plus time zones)
const MAX_AHEAD = 3 * 24 * 3600;

export class StreakInputError extends Error {}

/** Stores what the game reported; a streak of 0 or no deadline clears the reminder */
export async function reportStreak(user, input) {
  const streak = Number(input?.streak);
  const expiresAt = input?.expires_at === null ? null : Number(input?.expires_at);
  if (!Number.isInteger(streak) || streak < 0 || streak > 100000) throw new StreakInputError('Invalid streak');
  if (expiresAt !== null && (!Number.isInteger(expiresAt) || expiresAt > nowSeconds() + MAX_AHEAD)) {
    throw new StreakInputError('Invalid deadline');
  }
  const deadline = streak > 0 ? expiresAt : null;
  const reachable = input?.write_access === true;
  const language = langOf(user.language_code);
  await db.run(sql`
    INSERT INTO streaks (user_id, streak, expires_at, language, updated_at)
    VALUES (${user.id}, ${streak}, ${deadline}, ${language}, ${nowSeconds()})
    ON CONFLICT (user_id) DO UPDATE SET
      streak = excluded.streak, expires_at = excluded.expires_at,
      language = excluded.language, updated_at = excluded.updated_at
  `);
  if (reachable) await unblock(user.id);
  return { reminder: deadline !== null && deadline - REMIND_BEFORE > nowSeconds() ? deadline - REMIND_BEFORE : null };
}

export async function setMuted(userId, muted) {
  await db.run(sql`
    INSERT INTO streaks (user_id, streak, expires_at, muted, updated_at)
    VALUES (${userId}, 0, NULL, ${muted ? 1 : 0}, ${nowSeconds()})
    ON CONFLICT (user_id) DO UPDATE SET muted = excluded.muted
  `);
}

/** The player can be messaged again: they wrote to the bot or allowed messages in the Mini App */
export async function unblock(userId) {
  await db.run(sql`UPDATE streaks SET blocked = 0 WHERE user_id = ${userId} AND blocked = 1`);
}

export async function isMuted(userId) {
  const row = await db.get(sql`SELECT muted FROM streaks WHERE user_id = ${userId}`);
  return Boolean(row?.muted);
}

/** Sends every reminder that is due now; returns how many went out */
export async function sendDueReminders() {
  const now = nowSeconds();
  const due = await db.all(sql`
    SELECT user_id, streak, expires_at, language FROM streaks
    WHERE muted = 0 AND blocked = 0 AND expires_at IS NOT NULL
      AND expires_at - ${REMIND_BEFORE} <= ${now} AND expires_at - ${TOO_LATE} > ${now}
      AND reminded_for <> expires_at
  `);
  let sent = 0;
  for (const row of due) {
    const claimed = await db.run(sql`
      UPDATE streaks SET reminded_for = expires_at
      WHERE user_id = ${row.user_id} AND expires_at = ${row.expires_at} AND reminded_for <> expires_at
    `);
    if (claimed.rowsAffected === 0) continue;
    const keyboard = [[{ text: t(row.language, 'reminder_mute'), callback_data: 'reminders:off' }]];
    if (APP_URL) keyboard.unshift([{ text: t(row.language, 'reminder_play'), web_app: { url: APP_URL } }]);
    try {
      await api.sendMessage({ chat_id: row.user_id, text: t(row.language, 'reminder', { streak: row.streak }), reply_markup: { inline_keyboard: keyboard } });
      sent += 1;
    } catch (error) {
      // 403: the player never started the bot or blocked it; stop trying until they write to the bot or allow messages
      console.warn('streak reminder failed', row.user_id, error.description ?? error.message);
      if (error.code === 403) await db.run(sql`UPDATE streaks SET blocked = 1 WHERE user_id = ${row.user_id}`);
    }
  }
  return sent;
}
