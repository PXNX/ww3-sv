// endpoints/invoice.js — `{ sku, consent }` → `{ url }` for `Telegram.WebApp.openInvoice(url)`.
// The price comes from the catalogue, never from the request. The first purchase of a terms
// version needs `consent: true` (the Mini App shows the consent text and a checkbox); the goods are
// granted later, only on `successful_payment`.

import { EndpointError } from 'sdk';
import { product } from '../lib/catalogue.js';
import { LedgerError, createInvoice, hasConsent, recordConsent, upsertAccount } from '../lib/ledger.js';

export default async function (input, ctx) {
  const user = ctx.initData.user;
  const item = product(String(input.sku ?? ''));
  if (!item) throw new EndpointError('Unknown item', { code: 'UNKNOWN_SKU' });

  await upsertAccount(user);
  if (!(await hasConsent(user.id))) {
    if (input.consent !== true) {
      throw new EndpointError('Consent to immediate delivery is required', { code: 'CONSENT_REQUIRED' });
    }
    await recordConsent(user.id, 'mini_app');
  }

  try {
    const invoice = await createInvoice(user.id, item);
    return { url: invoice.url };
  } catch (error) {
    if (error instanceof LedgerError) throw new EndpointError(error.message, { code: error.code });
    throw error;
  }
}
