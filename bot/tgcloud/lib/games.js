// Group leaderboards through Telegram's gaming platform (https://core.telegram.org/bots/games). Each
// mode is a game registered with @BotFather under its mode id; /games in a group posts one with
// sendGame. Pressing Play stores a session (player, chat, message, game) and opens the game page with
// the session id in its URL; Telegram opens a game's URL in its own browser, without the Mini App's
// initData, so the id (128 random bits, given only to the player who pressed Play, valid for a day)
// is what proves who plays. At the end of a run the game sends the score back with it, and
// setGameScore puts it on that chat's scoreboard: Telegram keeps one table per chat and posts its
// own message on every new personal best. The bot keeps a copy of the bests for /top and announces
// when someone takes the record.

import { api, db, BotApiError } from 'sdk';
import { sql } from 'sdk/db';
import { APP_URL } from './generated.js';
import { nowSeconds } from './ledger.js';

// The modes offered as Telegram games, for now only Block Puzzle (todo.md in ww3-sv lists the rest).
// The id is both the game's short name at @BotFather and its route in the game (/play/<id>); a mode
// can join once it reports its score from the shared result sheet and the game accepts its id.
export const GAMES = [
  { id: 'blocks', en: 'Block Puzzle', de: 'Block-Puzzle' },
];

// A session is good for a day of rounds, like the Mini App's launch data on the runner
export const SESSION_TTL = 24 * 3600;
// Telegram's scores are 32-bit integers; anything above this is not a real run
export const MAX_SCORE = 2 ** 31 - 1;
// Lines in /top
const TOP_LIMIT = 10;

export class GameScoreError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

export const findGame = (id) => GAMES.find((entry) => entry.id === id) ?? null;
export const gameName = (id, lang) => findGame(id)?.[lang] ?? findGame(id)?.en ?? id;

function sessionId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** The game page a Play press opens, with the session that its scores are reported with; null without a deployed game */
export const sessionLink = (game, session) => (APP_URL ? `${APP_URL}/play/${game}?game_session=${session}` : null);

/** Remembers who pressed Play on which game message; returns the session id */
export async function openSession(user, game, message) {
  const id = sessionId();
  const now = nowSeconds();
  await db.run(sql`DELETE FROM game_sessions WHERE created_at < ${now - SESSION_TTL}`);
  await db.run(sql`
    INSERT INTO game_sessions (id, user_id, first_name, language, game, chat_id, message_id, created_at)
    VALUES (${id}, ${user.id}, ${user.first_name ?? ''}, ${user.language_code ?? null}, ${game}, ${message.chat.id}, ${message.message_id}, ${now})
  `);
  return id;
}

/** The session for this game, with the player who opened it, or a GameScoreError */
async function liveSession(input) {
  const { session, game } = input ?? {};
  if (typeof session !== 'string' || !/^[0-9a-f]{32}$/.test(session) || !findGame(game)) {
    throw new GameScoreError('INVALID_INPUT', 'Unknown game or session.');
  }
  const row = await db.get(sql`
    SELECT user_id, first_name, language, game, chat_id, message_id, created_at FROM game_sessions WHERE id = ${session}
  `);
  if (!row || row.game !== game) {
    throw new GameScoreError('SESSION_UNKNOWN', 'This game was not opened from a chat.');
  }
  if (nowSeconds() - row.created_at > SESSION_TTL) {
    throw new GameScoreError('SESSION_EXPIRED', 'Open the game from the chat again.');
  }
  const user = { id: row.user_id, first_name: row.first_name ?? '', language_code: row.language ?? undefined };
  return { user, game, chatId: row.chat_id, messageId: row.message_id };
}

const notModified = (error) => error instanceof BotApiError && /BOT_SCORE_NOT_MODIFIED/i.test(error.description ?? '');

/**
 * Puts a finished run on the scoreboard of the chat the game was opened from. Returns whether it
 * was a new personal best there, the best, the rank in that chat, the chat's leaderboard around the
 * player for the result screen, and, when the run took the chat's record from someone else, who held
 * it before (the caller announces that).
 */
