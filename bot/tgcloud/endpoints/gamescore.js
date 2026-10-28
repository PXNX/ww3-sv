// endpoints/gamescore.js — `{ session, game, score }` → `{ new_best, best, rank }`. A run of a game
// opened from a chat's game message ends: the score goes onto that chat's scoreboard, where Telegram
// posts each new personal best, and the bot announces when the player took the chat's record.

import { EndpointError } from 'sdk';
import { announceRecord } from '../lib/bot.js';
import { GameScoreError, reportScore } from '../lib/games.js';
import { upsertAccount } from '../lib/ledger.js';

export default async function (input, ctx) {
  const user = ctx.initData.user;
  await upsertAccount(user);
  let result;
  try {
    result = await reportScore(user, input);
  } catch (error) {
    if (error instanceof GameScoreError) throw new EndpointError(error.message, { code: error.code });
    throw error;
  }
  if (result.overtook) {
    try {
      await announceRecord(user, result);
    } catch (error) {
      // The score is on the scoreboard either way; the bot may have been removed from the chat
      console.warn('could not announce record', result.chatId, error.description ?? error.message);
    }
  }
  return { new_best: result.new_best, best: result.best, rank: result.rank };
}
