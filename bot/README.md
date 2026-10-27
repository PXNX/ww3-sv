# ptb-ww3

The Telegram side of [World War 3](https://github.com/PXNX/ww3-sv) (`@game_ww3_bot`), running on
[Telegram Serverless](https://core.telegram.org/bots/serverless) instead of a polling bot on nyx:

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

## Layout

| Path                         | What it is                                                              |
| ---------------------------- | ----------------------------------------------------------------------- |
| `tgcloud/schema.js`          | SQLite tables: accounts, consents, invoices, purchases, spends          |
| `tgcloud/lib/catalogue.js`   | The items and their Stars prices (server-owned)                         |
| `tgcloud/lib/ledger.js`      | Wallet, invoices, idempotent booking and atomic spending                |
| `tgcloud/lib/legal.js`       | Consent wording and version, legal pages as Telegram messages           |
| `tgcloud/lib/bot.js`         | Chat flows: start, login, shop, consent, confirmation, support          |
| `tgcloud/handlers/`          | `message` (commands, `successful_payment`), `callback_query`, `pre_checkout_query` |
| `tgcloud/endpoints/`         | `me`, `invoice`, `spend`, called by the Mini App via `Telegram.WebApp.Serverless.call` |
| `legal/*.txt`                | Sources of the legal pages, with `{placeholders}` for the operator data |
| `scripts/build.mjs`          | Fills the legal texts, writes `tgcloud/lib/generated.js`, assembles `app/` |

## Endpoints

| Endpoint | Input                    | Result                                                                    |
| -------- | ------------------------ | ------------------------------------------------------------------------- |
| `me`     | `{}`                     | `user`, `wallet.revives`, `pro`, `pro_until`, `consented`, `consent`, `catalogue` |
| `invoice`| `{ sku, consent? }`      | `{ url }` for `Telegram.WebApp.openInvoice`; `CONSENT_REQUIRED`, `RATE_LIMITED`, `UNKNOWN_SKU` |
| `spend`  | `{ mode }`               | takes one bought revival: `{ wallet, pro }`; `NO_REVIVES`                 |

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

## Development

```sh
npm test                 # legal text filling and rendering
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