export async function reportScore(input) {
  const session = await liveSession(input);
  const score = input.score;
  if (!Number.isInteger(score) || score < 0 || score > MAX_SCORE) {
    throw new GameScoreError('INVALID_INPUT', 'The score must be a whole number.');
  }
  const result = await setScore(session, score);
  return { ...result, leaderboard: await leaderboard(session) };
}

async function setScore({ user, game, chatId, messageId }, score) {

  const mine = await db.get(sql`
    SELECT score FROM group_scores WHERE chat_id = ${chatId} AND game = ${game} AND user_id = ${user.id}
  `);
  if (mine && score <= mine.score) return { new_best: false, best: mine.score, rank: await rank(chatId, game, mine.score) };

  try {
    await api.setGameScore({ user_id: user.id, score, chat_id: chatId, message_id: messageId });
  } catch (error) {
    // Telegram already holds a better score for this player (one we never saw); keep ours as it is
    if (notModified(error)) return { new_best: false, best: mine?.score ?? null, rank: null };
    throw error;
  }

  const record = await db.get(sql`
    SELECT user_id, first_name, score FROM group_scores WHERE chat_id = ${chatId} AND game = ${game}
    ORDER BY score DESC, updated_at ASC LIMIT 1
  `);
  await db.run(sql`
    INSERT INTO group_scores (chat_id, game, user_id, first_name, score, updated_at)
    VALUES (${chatId}, ${game}, ${user.id}, ${user.first_name ?? ''}, ${score}, ${nowSeconds()})
    ON CONFLICT (chat_id, game, user_id) DO UPDATE SET
      score = excluded.score, first_name = excluded.first_name, updated_at = excluded.updated_at
    WHERE excluded.score > group_scores.score
  `);
  const overtook = record && record.user_id !== user.id && score > record.score
    ? { name: record.first_name, score: record.score }
    : null;
  return { new_best: true, best: score, rank: await rank(chatId, game, score), user, chatId, game, overtook };
}

/**
 * The chat's leaderboard of the game as Telegram keeps it (getGameHighScores: the player, two
 * neighbours on each side, and the top three), with the player marked; the bot's own copy when
 * Telegram cannot answer
 */
async function leaderboard({ user, game, chatId, messageId }) {
  try {
    const rows = await api.getGameHighScores({ user_id: user.id, chat_id: chatId, message_id: messageId });
    return rows.map((row) => ({
      position: row.position,
      name: [row.user.first_name, row.user.last_name].filter(Boolean).join(' '),
      score: row.score,
      me: row.user.id === user.id,
    }));
  } catch (error) {
    console.warn('getGameHighScores failed', chatId, error.description ?? error.message);
    const rows = await db.all(sql`
      SELECT user_id, first_name, score FROM group_scores WHERE chat_id = ${chatId} AND game = ${game}
      ORDER BY score DESC, updated_at ASC LIMIT ${TOP_LIMIT}
    `);
    return rows.map((row, i) => ({ position: i + 1, name: row.first_name, score: row.score, me: row.user_id === user.id }));
  }
}

async function rank(chatId, game, score) {
  const row = await db.get(sql`
    SELECT COUNT(*) AS better FROM group_scores WHERE chat_id = ${chatId} AND game = ${game} AND score > ${score}
  `);
  return Number(row?.better ?? 0) + 1;
}

/** The chat's best players in one game, best first */
export async function topScores(chatId, game, limit = TOP_LIMIT) {
  return await db.all(sql`
    SELECT first_name AS name, score FROM group_scores WHERE chat_id = ${chatId} AND game = ${game}
    ORDER BY score DESC, updated_at ASC LIMIT ${limit}
  `);
}

/** The record of every game played in the chat, with its holder, most played first */
export async function chatRecords(chatId) {
  return await db.all(sql`
    SELECT game, COUNT(*) AS players, MAX(score) AS score,
      (SELECT first_name FROM group_scores AS best WHERE best.chat_id = scores.chat_id AND best.game = scores.game
        ORDER BY best.score DESC, best.updated_at ASC LIMIT 1) AS name
    FROM group_scores AS scores WHERE chat_id = ${chatId}
    GROUP BY game ORDER BY players DESC, game ASC
  `);
}
