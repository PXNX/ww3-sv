// The ledger for Telegram Stars purchases. Balances are sums: revivals bought (on purchases) minus
// revivals spent (on spends). A purchase is keyed by Telegram's unique charge id, so a duplicate
// delivery of the same payment grants nothing. Nothing here is ever deleted. There are no foreign
// keys on this platform; the user id columns are plain links to accounts.user_id.

import { table, integer, text, boolean, index, uniqueIndex, sql } from 'sdk/db';

export const accounts = table('accounts', {
  userId: integer('user_id').primaryKey(),
  username: text('username'),
  firstName: text('first_name'),
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
