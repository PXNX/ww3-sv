// handlers/pre_checkout_query.js — Telegram cancels the order unless this answers within 10
// seconds, so it only checks our own invoice row: same user, same price, still fresh, terms agreed.

import { api } from 'sdk';
import { CURRENCY, product } from '../lib/catalogue.js';
import { findInvoice, hasConsent, nowSeconds } from '../lib/ledger.js';
import { langOfUser, t } from '../lib/texts.js';

// An unpaid invoice older than this is refused at checkout
const INVOICE_TTL = 24 * 3600;

/** The text key of the reason to refuse, or null to accept */
async function refusal(query) {
  const invoice = await findInvoice(query.invoice_payload);
  if (!invoice) return 'checkout_unknown';
  const item = product(invoice.sku);
  if (!item || invoice.userId !== query.from.id || query.currency !== CURRENCY || query.total_amount !== item.stars) {
    return 'checkout_foreign';
  }
  if (nowSeconds() - invoice.createdAt > INVOICE_TTL) return 'checkout_expired';
  if (!(await hasConsent(query.from.id))) return 'checkout_consent';
  return null;
}

export default async function (query) {
  let error;
  try {
    error = await refusal(query);
  } catch (failure) {
    console.error('pre-checkout check failed', failure);
    error = 'checkout_error';
  }
  await api.answerPreCheckoutQuery(
    error ? { pre_checkout_query_id: query.id, ok: false, error_message: t(langOfUser(query.from), error) } : { pre_checkout_query_id: query.id, ok: true },
  );
}
