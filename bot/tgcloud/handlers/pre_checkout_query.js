// handlers/pre_checkout_query.js — Telegram cancels the order unless this answers within 10
// seconds, so it only checks our own invoice row: same user, same price, still fresh, terms agreed.

import { api } from 'sdk';
import { CURRENCY, product } from '../lib/catalogue.js';
import { findInvoice, hasConsent, nowSeconds } from '../lib/ledger.js';

// An unpaid invoice older than this is refused at checkout
const INVOICE_TTL = 24 * 3600;

async function refusal(query) {
  const invoice = await findInvoice(query.invoice_payload);
  if (!invoice) return 'This invoice is unknown. Please start the purchase again.';
  const item = product(invoice.sku);
  if (!item || invoice.userId !== query.from.id || query.currency !== CURRENCY || query.total_amount !== item.stars) {
    return 'This invoice does not belong to your account.';
  }
  if (nowSeconds() - invoice.createdAt > INVOICE_TTL) return 'This invoice has expired. Please start the purchase again.';
  if (!(await hasConsent(query.from.id))) return 'Please agree to the terms first: /shop';
  return null;
}

export default async function (query) {
  let error;
  try {
    error = await refusal(query);
  } catch (failure) {
    console.error('pre-checkout check failed', failure);
    error = 'Something went wrong. Please try again in a moment.';
  }
  await api.answerPreCheckoutQuery(
    error ? { pre_checkout_query_id: query.id, ok: false, error_message: error } : { pre_checkout_query_id: query.id, ok: true },
  );
}
