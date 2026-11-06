// The Mini App endpoints on nyx: what Telegram Serverless does in front of tgcloud/endpoints/.
// POST /api/<name> with the raw initData in the X-Telegram-Init-Data header and the input as the
// JSON body. The initData is checked against the bot token (HMAC, as Telegram documents for Mini
// Apps) and is never stored or logged; only the verified user reaches the endpoint.

import { createHmac, timingSafeEqual } from 'node:crypto';
import { EndpointError } from 'sdk';

// Launch data older than this is refused, so a leaked initData stops working
const MAX_AGE = 24 * 3600;

/** The verified initData as an object (with `user` parsed), or null when the signature is wrong */
export function verifyInitData(raw, token, now = Math.floor(Date.now() / 1000)) {
  if (typeof raw !== 'string' || !raw) return null;
  const params = new URLSearchParams(raw);
  const hash = params.get('hash');
  if (!hash || !/^[0-9a-f]{64}$/.test(hash)) return null;
  params.delete('hash');
  const checkString = [...params.entries()].map(([key, value]) => `${key}=${value}`).sort().join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(token).digest();
  const expected = createHmac('sha256', secret).update(checkString).digest();
  if (!timingSafeEqual(expected, Buffer.from(hash, 'hex'))) return null;

  const authDate = Number(params.get('auth_date'));
  if (!Number.isInteger(authDate) || now - authDate > MAX_AGE) return null;
  const data = Object.fromEntries(params.entries());
  try {
    data.user = JSON.parse(data.user ?? 'null');
  } catch {
    return null;
  }
  if (!data.user || !Number.isInteger(data.user.id)) return null;
  return data;
}

const json = (status, body, headers) =>
  new Response(JSON.stringify(body), { status, headers: { ...headers, 'content-type': 'application/json' } });

/**
 * `endpoints` get the verified initData; `openEndpoints` run without it and check their own
 * credential (the game page of a Telegram game has no initData, only its session id).
 */
export function createApi({ token, endpoints, openEndpoints = {}, origins, pages = {} }) {
  return async function handle(request) {
    // The legal pages as web pages, linked from the bot's messages and the Mini App's consent box
    const page = new URL(request.url).pathname.match(/^\/legal\/([a-z]+)\.html$/)?.[1];
    if (request.method === 'GET' && page && Object.hasOwn(pages, page)) {
      return new Response(pages[page], { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' } });
    }

    const origin = request.headers.get('origin') ?? '';
    const cors = origins.includes(origin)
      ? {
          'access-control-allow-origin': origin,
          'access-control-allow-headers': 'content-type, x-telegram-init-data',
          'access-control-allow-methods': 'POST',
          'access-control-max-age': '86400',
          vary: 'origin',
        }
      : {};
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const name = new URL(request.url).pathname.match(/^\/api\/([A-Za-z_][A-Za-z0-9_]*)$/)?.[1];
    const open = Boolean(name) && Object.hasOwn(openEndpoints, name);
    const endpoint = open ? openEndpoints[name] : name && Object.hasOwn(endpoints, name) ? endpoints[name] : null;
    if (request.method !== 'POST' || !endpoint) return json(404, { ok: false, description: 'Not found' }, cors);

    const initData = open ? null : verifyInitData(request.headers.get('x-telegram-init-data'), token);
    if (!open && !initData) return json(401, { ok: false, type: 'UNAUTHORIZED', description: 'Invalid init data' }, cors);

    let input;
    try {
      input = await request.json();
    } catch {
      input = {};
    }
    if (typeof input !== 'object' || input === null || Array.isArray(input)) input = {};

    try {
      return json(200, { ok: true, result: await endpoint(input, { initData }) }, cors);
    } catch (error) {
      if (error instanceof EndpointError) {
        return json(400, { ok: false, type: 'ENDPOINT_ERROR', description: error.message, parameters: error.parameters }, cors);
      }
      console.error('endpoint', name, 'failed', error);
      return json(500, { ok: false, type: 'UNKNOWN', description: 'Internal error' }, cors);
    }
  };
}
