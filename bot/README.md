# World War 3 bot

The Telegram side of World War 3 ([@game_ww3_bot](https://t.me/game_ww3_bot)), written with
[python-telegram-bot](https://python-telegram-bot.org/) and PostgreSQL. It lives in `bot/` of the game's
repository; paths below are relative to `bot/`.

- **Login**: inside Telegram the player is signed in through the Mini App's `initData`, which the bot's
  endpoints verify (HMAC with the bot token) before anything runs. `/start` and `/login` open the game.
- **Payments with Telegram Stars**: a revival token (25 Stars), a pack of five (100 Stars) and World War 3 Pro (250 Stars every 30 days as
  a Stars subscription: 10 revival tokens per period, and no adverts once the game has them), plus looks for the
  player's agent (30–50 Stars each, bought once and kept for good; `look` in the catalogue names the avatar part
  and value). Goods are granted only on `successful_payment`, once per charge id.
- **No refunds** beyond the statutory rights. Before the first purchase the buyer consents once to immediate
  delivery and acknowledges losing the right of withdrawal (§ 356 Abs. 4 and 5 BGB); the consent is stored with
  the version of its wording and repeated in every purchase confirmation sent to the chat.
- **Sales are open** with or without `config.local.json`: `me` always lists the catalogue and `invoice`
  creates a Stars link for any item. The operator data there names the seller on the purchase confirmation
  and on the bot's fallback legal texts; no purchase is gated on it.
- **Legal pages for German law**: Impressum, Datenschutzerklärung, AGB and Widerrufsbelehrung live on the game website at
  `/legal/imprint`, `/legal/privacy`, `/legal/terms` and `/legal/withdrawal`. `/impressum`, `/datenschutz`, `/agb`, `/widerruf`
  (aliases `/imprint`, `/privacy`, `/terms`, `/withdrawal`) link there; until the website has an `appUrl`, the bot sends the German
  texts into the chat instead. `operator.telegram` adds a Telegram contact to `/paysupport`. `/paysupport` is the support contact Telegram requires for bots that sell.
- **Gift codes**: `t.me/game_ww3_bot?start=MN5` (bot chat), `?startapp=MN5` (straight into the Mini App) or MN5 typed in
  the supply depot inside Telegram put 5 revival tokens into the account wallet, once per account (`ww3bot/gifts.py`).
  `PRO6M` grants six calendar months of Pro instead, once per account; in the browser it points players to Telegram.
- **Invites and streak reminders**: `/invite` links earn revival tokens, and the game reports its daily streak so
  the bot can remind two hours before it breaks (`/reminders` to switch).
- **Inline game search**: typing `@game_ww3_bot games Flamingo` (or just the name) in any chat offers the
  matching games. In a group the result posts a Telegram game with that chat's scoreboard; elsewhere it
  posts a button that opens the game as a Mini App. Enable inline mode with `/setinline` at @BotFather.
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
| `ww3bot/games.py` | The Telegram games, inline search, Play sessions, scores and the groups' leaderboards |
| `ww3bot/inline.py` | Inline mode: search results for a chat, either a Telegram game or a Mini App button |
| `ww3bot/ledger.py`, `ww3bot/catalogue.py` | Accounts, consent, invoices, purchases, the revival wallet; items and Stars prices |
| `ww3bot/referrals.py`, `ww3bot/reminders.py` | Invite rewards; streak reminders |
| `ww3bot/ads.py` | House adverts: fetches the litfass feed (`LITFASS_FEED_URL` in `.env`) and forwards the counts, so browsers never contact the advert server |
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
| `me` | `{}` | `user`, `wallet.revives`, `pro`, `pro_until`, `consented`, `invite`, `consent`, `catalogue`, `owned` (skus of the looks bought) |
| `invoice` | `{ sku, consent? }` | `{ url }` for `Telegram.WebApp.openInvoice`; `CONSENT_REQUIRED`, `RATE_LIMITED`, `UNKNOWN_SKU`, `ALREADY_OWNED` |
| `spend` | `{ mode }` | takes one revival token: `{ wallet, pro }`; `NO_REVIVES` |
| `redeem` | `{ code }` | `{ status: ok \| used, revives, wallet }`; `UNKNOWN_GIFT` |
| `streak` | `{ streak, expires_at, write_access? }` | `{ reminder }` (unix seconds or null); `INVALID_INPUT` |
| `gamescore` | `{ session, game, score }` | no initData, the session is the credential: `{ new_best, best, rank, overtaken, leaderboard }`; `INVALID_INPUT`, `SESSION_UNKNOWN`, `SESSION_EXPIRED` |
| `ads` | `{}`, no initData | the house adverts (`{ version, ads }`, litfass feed format without images); empty without `LITFASS_FEED_URL` |
| `adevent` | `{ events: [{ ad, event }] }`, no initData | forwards up to 20 `view`/`click`/`reward` counts: `{ counted }` |

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
3. The game's result sheet posts the score with the session to `gamescore`. The player's best goes to
   `setGameScore` on the message they played from, so Telegram shows it on that message's scoreboard and posts
   a new best itself; when it beats someone else's record, the bot also posts a record message. Telegram's
   scoreboards belong to single messages, so the `leaderboard` in the answer comes from the bests the bot keeps
   across all of the chat's game messages: everyone up to ten players, otherwise the top three and the player
   with two neighbours on each side. The answer also names the strongest player the run overtook, and the
   result sheet shows the player's agent rushing past them.

## Setup

1. `python -m venv venv`, then `venv/bin/pip install -r requirements.txt` (on Windows `venv\Scripts\pip`).
2. `cp example.env .env` and set `TELEGRAM` and `DATABASE_URL`. The tables are created on the first start.
3. `cp config.example.json config.local.json` and fill in the operator data (name, postal address, e-mail;
   phone and VAT id are optional) so the purchase confirmation and the fallback legal texts name the real
   seller; `appUrl` has to match the deployed website, since the legal links point there. Put your Telegram
   user id into `adminIds` for `/stats`, `/set_cmd` and payment alerts.
4. At @BotFather, send `/setinline` and pick the bot to turn inline mode on; no code change is needed.
5. `python -m ww3bot` from this folder. It polls for updates and serves the endpoints on `API_PORT`;
   that port has to be reachable over HTTPS at the address the game is built with. The legal links in the
   bot point at `appUrl`, so the website has to be deployed for them to resolve.
6. `TEST_DATABASE_URL=postgresql://… python -m pytest` runs the tests against an empty database.
