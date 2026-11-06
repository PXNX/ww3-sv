"""
The HTTP side: POST /api/<name> for the game, and the legal pages at GET /legal/<page>.html.

Mini App calls carry the raw initData in the X-Telegram-Init-Data header and the input as the JSON
body. The initData is checked against the bot token (HMAC, as Telegram documents for Mini Apps) and
is never stored or logged; only the verified user reaches the endpoint. Answers are
`{ ok: true, result }`, or `{ ok: false, type, description, parameters? }` with 400 (an endpoint's
refusal), 401 (invalid initData), 404 or 500.
"""
import hashlib
import hmac
import json
import logging
import time
from urllib.parse import parse_qsl

from aiohttp import web
from telegram import Bot

from ww3bot.endpoints import EndpointError

logger = logging.getLogger(__name__)

# Launch data older than this is refused, so a leaked initData stops working
MAX_AGE = 24 * 3600


def verify_init_data(raw: str | None, token: str, now: int | None = None) -> dict | None:
    """The verified initData (with `user` parsed), or None when the signature or the age is wrong."""
    if not raw or not isinstance(raw, str):
        return None
    fields = dict(parse_qsl(raw, keep_blank_values=True))
    received = fields.pop("hash", "")
    if len(received) != 64 or any(c not in "0123456789abcdef" for c in received):
        return None
    check = "\n".join(f"{key}={value}" for key, value in sorted(fields.items()))
    secret = hmac.new(b"WebAppData", token.encode(), hashlib.sha256).digest()
    expected = hmac.new(secret, check.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, received):
        return None
    try:
        auth_date = int(fields.get("auth_date", ""))
    except ValueError:
        return None
    if (now if now is not None else int(time.time())) - auth_date > MAX_AGE:
        return None
    try:
        fields["user"] = json.loads(fields.get("user") or "null")
    except ValueError:
        return None
    user = fields["user"]
    if not isinstance(user, dict) or not isinstance(user.get("id"), int) or isinstance(user.get("id"), bool):
        return None
    return fields


def create_app(bot: Bot, token: str, endpoints: dict, open_endpoints: dict, origins: list[str], pages: dict[str, str]) -> web.Application:
    """`endpoints` get the verified initData; `open_endpoints` run without it and check their own credential."""

    def cors(request: web.Request) -> dict[str, str]:
        origin = request.headers.get("origin", "")
        if origin not in origins:
            return {}
        return {
            "access-control-allow-origin": origin,
            "access-control-allow-headers": "content-type, x-telegram-init-data",
            "access-control-allow-methods": "POST",
            "access-control-max-age": "86400",
            "vary": "origin",
        }

    def reply(request: web.Request, status: int, body: dict) -> web.Response:
        return web.json_response(body, status=status, headers=cors(request))

    async def legal_page(request: web.Request) -> web.Response:
        page = pages.get(request.match_info["page"])
        if page is None:
            raise web.HTTPNotFound()
        return web.Response(text=page, content_type="text/html", charset="utf-8", headers={"cache-control": "public, max-age=300"})

    async def preflight(request: web.Request) -> web.Response:
        return web.Response(status=204, headers=cors(request))

    async def call(request: web.Request) -> web.Response:
        name = request.match_info["name"]
        is_open = name in open_endpoints
        endpoint = open_endpoints.get(name) if is_open else endpoints.get(name)
        if endpoint is None:
            return reply(request, 404, {"ok": False, "description": "Not found"})
        init_data = None
        if not is_open:
            init_data = verify_init_data(request.headers.get("x-telegram-init-data"), token)
            if init_data is None:
                return reply(request, 401, {"ok": False, "type": "UNAUTHORIZED", "description": "Invalid init data"})
        try:
            data = await request.json()
        except (ValueError, UnicodeDecodeError):
            data = {}
        if not isinstance(data, dict):
            data = {}
        try:
            return reply(request, 200, {"ok": True, "result": await endpoint(bot, data, init_data)})
        except EndpointError as error:
            return reply(request, 400, {"ok": False, "type": "ENDPOINT_ERROR", "description": str(error), "parameters": error.parameters})
        except Exception:
            logger.exception("endpoint %s failed", name)
            return reply(request, 500, {"ok": False, "type": "UNKNOWN", "description": "Internal error"})

    app = web.Application(client_max_size=64 * 1024)
    app.router.add_get(r"/legal/{page:[a-z]+}.html", legal_page)
    app.router.add_route("OPTIONS", "/{tail:.*}", preflight)
    app.router.add_post(r"/api/{name:[A-Za-z_][A-Za-z0-9_]*}", call)
    return app
