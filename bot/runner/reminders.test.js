// The streak endpoint, the reminder job and the nyx API layer, on an in-memory database with the
// Bot API replaced by a recorder.
import { beforeEach, expect, test } from 'bun:test';
import { createHmac } from 'node:crypto';

process.env.TELEGRAM ??= 'test';
process.env.DB_PATH = ':memory:';
const { sqlite, EndpointError } = await import('sdk');
const schema = await import('../tgcloud/schema.js');
const { ensureTables } = await import('./tables.js');
const { reportStreak, sendDueReminders, setMuted, unblock, REMIND_BEFORE } = await import('../tgcloud/lib/reminders.js');
const { createApi, verifyInitData } = await import('./api.js');

ensureTables(sqlite, schema);

let sent = [];
let reply = () => ({ ok: true, result: {} });
globalThis.fetch = async (url, init) => {
  const method = String(url).split('/').pop();
  const body = JSON.parse(init.body);
  sent.push({ method, body });
  return new Response(JSON.stringify(reply(method, body)));
};

const now = () => Math.floor(Date.now() / 1000);
beforeEach(() => {
  sent = [];
  reply = () => ({ ok: true, result: {} });
  sqlite.exec('DELETE FROM streaks');
});

test('one reminder per deadline, inside the two-hour window', async () => {
  const user = { id: 7, language_code: 'de' };
  await reportStreak(user, { streak: 4, expires_at: now() + REMIND_BEFORE + 600 });
  expect(await sendDueReminders()).toBe(0);

  await reportStreak(user, { streak: 4, expires_at: now() + REMIND_BEFORE - 60 });
  expect(await sendDueReminders()).toBe(1);
  expect(await sendDueReminders()).toBe(0);
  expect(sent[0].body.chat_id).toBe(7);
  expect(sent[0].body.text).toContain('4 Tagen');

  // Claimed today: the deadline moves a day on and gets its own reminder later
  await reportStreak(user, { streak: 5, expires_at: now() + REMIND_BEFORE + 86400 });
  expect(await sendDueReminders()).toBe(0);
});

test('muted, too late, no streak and refused input', async () => {
  await reportStreak({ id: 1 }, { streak: 2, expires_at: now() + 3600 });
  await setMuted(1, true);
  await reportStreak({ id: 2 }, { streak: 2, expires_at: now() + 300 });
  await reportStreak({ id: 3 }, { streak: 0, expires_at: now() + 3600 });
  expect(await sendDueReminders()).toBe(0);
  await expect(reportStreak({ id: 4 }, { streak: 1, expires_at: now() + 10 * 86400 })).rejects.toThrow();
  await expect(reportStreak({ id: 4 }, { streak: -1, expires_at: now() })).rejects.toThrow();
});

test('a refused message blocks until the player is reachable again', async () => {
  reply = () => ({ ok: false, error_code: 403, description: 'Forbidden: bot was blocked by the user' });
  await reportStreak({ id: 9 }, { streak: 3, expires_at: now() + 3600 });
  expect(await sendDueReminders()).toBe(0);

  reply = () => ({ ok: true, result: {} });
  await reportStreak({ id: 9 }, { streak: 3, expires_at: now() + 3000 });
  expect(await sendDueReminders()).toBe(0);
  await unblock(9);
  expect(await sendDueReminders()).toBe(1);
});

function signed(token, fields) {
  const params = new URLSearchParams(fields);
  const check = [...params.entries()].map(([k, v]) => `${k}=${v}`).sort().join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(token).digest();
  params.set('hash', createHmac('sha256', secret).update(check).digest('hex'));
  return params.toString();
}

test('initData is checked like Telegram does', () => {
  const raw = signed('tok', { auth_date: String(now()), user: JSON.stringify({ id: 5, first_name: 'A' }), query_id: 'q' });
  expect(verifyInitData(raw, 'tok').user.id).toBe(5);
  expect(verifyInitData(raw, 'other')).toBeNull();
  expect(verifyInitData(raw.replace('id%22%3A5', 'id%22%3A6'), 'tok')).toBeNull();
  const old = signed('tok', { auth_date: String(now() - 2 * 86400), user: JSON.stringify({ id: 5 }) });
  expect(verifyInitData(old, 'tok')).toBeNull();
  expect(verifyInitData('', 'tok')).toBeNull();
});

test('the API answers like the platform', async () => {
  const handle = createApi({
    token: 'tok',
    origins: ['https://game.test'],
    endpoints: {
      echo: async (input, ctx) => ({ input, user: ctx.initData.user.id }),
      refuse: async () => { throw new EndpointError('No', { code: 'NOPE' }); },
    },
  });
  const initData = signed('tok', { auth_date: String(now()), user: JSON.stringify({ id: 5 }) });
  const post = (name, headers) => handle(new Request(`http://x/api/${name}`, {
    method: 'POST', headers: { origin: 'https://game.test', ...headers }, body: JSON.stringify({ a: 1 }),
  }));

  const ok = await post('echo', { 'x-telegram-init-data': initData });
  expect(ok.headers.get('access-control-allow-origin')).toBe('https://game.test');
  expect(await ok.json()).toEqual({ ok: true, result: { input: { a: 1 }, user: 5 } });
  expect((await post('echo', {})).status).toBe(401);
  const refused = await post('refuse', { 'x-telegram-init-data': initData });
  expect(refused.status).toBe(400);
  expect((await refused.json()).parameters.code).toBe('NOPE');
  expect((await post('missing', { 'x-telegram-init-data': initData })).status).toBe(404);
});
