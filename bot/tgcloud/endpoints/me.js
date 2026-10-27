// endpoints/me.js — the signed-in player: Telegram identity (verified by the platform), the bought
// revival tokens, Pro, whether the current terms were agreed to, and the catalogue to show.
// This is also "restore purchase": there is no client receipt to trust, only this answer.

import { PRODUCTS } from '../lib/catalogue.js';
import { hasConsent, upsertAccount, wallet } from '../lib/ledger.js';
import { CONSENT_TEXT, CONSENT_VERSION, pageUrl } from '../lib/legal.js';

export default async function (input, ctx) {
  const user = ctx.initData.user;
  await upsertAccount(user);
  const current = await wallet(user.id);
  return {
    user: { id: user.id, username: user.username ?? null, first_name: user.first_name ?? '' },
    wallet: { revives: current.revives },
    pro: current.pro,
    pro_until: current.proUntil ? new Date(current.proUntil * 1000).toISOString() : null,
    consented: await hasConsent(user.id),
    consent: { version: CONSENT_VERSION, text: CONSENT_TEXT, terms: pageUrl('agb'), withdrawal: pageUrl('widerruf') },
    catalogue: PRODUCTS.map(({ sku, title, description, stars, revives, subscription }) =>
      ({ sku, title, description, stars, revives, subscription })),
  };
}
