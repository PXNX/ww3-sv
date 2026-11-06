# ptb-ww3

The Telegram side of [World War 3](https://github.com/PXNX/ww3-sv) (`@game_ww3_bot`), written for
[Telegram Serverless](https://core.telegram.org/bots/serverless). **Serverless does not work for this bot
yet** (it is still behind a waitlist), so the same handlers run on nyx (see *Run on nyx*):

- **Mini App hosting**: the game's static export (`ww3-sv`, `bun run build:static`) is served at
  `https://app<id>.tgcloud.ai/`, together with the legal pages under `/legal/<page>.html`.
- **Login**: inside Telegram the player is signed in through the Mini App's `initData`, which the
  platform verifies before any endpoint runs. `/start` and `/login` open the game.
- **Payments with Telegram Stars**: a revival token (25 Stars) and World War 3 Pro (250 Stars every
  30 days as a Stars subscription: 10 revival tokens per period, and no adverts once the game has
  them). Goods are granted only on `successful_payment`, once per charge id.
- **No refunds** beyond the statutory rights. Before the first purchase of a terms version the buyer
  consents to immediate delivery and acknowledges losing the right of withdrawal (§ 356 Abs. 4 and 5
  BGB); the consent is stored and repeated in the purchase confirmation sent to the chat.
- **Legal pages for German law**: Impressum (§ 5 DDG), Datenschutzerklärung (DSGVO), AGB and
  Widerrufsbelehrung with the model withdrawal form, as `/impressum`, `/datenschutz`, `/agb`,
  `/widerruf` (aliases `/imprint`, `/privacy`, `/terms`, `/withdrawal`) and as web pages. `/paysupport`
  is the support contact Telegram requires for bots that sell.
- **Group leaderboards** through [Telegram's gaming platform](https://core.telegram.org/bots/games), for now
  Block Puzzle only: added to a group, the bot posts the game with `/games`; Telegram keeps its scoreboard per
  chat and posts every new best there, `/top` lists the group's leaderboard, and the bot announces when
  someone takes the group's record.

## Layout

| Path                         | What it is                                                              |
| ---------------------------- | ----------------------------------------------------------------------- |
| `tgcloud/schema.js`          | SQLite tables: accounts, consents, invoices, purchases, spends, game sessions, group scores |
| `tgcloud/lib/catalogue.js`   | The items and their Stars prices (server-owned)                         |
| `tgcloud/lib/ledger.js`      | Wallet, invoices, idempotent booking and atomic spending                |
| `tgcloud/lib/legal.js`       | Consent wording and version, legal pages as Telegram messages           |
| `tgcloud/lib/texts.js`       | Every bot text, German first and English otherwise (like ptb-words' texts.py) |
| `tgcloud/lib/bot.js`         | Chat flows: start, login, shop, consent, confirmation, support, games and /top |
| `tgcloud/lib/games.js`       | The Telegram games, Play sessions, scores and the groups' leaderboards  |
| `tgcloud/handlers/`          | `message` (commands, `successful_payment`), `callback_query` (incl. Play), `pre_checkout_query`, `my_chat_member` (added to a group) |
| `tgcloud/endpoints/`         | `me`, `invoice`, `spend`, `streak` (Mini App, with initData), `gamescore` (game page, with a session) |
| `legal/*.txt`                | Sources of the legal pages, with `{placeholders}` for the operator data |
| `tgcloud/lib/profile.js`     | Name, descriptions, commands and photo (`res/profile.jpg`), applied by `/set_cmd` |
| `scripts/build.mjs`          | Fills the legal texts, writes `tgcloud/lib/generated.js`, assembles `app/` |
| `runner/`                    | The nyx runner: long polling, local SQLite, and an `sdk` shim on drizzle-orm |
| `res/icon.svg`               | Source of the profile photo (render it to `res/profile.jpg`, 640×640 JPG) |

## Endpoints

| Endpoint | Input                    | Result                                                                    |
| -------- | ------------------------ | ------------------------------------------------------------------------- |
| `me`     | `{}`                     | `user`, `wallet.revives`, `pro`, `pro_until`, `consented`, `consent`, `catalogue` |
| `invoice`| `{ sku, consent? }`      | `{ url }` for `Telegram.WebApp.openInvoice`; `CONSENT_REQUIRED`, `RATE_LIMITED`, `UNKNOWN_SKU` |
| `spend`  | `{ mode }`               | takes one bought revival: `{ wallet, pro }`; `NO_REVIVES`                 |
| `streak` | `{ streak, expires_at, write_access? }` | stores the streak deadline for the reminder: `{ reminder }` (unix seconds or null); `INVALID_INPUT` |
| `gamescore` | `{ session, game, score }` | no initData: the session is the credential. Puts a run onto the scoreboard of the chat the game was opened from: `{ new_best, best, rank }`; `INVALID_INPUT`, `SESSION_UNKNOWN`, `SESSION_EXPIRED` |

The `paid` callback of `openInvoice` only refreshes the UI; call `me` again (a few times) until the
`successful_payment` has been booked.

## Setup

1. In @BotFather: open the bot › **Serverless**, switch it on and copy the **CLI access token**.
2. `npm install`, then `npx tgcloud login` and paste the CLI token (stored in `.tgcloud/`, git-ignored).
3. `cp config.example.json config.local.json` and fill in the operator data (name, postal address,
   e-mail; phone and VAT id are optional). The file is git-ignored; the data only reaches the
   deployed modules and pages.
4. `npm run deploy` (builds the game and pushes), then `npx tgcloud migrate` to create the tables.
5. Put the printed `https://app<id>.tgcloud.ai` into `config.local.json` as `appUrl` and deploy
   again, so buttons and legal links point at it. In @BotFather set it as the Mini App / menu
   button URL, and make it the main Mini App so `https://t.me/game_ww3_bot?startapp` works.
6. Optionally put your Telegram user id into `adminIds` for `/stats` and payment alerts.

## Group leaderboards

Each mode offered in groups is a game at @BotFather whose short name is the mode id (`GAMES` in
`tgcloud/lib/games.js`; for now only `blocks`). Register it once with `/newgame` (title, description,
a 640×360 picture), and keep **Allow Groups** on (`/setjoingroups`). Until a game is registered,
`/games` answers that it is not set up yet.

Games are played together, so only in groups and supergroups. In the private chat `/games`, `/game` and
`/top` point to a group (with a `startgroup` button that adds the bot to one), game and menu buttons outside
a group answer with an alert, and channels are ignored.

1. In a group, `/games` (or `/start@game_ww3_bot`) shows the menu; a button posts the game with `sendGame`.
2. Play sends a `callback_query` with `game_short_name`. The bot stores a session (player, name, language,
   chat, message, game, valid for a day) and answers with `<appUrl>/play/<game>?game_session=<id>`, which
   Telegram opens in its game browser. That page has no Mini App initData, so the session id (128 random
   bits, sent only to the player who pressed Play) is the credential. A t.me `startapp` link does not work
   as the answer: the game browser flashes open and shut instead of starting the Mini App.
3. The game's result sheet posts the score with the session to `gamescore`, which the runner serves
   without the initData check (`openEndpoints` in `runner/api.js`). A new best goes to `setGameScore` on
   that message: Telegram updates the scoreboard of that chat and posts the new score itself. When it beats
   someone else's record, the bot also posts a record message. `/top` and `/top <game>` read the bot's copy.

This only works on nyx for now: Telegram Serverless does not work for the bot yet, and it checks initData
for every endpoint, so `gamescore` will need another way in there.

## Run on nyx

`runner/main.js` long-polls the Bot API and calls the `tgcloud/handlers/` modules, which import
`runner/sdk` as `sdk` (a local package: `db` on bun:sqlite through drizzle-orm, `api` on the Bot API).
It creates missing tables and indexes on start and deletes any webhook, so it must be stopped
before the bot moves to Serverless.

The endpoints are served by `runner/api.js` on port 3790 (`API_PORT`), published publicly through
Tailscale Funnel as `https://mn.tail865185.ts.net:10000/api/<name>`
(`tailscale funnel --bg --https=10000 http://127.0.0.1:3790`). It checks the initData from the
`X-Telegram-Init-Data` header with the bot token like the platform does, allows CORS only for
`API_ORIGINS` (default `https://ww3-sv.vercel.app`), and answers `{ ok, result }` or
`{ ok: false, type, description, parameters }`. The game uses it when `Telegram.WebApp.Serverless`
is missing.

Streak reminders: the game reports its daily-reward streak and deadline to the `streak` endpoint;
a one-minute timer in the runner sends one message two hours before the deadline. Players switch
them off with the button in the message or `/reminders`. On Serverless the timer would need a
scheduled trigger.

```sh
ssh nyx@mn
git clone https://github.com/PXNX/ptb-ww3 ~/projects/ptb-ww3 && cd ~/projects/ptb-ww3
cp example.env .env                     # TELEGRAM=<bot token>
cp config.example.json config.local.json  # operator data; appUrl https://ww3-sv.vercel.app, legalUrl "", adminIds
ln -sf ~/projects/ptb-ww3/ptb-ww3.container ~/.config/containers/systemd/
systemctl --user daemon-reload && systemctl --user start ptb-ww3
```

Updates: push, then `ssh nyx@mn "cd ~/projects/ptb-ww3 && gh repo sync && systemctl --user restart ptb-ww3"`.

On start the runner also refreshes the command menus (English, German, and the admins' own with `/set_cmd` and `/stats`) and the menu button, like ptb-words' `post_init`. It serves the legal pages at `/legal/<page>.html`; set `legalUrl` in `config.local.json` to `https://mn.tail865185.ts.net:10000/legal` so messages and the Mini App link to them.

Sales stay closed (`/buy` answers "Purchases open soon", the invoice endpoint refuses with
`SALES_CLOSED`) until `config.local.json` carries real operator data instead of the example's.
An admin (`adminIds`) sends `/set_cmd` to apply the bot's name, description, info, commands and
profile photo.

## Development

```sh
npm test                 # legal text filling and rendering, and the ledger on the runner's shim
npm run build:bot        # regenerate tgcloud/lib/generated.js without building the game
npx tgcloud run endpoints/me '{}' --ctx '{ initData: { user: { id: 1, first_name: "Test" } } }'
npx tgcloud status       # what differs from the cloud
npx tgcloud webhook      # is the webhook in sync with the handlers?
```

Telegram's [test environment](https://core.telegram.org/bots/webapps#testing-mini-apps) lets you
pay with test Stars.

## Legal review

The legal texts follow the statutory models (Widerrufsbelehrung and the model form from Anlage 1
and 2 zu Art. 246a EGBGB) but are not legal advice; have them checked before taking real money.
Bump `CONSENT_VERSION` in `tgcloud/lib/legal.js` whenever the AGB or the Widerrufsbelehrung change.
