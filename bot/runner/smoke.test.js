// Runs the ledger against the runner's sdk shim on an in-memory database: tables, booking once per
// charge id, the wallet, and spending only while the balance covers it.
import { expect, test } from 'bun:test';

process.env.TELEGRAM ??= 'test';
process.env.DB_PATH = ':memory:';
const { sqlite, db } = await import('sdk');
const schema = await import('../tgcloud/schema.js');
const { ensureTables } = await import('./tables.js');
const ledger = await import('../tgcloud/lib/ledger.js');
const { product } = await import('../tgcloud/lib/catalogue.js');

ensureTables(sqlite, schema);
ensureTables(sqlite, schema); // idempotent

test('booking, wallet and spending', async () => {
  const user = { id: 42, first_name: 'Test' };
  await ledger.upsertAccount(user);
  await ledger.upsertAccount({ ...user, username: 'renamed' });
  expect(await ledger.hasConsent(42)).toBe(false);
  await ledger.recordConsent(42, 'bot');
  await ledger.recordConsent(42, 'bot');
  expect(await ledger.hasConsent(42)).toBe(true);

  await db.insert(schema.invoices).values({ id: 'inv1', userId: 42, sku: 'pro_30d', stars: 250, createdAt: ledger.nowSeconds() }).run();
  expect((await ledger.findInvoice('inv1')).userId).toBe(42);

  const payment = { telegram_payment_charge_id: 'c1', total_amount: 250, invoice_payload: 'inv1', is_recurring: true };
  const first = await ledger.bookPayment({ userId: 42, item: product('pro_30d'), payment });
  const again = await ledger.bookPayment({ userId: 42, item: product('pro_30d'), payment });
  expect(first.granted).toBe(true);
  expect(again.granted).toBe(false);

  const wallet = await ledger.wallet(42);
  expect(wallet.revives).toBe(10);
  expect(wallet.pro).toBe(true);

  for (let i = 0; i < 10; i++) expect(await ledger.spendRevive(42, 'test')).not.toBeNull();
  expect(await ledger.spendRevive(42, 'test')).toBeNull();
  expect((await ledger.stats()).purchases).toBe(1);
});

test('no invoices while the operator data is missing', async () => {
  const { SALES_OPEN } = await import('../tgcloud/lib/generated.js');
  if (SALES_OPEN) return;
  await expect(ledger.createInvoice(42, product('revive_1'))).rejects.toThrow('not open');
});
