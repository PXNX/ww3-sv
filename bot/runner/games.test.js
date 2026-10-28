// Group leaderboards on the runner's shim, with the Bot API stubbed: sessions, scores only going up,
// Telegram's scoreboard being set, the record changing hands, and /top.
import { beforeEach, expect, test } from 'bun:test';

process.env.TELEGRAM ??= 'test';
process.env.DB_PATH = ':memory:';
const { sqlite } = await import('sdk');
const schema = await import('../tgcloud/schema.js');
const { ensureTables } = await import('./tables.js');
const games = await import('../tgcloud/lib/games.js');
const { parseCommand } = await import('../tgcloud/handlers/message.js');
const gamescore = (await import('../tgcloud/endpoints/gamescore.js')).default;

ensureTables(sqlite, schema);

// Every Bot API call goes through fetch; answer them here and remember what was asked
let calls = [];
let refuse = null;
globalThis.fetch = async (url, init) => {
  const method = String(url).split('/').pop();
  const params = JSON.parse(init.body);
  calls.push({ method, params });
  if (refuse?.(method, params)) {
    return Response.json({ ok: false, error_code: 400, description: 'Bad Request: BOT_SCORE_NOT_MODIFIED' });
  }
  return Response.json({ ok: true, result: method === 'sendMessage' ? { message_id: 1 } : true });
};

beforeEach(() => {
  calls = [];
  refuse = null;
});

const GROUP = -1001234567890;
const message = { chat: { id: GROUP }, message_id: 77 };
const ada = { id: 1, first_name: 'Ada' };
const bob = { id: 2, first_name: 'Bob' };

test('every game has a unique id that works as a short name and in the start parameter', () => {
  const ids = games.GAMES.map((entry) => entry.id);
  expect(new Set(ids).size).toBe(ids.length);
  for (const entry of games.GAMES) {
    expect(entry.id).toMatch(/^[a-z]+$/);
    expect(entry.en && entry.de).toBeTruthy();
  }
  expect(games.sessionLink('blocks', 'ab'.repeat(10))).toBe(`https://t.me/game_ww3_bot?startapp=g_blocks_${'ab'.repeat(10)}`);
});

