// Runs the tgcloud/ handlers on nyx while Telegram Serverless is not enabled for the bot: long
// polling instead of the platform's webhook, a local SQLite file instead of the platform database.
// The handlers import `sdk` and get this project's shim (runner/sdk), so the same code deploys to
// Serverless unchanged later. Endpoints need the platform's initData check and are not served here.

import { api, sqlite } from 'sdk';
import * as schema from '../tgcloud/schema.js';
import { ensureTables } from './tables.js';

ensureTables(sqlite, schema);

const HANDLERS = {
  message: (await import('../tgcloud/handlers/message.js')).default,
  callback_query: (await import('../tgcloud/handlers/callback_query.js')).default,
  pre_checkout_query: (await import('../tgcloud/handlers/pre_checkout_query.js')).default,
};

async function dispatch(update) {
  for (const [type, handler] of Object.entries(HANDLERS)) {
    if (update[type]) return await handler(update[type], { update });
  }
}

// Polling and a webhook exclude each other; if enabling Serverless set one, polling takes over again
await api.deleteWebhook({ drop_pending_updates: false });
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
