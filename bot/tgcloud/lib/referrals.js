// Invite links: every player gets https://t.me/<bot>?start=r<id in base 36>. When someone who never
// used the bot starts it through that link, the inviter gets a revival token, up to a cap. The
// whole check (new player, not yourself, under the cap, invited only once) is one INSERT … SELECT,
// so it is atomic and must run before the new player's account row is written.

import { db } from 'sdk';
import { sql } from 'sdk/db';
import { nowSeconds } from './ledger.js';

export const BOT_USERNAME = 'game_ww3_bot';
export const REFERRAL_REVIVES = 1;
// Friends that earn a reward; more can still join through the link, they just pay nothing
export const REFERRAL_CAP = 10;

const PREFIX = 'r';

export const inviteCode = (userId) => `${PREFIX}${userId.toString(36)}`;
export const inviteLink = (userId) => `https://t.me/${BOT_USERNAME}?start=${inviteCode(userId)}`;

/** The inviter's user id from a /start parameter, or null when it is not an invite */
export function parseInvite(param) {
  if (typeof param !== 'string' || !/^r[0-9a-z]{1,13}$/.test(param)) return null;
  const id = parseInt(param.slice(PREFIX.length), 36);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/**
 * Credits the inviter when `invitee` is new to the bot; true when a reward was booked. Call it
 * before anything writes the invitee's account, or they no longer count as new.
 */
export async function recordReferral(referrerId, invitee) {
  if (!referrerId || invitee.is_bot || referrerId === invitee.id) return false;
  const result = await db.run(sql`
    INSERT INTO referrals (invitee_id, referrer_id, revives, created_at)
    SELECT ${invitee.id}, ${referrerId}, ${REFERRAL_REVIVES}, ${nowSeconds()}
    WHERE EXISTS (SELECT 1 FROM accounts WHERE user_id = ${referrerId})
      AND NOT EXISTS (SELECT 1 FROM accounts WHERE user_id = ${invitee.id})
      AND (SELECT COUNT(*) FROM referrals WHERE referrer_id = ${referrerId}) < ${REFERRAL_CAP}
    ON CONFLICT (invitee_id) DO NOTHING
  `);
  return result.rowsAffected > 0;
}

/** How many friends joined through the player's link and what it earned them */
export async function inviteStats(userId) {
  const row = await db.get(sql`
    SELECT COUNT(*) AS friends, COALESCE(SUM(revives), 0) AS revives FROM referrals WHERE referrer_id = ${userId}
  `);
  return {
    link: inviteLink(userId),
    friends: Number(row?.friends ?? 0),
    revives: Number(row?.revives ?? 0),
    cap: REFERRAL_CAP,
    perFriend: REFERRAL_REVIVES,
  };
}
