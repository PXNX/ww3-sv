// Accounts, consent, invoices, purchases and the revival wallet (bought revivals, plus those earned
// by inviting friends, minus those spent). Every write that moves value is a single SQL statement,
// so it is atomic without a transaction: a purchase books its grant in the same insert (keyed by
// the unique charge id), and a spend only inserts while the balance covers it.

import { db, api } from 'sdk';
import { and, eq, gt, sql } from 'sdk/db';
import { accounts, consents, invoices, purchases, spends } from '../schema.js';
import { CURRENCY, SUBSCRIPTION_PERIOD } from './catalogue.js';
import { SALES_OPEN } from './generated.js';
import { CONSENT_VERSION } from './legal.js';

// Invoice creations a user may make per minute
const INVOICES_PER_MINUTE = 5;

export const nowSeconds = () => Math.floor(Date.now() / 1000);

export class LedgerError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

export async function upsertAccount(user) {
  await db.insert(accounts)
    .values({ userId: user.id, username: user.username ?? null, firstName: user.first_name ?? null })
    .onConflictDoUpdate({
      target: accounts.userId,
      set: { username: user.username ?? null, firstName: user.first_name ?? null },
    })
    .run();
}

export async function hasConsent(userId) {
  const count = await db.$count(consents, and(eq(consents.userId, userId), eq(consents.version, CONSENT_VERSION)));
  return count > 0;
}

export async function recordConsent(userId, source) {
  await db.run(sql`
    INSERT OR IGNORE INTO consents (user_id, version, source, created_at)
    VALUES (${userId}, ${CONSENT_VERSION}, ${source}, ${nowSeconds()})
  `);
  console.info('consent', { userId, version: CONSENT_VERSION, source });
}

export async function wallet(userId) {
  const row = await db.get(sql`
    SELECT
      COALESCE((SELECT SUM(revives) FROM purchases WHERE user_id = ${userId}), 0)
        + COALESCE((SELECT SUM(revives) FROM referrals WHERE referrer_id = ${userId}), 0)
        - COALESCE((SELECT SUM(revives) FROM spends WHERE user_id = ${userId}), 0) AS revives,
      (SELECT pro_until FROM accounts WHERE user_id = ${userId}) AS pro_until
  `);
  const proUntil = row?.pro_until ?? null;
  return {
    revives: Number(row?.revives ?? 0),
    proUntil,
    pro: proUntil !== null && proUntil > nowSeconds(),
  };
}

function invoiceId() {
  // Unique enough with the timestamp; the id is a lookup key, never a secret on its own
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

/** An invoice link bound to this user and sku; refuses when the user asks for too many */
export async function createInvoice(userId, item) {
  if (!SALES_OPEN) throw new LedgerError('SALES_CLOSED', 'Purchases are not open yet.');
  const recent = await db.$count(invoices, and(eq(invoices.userId, userId), gt(invoices.createdAt, nowSeconds() - 60)));
  if (recent >= INVOICES_PER_MINUTE) {
    throw new LedgerError('RATE_LIMITED', 'Too many invoices, please wait a minute.');
  }
  const id = invoiceId();
  await db.insert(invoices).values({ id, userId, sku: item.sku, stars: item.stars, createdAt: nowSeconds() }).run();
  const url = await api.createInvoiceLink({
    title: item.title,
    description: item.description,
    payload: id,
    currency: CURRENCY,
    prices: [{ label: item.title, amount: item.stars }],
    ...(item.subscription ? { subscription_period: SUBSCRIPTION_PERIOD } : {}),
  });
  return { id, url };
}

export async function findInvoice(id) {
  return await db.select().from(invoices).where(eq(invoices.id, id)).get();
}

/**
 * Books a successful payment and its revivals in one insert; false when this charge was already
 * booked (Telegram can deliver an update twice). A Pro payment also moves `pro_until` forward.
 */
export async function bookPayment({ userId, item, payment }) {
  const rows = await db.insert(purchases)
    .values({
      chargeId: payment.telegram_payment_charge_id,
      providerChargeId: payment.provider_payment_charge_id ?? null,
      userId,
      sku: item.sku,
      stars: payment.total_amount,
      invoiceId: payment.invoice_payload,
      revives: item.revives,
      recurring: Boolean(payment.is_recurring),
      createdAt: nowSeconds(),
    })
    .onConflictDoNothing({ target: purchases.chargeId })
    .returning({ chargeId: purchases.chargeId });
  if (rows.length === 0) return { granted: false, proUntil: null };

  let proUntil = null;
  if (item.subscription) {
    proUntil = payment.subscription_expiration_date ?? nowSeconds() + SUBSCRIPTION_PERIOD;
    await db.run(sql`
      UPDATE accounts SET pro_until = MAX(COALESCE(pro_until, 0), ${proUntil}) WHERE user_id = ${userId}
    `);
  }
  return { granted: true, proUntil };
}

/** Takes one revival token; null when the wallet is empty */
export async function spendRevive(userId, reason) {
  const result = await db.run(sql`
    INSERT INTO spends (user_id, revives, reason, created_at)
    SELECT ${userId}, 1, ${reason}, ${nowSeconds()}
    WHERE COALESCE((SELECT SUM(revives) FROM purchases WHERE user_id = ${userId}), 0)
        + COALESCE((SELECT SUM(revives) FROM referrals WHERE referrer_id = ${userId}), 0)
        - COALESCE((SELECT SUM(revives) FROM spends WHERE user_id = ${userId}), 0) >= 1
  `);
  if (result.rowsAffected === 0) return null;
  return await wallet(userId);
}

export async function stats() {
  return await db.get(sql`
    SELECT
      (SELECT COUNT(*) FROM accounts) AS accounts,
      (SELECT COUNT(*) FROM purchases) AS purchases,
      (SELECT COALESCE(SUM(stars), 0) FROM purchases) AS stars,
      (SELECT COUNT(*) FROM accounts WHERE pro_until > ${nowSeconds()}) AS pro
  `);
}
