// endpoints/spend.js — `{ mode }` → the wallet after taking one bought revival token. The Mini App
// calls this before a game revives, so one purchase cannot be used twice by resetting local storage.

import { EndpointError } from 'sdk';
import { spendRevive, upsertAccount } from '../lib/ledger.js';

export default async function (input, ctx) {
  const user = ctx.initData.user;
  const mode = String(input.mode ?? 'unknown').replace(/[^a-z0-9_-]/gi, '').slice(0, 32) || 'unknown';
  await upsertAccount(user);
  const after = await spendRevive(user.id, `revive:${mode}`);
  if (!after) throw new EndpointError('No revival tokens left', { code: 'NO_REVIVES' });
  return { wallet: { revives: after.revives }, pro: after.pro };
}
