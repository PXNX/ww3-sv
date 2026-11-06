// Runs the tgcloud/ handlers on nyx while Telegram Serverless is not enabled for the bot: long
// polling instead of the platform's webhook, a local SQLite file instead of the platform database.
// The handlers import `sdk` and get this project's shim (runner/sdk), so the same code deploys to
// Serverless unchanged later. runner/api.js serves the endpoints with the platform's initData check,
// and a timer runs the streak reminders, which on Serverless would need a scheduled trigger.

import { api, sqlite } from 'sdk';
import * as schema from '../tgcloud/schema.js';
import { applyCommands } from '../tgcloud/lib/profile.js';
import { sendDueReminders } from '../tgcloud/lib/reminders.js';
import { PAGES, renderHtml } from '../scripts/legal-render.mjs';
import { TEXTS } from '../tgcloud/lib/generated.js';
import { createApi } from './api.js';
import { ensureTables } from './tables.js';

ensureTables(sqlite, schema);

const HANDLERS = {
  message: (await import('../tgcloud/handlers/message.js')).default,
  callback_query: (await import('../tgcloud/handlers/callback_query.js')).default,
  pre_checkout_query: (await import('../tgcloud/handlers/pre_checkout_query.js')).default,
  my_chat_member: (await import('../tgcloud/handlers/my_chat_member.js')).default,
};

async function dispatch(update) {
  for (const [type, handler] of Object.entries(HANDLERS)) {
    if (update[type]) return await handler(update[type], { update });
  }
}

const ENDPOINTS = {
  me: (await import('../tgcloud/endpoints/me.js')).default,
  invoice: (await import('../tgcloud/endpoints/invoice.js')).default,
  spend: (await import('../tgcloud/endpoints/spend.js')).default,
  streak: (await import('../tgcloud/endpoints/streak.js')).default,
};

// Called by the game page of a Telegram game, which has a session id instead of initData
const OPEN_ENDPOINTS = {
  gamescore: (await import('../tgcloud/endpoints/gamescore.js')).default,
};

const LEGAL_PAGES = Object.fromEntries(Object.keys(PAGES).map((page) => [page, renderHtml(page, TEXTS[page])]));

const port = Number(process.env.API_PORT || 3790);
const origins = (process.env.API_ORIGINS || 'https://ww3-sv.vercel.app').split(',').map((o) => o.trim());
Bun.serve({ port, hostname: '0.0.0.0', fetch: createApi({ token: process.env.TELEGRAM, endpoints: ENDPOINTS, openEndpoints: OPEN_ENDPOINTS, origins, pages: LEGAL_PAGES }) });
console.info(`endpoints on :${port} for ${origins.join(', ')}`);

const REMINDER_INTERVAL_MS = 60_000;
setInterval(() => {
  sendDueReminders()
    .then((sent) => sent && console.info('streak reminders sent', sent))
    .catch((error) => console.error('streak reminders failed', error));
}, REMINDER_INTERVAL_MS);

// Polling and a webhook exclude each other; if enabling Serverless set one, polling takes over again
await api.deleteWebhook({ drop_pending_updates: false });
await applyCommands();
const me = await api.getMe();
console.info(`polling as @${me.username}`);

let offset = 0;
let stopping = false;
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { stopping = true; });

while (!stopping) {
  let updates;
  try {
    updates = await api.getUpdates({ offset, timeout: 30, allowed_updates: Object.keys(HANDLERS) });
  } catch (error) {
    console.error('getUpdates failed', error.message);
    await Bun.sleep(5000);
    continue;
  }
  for (const update of updates) {
    offset = update.update_id + 1;
    // pre_checkout_query must be answered within 10 seconds, so updates are not queued behind each other
    dispatch(update).catch((error) => console.error('update', update.update_id, 'failed', error));
  }
}
process.exit(0);