test('a session only takes scores from its player, for its game', async () => {
  const session = await games.openSession(ada, 'blocks', message);
  expect(session).toMatch(/^[0-9a-f]{20}$/);
  await expect(games.reportScore(bob, { session, game: 'blocks', score: 5 })).rejects.toMatchObject({ code: 'SESSION_UNKNOWN' });
  // A mode that is not a Telegram game (yet)
  await expect(games.reportScore(ada, { session, game: 'minefield', score: 5 })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  await expect(games.reportScore(ada, { session: 'nope', game: 'blocks', score: 5 })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  for (const score of [-1, 1.5, '9', games.MAX_SCORE + 1]) {
    await expect(games.reportScore(ada, { session, game: 'blocks', score })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  }
  sqlite.exec(`UPDATE game_sessions SET created_at = created_at - ${games.SESSION_TTL + 1} WHERE id = '${session}'`);
  await expect(games.reportScore(ada, { session, game: 'blocks', score: 5 })).rejects.toMatchObject({ code: 'SESSION_EXPIRED' });
  expect(calls).toEqual([]);
});

test('a better run goes onto the chat scoreboard, a worse one does not', async () => {
  const session = await games.openSession(ada, 'blocks', message);
  const first = await games.reportScore(ada, { session, game: 'blocks', score: 100 });
  expect(first).toMatchObject({ new_best: true, best: 100, rank: 1, overtook: null });
  expect(calls).toEqual([{ method: 'setGameScore', params: { user_id: 1, score: 100, chat_id: GROUP, message_id: 77 } }]);

  calls = [];
  expect(await games.reportScore(ada, { session, game: 'blocks', score: 80 })).toMatchObject({ new_best: false, best: 100 });
  expect(calls).toEqual([]);

  // Telegram already holds a better score (set before the bot kept a copy): nothing changes
  refuse = (method) => method === 'setGameScore';
  expect(await games.reportScore(ada, { session, game: 'blocks', score: 120 })).toMatchObject({ new_best: false });
  expect((await games.topScores(GROUP, 'blocks'))[0].score).toBe(100);
});

test('taking the record from someone else is announced in the chat', async () => {
  const adaSession = await games.openSession(ada, 'blocks', message);
  const bobSession = await games.openSession(bob, 'blocks', message);
  await gamescore({ session: adaSession, game: 'blocks', score: 300 }, { initData: { user: ada } });

  calls = [];
  // Second place is a new personal best, but not the record
  expect(await gamescore({ session: bobSession, game: 'blocks', score: 200 }, { initData: { user: bob } }))
    .toEqual({ new_best: true, best: 200, rank: 2 });
  expect(calls.map((call) => call.method)).toEqual(['setGameScore']);

  calls = [];
  expect(await gamescore({ session: bobSession, game: 'blocks', score: 400 }, { initData: { user: bob } }))
    .toEqual({ new_best: true, best: 400, rank: 1 });
  expect(calls.map((call) => call.method)).toEqual(['setGameScore', 'sendMessage']);
  expect(calls[1].params.chat_id).toBe(GROUP);
  expect(calls[1].params.text).toContain('Bob');
  expect(calls[1].params.text).toContain('Ada (300)');

  // Beating your own record is left to Telegram's own message
  calls = [];
  await gamescore({ session: bobSession, game: 'blocks', score: 500 }, { initData: { user: bob } });
  expect(calls.map((call) => call.method)).toEqual(['setGameScore']);

  expect(await games.topScores(GROUP, 'blocks')).toEqual([{ name: 'Bob', score: 500 }, { name: 'Ada', score: 300 }]);
  expect(await games.topScores(-1, 'blocks')).toEqual([]);
  const records = await games.chatRecords(GROUP);
  expect(records.find((row) => row.game === 'blocks')).toMatchObject({ score: 500, name: 'Bob', players: 2 });
});

test('the endpoint refuses a bad session with a code the game can read', async () => {
  await expect(gamescore({ session: 'x', game: 'blocks', score: 1 }, { initData: { user: ada } }))
    .rejects.toMatchObject({ parameters: { code: 'INVALID_INPUT' } });
});

test('commands addressed to another bot are not ours', () => {
  expect(parseCommand('/top')).toEqual({ command: 'top', args: [] });
  expect(parseCommand('/Top@Game_WW3_bot minefield')).toEqual({ command: 'top', args: ['minefield'] });
  expect(parseCommand('/top@other_bot')).toBeNull();
  expect(parseCommand('hello')).toBeNull();
  expect(parseCommand(undefined)).toBeNull();
});

test('games are played in groups only, never in private chats or channels', async () => {
  const onMessage = (await import('../tgcloud/handlers/message.js')).default;
  const onCallback = (await import('../tgcloud/handlers/callback_query.js')).default;
  const privateChat = { id: ada.id, type: 'private' };
  const group = { id: GROUP, type: 'supergroup', title: 'Test' };
  const sessions = () => sqlite.query('SELECT COUNT(*) AS n FROM game_sessions').get().n;

  await onMessage({ chat: group, from: ada, text: '/games@game_ww3_bot' });
  expect(calls.map((call) => call.method)).toEqual(['sendMessage']);
  expect(calls[0].params.reply_markup.inline_keyboard[0][0].callback_data).toBe('game:blocks');

  // The private chat points to a group, with a button that adds the bot to one
  calls = [];
  await onMessage({ chat: privateChat, from: ada, text: '/games' });
  expect(calls.map((call) => call.method)).toEqual(['sendMessage']);
  expect(calls[0].params.reply_markup.inline_keyboard[0][0].url).toBe('https://t.me/game_ww3_bot?startgroup=games');

  // A channel post never reaches this handler as a message, but a channel chat is ignored anyway
  calls = [];
  await onMessage({ chat: { id: -100999, type: 'channel' }, from: ada, text: '/games' });
  expect(calls).toEqual([]);

  // Menu buttons and Play outside a group answer with an alert and post or open nothing
  const before = await sessions();
  for (const query of [
    { id: 'q1', from: ada, data: 'game:blocks', message: { chat: privateChat, message_id: 5 } },
    { id: 'q2', from: ada, data: 'top:blocks', message: { chat: privateChat, message_id: 5 } },
    { id: 'q3', from: ada, game_short_name: 'blocks', message: { chat: privateChat, message_id: 5 } },
  ]) {
    calls = [];
    await onCallback(query);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ method: 'answerCallbackQuery', params: { callback_query_id: query.id, show_alert: true } });
    expect(calls[0].params.url).toBeUndefined();
  }
  expect(await sessions()).toBe(before);

  // In the group, Play opens the game with a fresh session
  calls = [];
  await onCallback({ id: 'q4', from: ada, game_short_name: 'blocks', message: { chat: group, message_id: 6 } });
  expect(calls[0].params.url).toMatch(/^https:\/\/t\.me\/game_ww3_bot\?startapp=g_blocks_[0-9a-f]{20}$/);
  expect(await sessions()).toBe(before + 1);
});
