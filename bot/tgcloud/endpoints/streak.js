// endpoints/streak.js — `{ streak, expires_at }` → `{ reminder }`. The game reports its daily-reward
// streak and the unix second it breaks (local midnight); the bot reminds two hours before.

import { EndpointError } from 'sdk';
import { upsertAccount } from '../lib/ledger.js';
import { StreakInputError, reportStreak } from '../lib/reminders.js';

export default async function (input, ctx) {
  const user = ctx.initData.user;
  await upsertAccount(user);
  try {
    return await reportStreak(user, input);
  } catch (error) {
    if (error instanceof StreakInputError) throw new EndpointError(error.message, { code: 'INVALID_INPUT' });
    throw error;
  }
}
