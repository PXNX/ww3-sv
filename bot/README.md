# World War 3 bot

The Telegram side of World War 3 ([@game_ww3_bot](https://t.me/game_ww3_bot)), written with
[python-telegram-bot](https://python-telegram-bot.org/) and PostgreSQL. It lives in `bot/` of the game's
repository; paths below are relative to `bot/`.

- **Login**: inside Telegram the player is signed in through the Mini App's `initData`, which the bot's
  endpoints verify (HMAC with the bot token) before anything runs. `/start` and `/login` open the game.
- **Payments with Telegram Stars**: a revival token (25 Stars) and World War 3 Pro (250 Stars every 30 days as
  a Stars subscription: 10 revival tokens per period, and no adverts once the game has them). Goods are granted
  only on `successful_payment`, once per charge id.
- **No refunds** beyond the statutory rights. Before the first purchase of a terms version the buyer consents to
  immediate delivery and acknowledges losing the right of withdrawal (§ 356 Abs. 4 and 5 BGB); the consent is
  stored and repeated in the purchase confirmation sent to the chat.
- **Legal pages for German law**: Impressum, Datenschutzerklärung, AGB and Widerrufsbelehrung as `/impressum`,
  `/datenschutz`, `/agb`, `/widerruf` (aliases `/imprint`, `/privacy`, `/terms`, `/withdrawal`) and as web pages at
  `/legal/<page>.html`. `/paysupport` is the support contact Telegram requires for bots that sell.
- **Invites and streak reminders**: `/invite` links earn revival tokens, and the game reports its daily streak so
  the bot can remind two hours before it breaks (`/reminders` to switch).
- **Group leaderboards** through [Telegram's gaming platform](https://core.telegram.org/bots/games): added to a
  group, the bot posts a game with `/games`; Telegram keeps its scoreboard per chat and posts every new best
  there, `/top` lists the group's leaderboard, and the bot announces when someone takes the group's record.

## Layout

| Path | What it is |
| --- | --- |
| `ww3bot/__main__.py` | Start-up: polling, the HTTP endpoints, the reminder job |
| `ww3bot/handlers.py` | Messages (commands, `successful_payment`), callback queries (incl. Play), pre-checkout, joining a group |
| `ww3bot/chat.py` | Chat flows: start, login, shop, consent, confirmation, support, invites, games and `/top` |
| `ww3bot/endpoints.py`, `ww3bot/api.py` | The game's endpoints and the HTTP server with the initData check |
| `ww3bot/games.py` | The Telegram games, Play sessions, scores and the groups' leaderboards |
| `ww3bot/ledger.py`, `ww3bot/catalogue.py` | Accounts, consent, invoices, purchases, the revival wallet; items and Stars prices |
| `ww3bot/referrals.py`, `ww3bot/reminders.py` | Invite rewards; streak reminders |
| `ww3bot/db.py` | PostgreSQL pool and schema (created on start, additions only) |
| `ww3bot/texts.py`, `ww3bot/legal.py`, `legal/*.txt` | Every bot text in German and English; the legal pages with `{placeholders}` for the operator data |
| `ww3bot/profile.py`, `res/` | Name, descriptions, command menus and profile photo, applied by `/set_cmd` |
| `test/` | pytest; the database tests need `TEST_DATABASE_URL` |

## Endpoints

`POST /api/<name>` with the raw initData in the `X-Telegram-Init-Data` header and the input as JSON. Answers
are `{ ok: true, result }`, or `{ ok: false, type, description, parameters: { code } }` with status 400, 401
(invalid initData), 404 or 500.

| Endpoint | Input | Result |
| --- | --- | --- |
| `me` | `{}` | `user`, `wallet.revives`, `pro`, `pro_until`, `consented`, `invite`, `consent`, `catalogue` |
| `invoice` | `{ sku, consent? }` | `{ url }` for `Telegram.WebApp.openInvoice`; `CONSENT_REQUIRED`, `RATE_LIMITED`, `UNKNOWN_SKU`, `SALES_CLOSED` |
| `spend` | `{ mode }` | takes one revival token: `{ wallet, pro }`; `NO_REVIVES` |
| `streak` | `{ streak, expires_at, write_access? }` | `{ reminder }` (unix seconds or null); `INVALID_INPUT` |
| `gamescore` | `{ session, game, score }` | no initData, the session is the credential: `{ new_best, best, rank, overtaken, leaderboard }`; `INVALID_INPUT`, `SESSION_UNKNOWN`, `SESSION_EXPIRED` |

The `paid` callback of `openInvoice` only refreshes the UI; call `me` again until the `successful_payment` has
been booked. The game reads the endpoints' address from `VITE_TELEGRAM_API_URL`.

## Group leaderboards

Each mode offered in groups is a game at @BotFather whose short name is the mode id (`GAMES` in
`ww3bot/games.py`, matching `GROUP_GAME_ROUTES` in the game's `src/lib/services/telegram.ts`). They are quick
arcade modes whose result sheet shows one score where higher is better, without levels or variants. Register
each once with `/newgame` (title, description, a 640×360 picture) and keep **Allow Groups** on
(`/setjoingroups`). Until a game is registered, `/games` answers that it is not set up yet.

1. In a group, `/games` (or `/start@game_ww3_bot`) shows the menu; a button posts the game with `sendGame`.
   In private chats the game commands point to a group instead, and channels are ignored.
2. Play sends a callback query with `game_short_name`. The bot stores a session (player, chat, message, game,
   valid for a day) and answers with `<appUrl>/play/<game>?game_session=<id>`, which Telegram opens in its game
   browser. That page has no Mini App initData, so the session id (128 random bits, sent only to the player who
   pressed Play) is the credential.
3. The game's result sheet posts the score with the session to `gamescore`. A new best goes to `setGameScore`
   on that message, so Telegram updates that chat's scoreboard and posts the score itself; when it beats someone
   else's record, the bot also posts a record message. The answer names the strongest player the run overtook,
   and the result sheet shows the player's agent rushing past them.

## Setup

1. `python -m venv venv`, then `venv/bin/pip install -r requirements.txt` (on Windows `venv\Scripts\pip`).
2. `cp example.env .env` and set `TELEGRAM` and `DATABASE_URL`. The tables are created on the first start.
3. `cp config.example.json config.local.json` and fill in the operator data (name, postal address, e-mail;
   phone and VAT id are optional). Nothing is sold while it still carries the example data. Put your Telegram
   user id into `adminIds` for `/stats`, `/set_cmd` and payment alerts.
4. `python -m ww3bot` from this folder. It polls for updates and serves the endpoints and legal pages on
   `API_PORT`; that port has to be reachable over HTTPS at the address the game is built with.
5. `TEST_DATABASE_URL=postgresql://… python -m pytest` runs the tests against an empty database.
