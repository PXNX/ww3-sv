// The ledger for Telegram Stars purchases. Balances are sums: revivals bought (on purchases) minus
// revivals spent (on spends). A purchase is keyed by Telegram's unique charge id, so a duplicate
// delivery of the same payment grants nothing. Nothing here is ever deleted. There are no foreign
// keys on this platform; the user id columns are plain links to accounts.user_id.

import { table, integer, text, boolean, index, uniqueIndex, sql } from 'sdk/db';

export const accounts = table('accounts', {
  userId: integer('user_id').primaryKey(),
  username: text('username'),
  firstName: text('first_name'),
  // 'de' or 'en' after the Telegram language, for messages the player did not ask for
  language: text('language'),
  firstSeen: integer('first_seen', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  // Unix seconds until which Pro is active, or null
  proUntil: integer('pro_until'),
});

// The express consent to immediate delivery and the acknowledged loss of the right of withdrawal
// (§ 356 Abs. 4 and 5 BGB), one row per user and version of the legal texts
export const consents = table('consents', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull(),
  version: text('version').notNull(),
  source: text('source').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
}, (t) => ({
  userVersion: uniqueIndex('uidx_consents_user_version').on(t.userId, t.version),
}));

// An invoice we issued; its id is the invoice payload, so a payment can be matched to one user
// and one sku without trusting anything the client sends
export const invoices = table('invoices', {
  id: text('id').primaryKey(),
  userId: integer('user_id').notNull(),
  sku: text('sku').notNull(),
  stars: integer('stars').notNull(),
  createdAt: integer('created_at').notNull(),
}, (t) => ({
  userCreated: index('idx_invoices_user_created').on(t.userId, t.createdAt),
}));

export const purchases = table('purchases', {
  chargeId: text('charge_id').primaryKey(),
  providerChargeId: text('provider_charge_id'),
  userId: integer('user_id').notNull(),
  sku: text('sku').notNull(),
  stars: integer('stars').notNull(),
  invoiceId: text('invoice_id').notNull(),
  // What this payment granted, so the grant and the booking are one insert
  revives: integer('revives').notNull().default(0),
  recurring: boolean('recurring').notNull().default(false),
  createdAt: integer('created_at').notNull(),
}, (t) => ({
  user: index('idx_purchases_user').on(t.userId),
}));

export const spends = table('spends', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull(),
  revives: integer('revives').notNull(),
  reason: text('reason').notNull(),
  createdAt: integer('created_at').notNull(),
}, (t) => ({
  user: index('idx_spends_user').on(t.userId),
}));

// The daily-reward streak as the game last reported it, for the reminder two hours before it ends.
// The streak itself lives in the game; this is only its deadline, so the bot can warn in time.
export const streaks = table('streaks', {
  userId: integer('user_id').primaryKey(),
  streak: integer('streak').notNull(),
  // Unix seconds when the streak breaks (the player's local midnight), or null without a streak
  expiresAt: integer('expires_at'),
  // The deadline a reminder was already sent for, so each deadline gets at most one
  remindedFor: integer('reminded_for').notNull().default(0),
  // German or English reminders, from the Mini App's language
  language: text('language').notNull().default('en'),
  // Muted by the player (button or /reminders)
  muted: boolean('muted').notNull().default(false),
  // Telegram refused the message (bot never started or blocked); cleared when the player writes to
  // the bot or allows messages in the Mini App
  blocked: boolean('blocked').notNull().default(false),
  updatedAt: integer('updated_at').notNull(),
}, (t) => ({
  due: index('idx_streaks_expires').on(t.expiresAt),
}));

// Who invited whom with their invite link. One row per invited player (they can only be invited
// once), written when a new player starts the bot through the link; the revivals it granted the
// inviter count towards their wallet like bought ones.
export const referrals = table('referrals', {
  inviteeId: integer('invitee_id').primaryKey(),
  referrerId: integer('referrer_id').notNull(),
  revives: integer('revives').notNull(),
  createdAt: integer('created_at').notNull(),
}, (t) => ({
  referrer: index('idx_referrals_referrer').on(t.referrerId),
}));

// A press on a game message's Play button: who opened which game from which chat message. The id is
// in the game page's URL and comes back with every score; it is the only proof of who plays (a game
// page has no Mini App initData), so it is long and random. Sessions older than a day are deleted
// when the next one is opened.
export const gameSessions = table('game_sessions', {
  id: text('id').primaryKey(),
  userId: integer('user_id').notNull(),
  // The player's name and Telegram language at the Play press, for the leaderboard and the record message
  firstName: text('first_name'),
  language: text('language'),
  // The game's short name at @BotFather, which is the mode id in the game
  game: text('game').notNull(),
  chatId: integer('chat_id').notNull(),
  messageId: integer('message_id').notNull(),
  createdAt: integer('created_at').notNull(),
}, (t) => ({
  created: index('idx_game_sessions_created').on(t.createdAt),
}));

// Each player's best per game and chat, as it was set on Telegram's scoreboard; a copy, so /top can
// list a chat's leaderboard and the bot can tell when someone takes the chat's record
export const groupScores = table('group_scores', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  chatId: integer('chat_id').notNull(),
  game: text('game').notNull(),
  userId: integer('user_id').notNull(),
  // As the player was called when they set the score, for the leaderboard
  firstName: text('first_name').notNull(),
  score: integer('score').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (t) => ({
  player: uniqueIndex('uidx_group_scores_chat_game_user').on(t.chatId, t.game, t.userId),
  board: index('idx_group_scores_chat_game_score').on(t.chatId, t.game, t.score),
}));
