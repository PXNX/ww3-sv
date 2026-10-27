// `sdk` for the nyx runner: the same `db`, `api`, `fetch` and `EndpointError` the handlers get on
// Telegram Serverless, backed by a local SQLite file and the plain Bot API over HTTPS.

import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';

const token = process.env.TELEGRAM;
if (!token) throw new Error('TELEGRAM (the bot token) is not set');

const sqlite = new Database(process.env.DB_PATH ?? 'data/ww3.db', { create: true });
sqlite.exec('PRAGMA journal_mode = WAL');

export const db = drizzle(sqlite);
export { sqlite };

// The platform's raw `db.run` reports `rowsAffected`; bun:sqlite calls it `changes`
const run = db.run.bind(db);
db.run = async (query) => {
  const result = await run(query);
  return { ...result, rowsAffected: result?.changes ?? 0 };
};
// and its raw `db.get` returns the row as an object, where drizzle returns the bare values
const all = db.all.bind(db);
db.get = async (query) => (await all(query))[0] ?? null;

export class BotApiError extends Error {
  constructor(method, body) {
    super(`${method}: ${body.description}`);
    this.code = body.error_code;
    this.description = body.description;
    this.parameters = body.parameters;
  }
}

export class EndpointError extends Error {
  constructor(message, parameters = {}) {
    super(message);
    this.parameters = parameters;
  }
}

// Params with a Blob go out as multipart (file uploads such as the profile photo), the rest as JSON
function encode(params) {
  if (!Object.values(params).some((value) => value instanceof Blob)) {
    return { headers: { 'content-type': 'application/json' }, body: JSON.stringify(params) };
  }
  const form = new FormData();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    form.append(key, value instanceof Blob ? value : typeof value === 'object' ? JSON.stringify(value) : String(value));
  }
  return { body: form };
}

async function call(method, params = {}) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: 'POST', ...encode(params) });
  const body = await response.json();
  if (!body.ok) throw new BotApiError(method, body);
  return body.result;
}

export const api = new Proxy({}, { get: (_, method) => (params) => call(method, params) });

const outbound = globalThis.fetch;
export { outbound as fetch };
