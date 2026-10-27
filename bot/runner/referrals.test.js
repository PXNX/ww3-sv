// Invite rewards on the runner's shim: who counts as a new friend, the cap, and the wallet.
import { expect, test } from 'bun:test';

process.env.TELEGRAM ??= 'test';
process.env.DB_PATH = ':memory:';
const { sqlite } = await import('sdk');
const schema = await import('../tgcloud/schema.js');
const { ensureTables } = await import('./tables.js');
const ledger = await import('../tgcloud/lib/ledger.js');
const referrals = await import('../tgcloud/lib/referrals.js');

ensureTables(sqlite, schema);

test('invite codes round-trip and reject anything else', () => {
  expect(referrals.parseInvite(referrals.inviteCode(703453307))).toBe(703453307);
  expect(referrals.inviteLink(5)).toBe('https://t.me/game_ww3_bot?start=r5');
  for (const param of [undefined, '', 'shop', 'r', 'R5', 'r-5', 'r0', 'rzzzzzzzzzzzzzz']) {
    expect(referrals.parseInvite(param)).toBeNull();
  }
});

test('only a player new to the bot earns the inviter a token, once, up to the cap', async () => {
  const inviter = { id: 100, first_name: 'Inviter' };
  expect(await referrals.recordReferral(inviter.id, { id: 200 })).toBe(false); // inviter unknown
  await ledger.upsertAccount(inviter);

  expect(await referrals.recordReferral(100, { id: 100 })).toBe(false); // yourself
  expect(await referrals.recordReferral(100, { id: 201, is_bot: true })).toBe(false);

  await ledger.upsertAccount({ id: 202 });
  expect(await referrals.recordReferral(100, { id: 202 })).toBe(false); // already played

  expect(await referrals.recordReferral(100, { id: 203 })).toBe(true);
  expect(await referrals.recordReferral(100, { id: 203 })).toBe(false); // the same friend again
  expect(await referrals.recordReferral(101, { id: 203 })).toBe(false); // invited by someone else too

  for (let id = 300; id < 320; id++) await referrals.recordReferral(100, { id });
  const stats = await referrals.inviteStats(100);
  expect(stats.friends).toBe(referrals.REFERRAL_CAP);
  expect(stats.revives).toBe(referrals.REFERRAL_CAP * referrals.REFERRAL_REVIVES);

  const wallet = await ledger.wallet(100);
  expect(wallet.revives).toBe(referrals.REFERRAL_CAP * referrals.REFERRAL_REVIVES);
  expect(await ledger.spendRevive(100, 'test')).not.toBeNull();
  expect((await ledger.wallet(100)).revives).toBe(wallet.revives - 1);
});
