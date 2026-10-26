# Improvements: engagement, retention and monetization

This document collects the ideas behind the career layer that now sits above the games, the parts
that are already built, and the backlog for making the collection more engaging and eventually
worth paying for. It is a working list, not a promise: prices, rewards and priorities will move once
there are real players and real numbers.

The guiding rule is simple: **the games stay playable without paying**. Money buys convenience,
cosmetics and extra attempts, never a better score, a hidden advantage or a reason to keep a
frustrating run alive against the player's will.

---

## 1. What is implemented now

### 1.1 The career layer

A single profile is shared by every game, stored in local storage under `career:profile`. It is
plain data with pure rules, so it can be tested without a browser and later moved to a server
without rewriting the game code.

- **Runs pay out automatically.** Every mode that uses the shared result sheet banks coins and XP
  when the sheet opens. This covers 28 of the 35 modes; the excluded modes are listed in
  section 1.7.
- **The reward has a predictable base and a small score bonus.** A run pays 5 coins and 25 XP, plus
  3 coins and 10 XP for a win, 8 coins and 20 XP for a new personal best, 8 coins and 15 XP for the
  first play of a mode, and a logarithmic score bonus (at most 15 coins and 40 XP). Small-score and
  large-score games are therefore worth comparable amounts.
- **Daily soft caps** stop farming the easiest game: at most 150 coins and 800 XP per day from
  runs. The challenge bonus and level-up coins are outside the cap.
- **A duplicate guard** ignores the same result sheet being re-mounted within five seconds, so a
  refresh or an animation does not pay twice.
- **XP becomes levels and ranks.** The first level needs 100 XP, each later level 50 XP more, up to
  level 40. Eight ranks run from Intern to Crisis survivor. Each level pays 25 coins, and every
  third level pays one revival token.
- **The result sheet shows the breakdown** (coins, XP, level-up, challenge, cap reached) and links
  straight to the next game.
- **The start screen shows the career strip:** rank, level, XP bar, coin and revival wallets, how
  many career games have been played, and a shortcut to the supply depot.

### 1.2 Daily login streak

A seven-day track pays 10, 15, 20 + 1 revival, 25, 35, 50 and 100 + 1 revival coins. Missing a day
resets the streak to day one. The start screen shows the track, the current slot, the effective
streak and a countdown to the next local midnight. The panel refreshes on a 30-second tick and
immediately when the tab becomes visible again.

### 1.3 Daily challenge

One mode is featured per local day and is the same for everyone on that day (seeded by the date).
Finishing one run there with a score above zero pays 60 coins, 100 XP and a revival token, and
doubles the run's own coins. The challenge is paid once a day and is not taken from the run cap.
The start screen shows the mode, the goal and a direct play link; the result sheet confirms the
bonus.

### 1.4 Revival tokens

A crashed run can be continued in the four modes that already support revivals (Convoy Runner,
Flamingo Flight, Radar Slice, Run Comrade). A token is spent before the game's own revive callback
runs, so a token cannot be consumed without the run actually continuing. When the wallet is empty,
the result sheet links to the supply depot instead of pretending the run can be saved.

### 1.5 Supply depot (`/shop`)

- Revivals cost 120 coins each, or five for 450 coins.
- A demo sponsor break pays 10 coins and can be watched five times a day. The advert is clearly
  labelled as a demo, lasts five seconds and makes no network request.
- The real-money shelves (coin packs and a monthly Pro pass paid with Telegram Stars) are visible
  but disabled and marked "coming soon". The page says that nothing there costs real money yet.
- Purchases show an immediate balance update and a status message; unaffordable buttons are
  disabled rather than failing silently.

### 1.6 Start screen and game grid

- The career strip and the daily panel sit above the game grid.
- **Recent games** appear as one-tap chips so a player can continue where they stopped.
- **Surprise me** opens a random playable game.
- **Personal best badges** appear on cards once a mode has a score above zero.
- The footer links to the supply depot and the About page.

### 1.7 Tuning constants

All numbers live in `src/lib/game/career/config.ts` and can be retuned without touching the UI.

| Constant                  | Value                                           |
| ------------------------- | ----------------------------------------------- |
| Starting coins / revivals | 60 / 2                                          |
| Run base                  | 5 coins, 25 XP                                  |
| Win bonus                 | 3 coins, 10 XP                                  |
| New best bonus            | 8 coins, 20 XP                                  |
| First-play bonus          | 8 coins, 15 XP                                  |
| Score bonus               | up to 15 coins, up to 40 XP                     |
| Run cap                   | 150 coins, 800 XP per day                       |
| Challenge                 | 60 coins, 100 XP, 1 revival, doubles run coins  |
| Streak track              | 10, 15, 20 + revival, 25, 35, 50, 100 + revival |
| Revival                   | 120 coins (5 for 450)                           |
| Sponsor break             | 10 coins, 5 per day                             |
| Level curve               | 100 + 50 × (level − 1) XP, max level 40         |
| Level reward              | 25 coins, +1 revival every 3 levels             |

### 1.8 Mode coverage

The career layer currently covers every mode that ends through the shared
`GameOverModal.svelte`: Blocks, Minefield, Convoy Runner, Merge, Shootdown, Pipeline, Flamingo
Flight, Fury, Chess, Drone Wall, Radar Slice, Whack, Run Comrade, Purr Pentagram, Energiewende,
Centrifuge, Venezuela, Sondage, Suez, Chip Fab, Vault, Veto, Balloon, Dome, GPS Liar, Leak Patrol,
Maple Reserve Heist and Rare Earth.

Not covered yet, each for a specific reason:

| Mode                       | Why not                                                     | What it needs                                                   |
| -------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------- |
| Belt & Road, Maze, Parking | Own win panels; lower-is-better scores (steps, moves, debt) | A run-reward hook with a "lower is better" best-score rule      |
| Oil Tycoon                 | Endless idle economy with its own currency and prestige     | An explicit cash-out or milestone payout into the shared wallet |
| Wordle                     | Daily puzzle with its own streak and stats                  | A once-a-day bonus, not a per-run payout                        |
| Raid                       | Own season, crystals, daily quests and result screen        | Deliberate economy merge or a crystal-to-coin exchange          |
| Fleet Hunt                 | Persistent multi-day hunt with points and daily ammo        | Reward sunk ships or add a shared-points wallet                 |

---

## 2. Engagement: making the next minute better

### 2.1 Immediate feedback

- [x] Show coins, XP and level-up directly on the result sheet.
- [x] Show challenge completion and the daily cap on the result sheet.
- [x] Show the best score on the start-screen card.
- [x] Add a visible countdown and a chime when the daily reward is ready.
- [ ] Animate coins flying from the score into the wallet; keep it short and skippable.
- [ ] Add a subtle "one more run" nudge on the result sheet when the next level is close.
- [ ] Show progress towards the next personal best inside a run ("12 points to your best").
- [ ] Add near-miss feedback ("2 points short of your best") with a retry button.
- [ ] Add a short "run summary" card after each game: best, plays, rank progress.
- [ ] Make the revive decision clearer: what is at stake, how many tokens are left, what happens
      without one.

### 2.2 Goals and achievements

- [ ] **Per-mode achievements**: first play, first win, 10/100 plays, a score milestone, a
      no-damage run, a speed run, a comeback win.
- [ ] **Career achievements**: reach each rank, play every career mode, collect all daily track
      slots, finish 7 challenges in a row, spend the first 1,000 coins.
- [ ] **Badges** on the start-screen cards for achievements and best scores.
- [ ] **A career stats page**: total runs, time played, favourite mode, best streak, coins earned,
      revivals used, challenge history.
- [ ] **A collection album**: one sticker per mode, with a short joke description, unlocked by
      playing; a completed album pays a one-off reward.
- [ ] **Weekly quests** alongside the daily challenge: "finish 5 runs", "win in 3 different
      modes", "collect 3 daily rewards". Weekly rewards are bigger and reset on Monday.
- [ ] **Milestone chests** at levels 5, 10, 20 and 40 with coins, revivals and a cosmetic.
- [ ] **Streak repair**: one missed day can be repaired with coins or a demo advert, once a month.
- [ ] **Long-term prestige**: after level 40, keep earning a cosmetic rank or a prestige badge
      instead of stopping the XP bar dead.

### 2.3 Variety and discovery

- [x] Recent-game chips.
- [x] Random "Surprise me" button.
- [ ] A "daily mix" of three recommended modes, weighted by what the player has not tried.
- [ ] "Try something new" bonus: the first play of each mode pays extra (already in the reward,
      but the UI does not advertise it yet).
- [ ] A rotating "mode of the week" with a small multiplier.
- [ ] Cross-mode events: "this weekend, all naval games pay double coins".
- [ ] Seasonal themes for the start screen and result sheet (winter, election season, etc.).
- [ ] A short narrative campaign that strings modes together with a shared joke and unlocks.
- [ ] Boss-rush or gauntlet events that combine three modes in one session.
- [ ] Endless and daily-seed variants for the modes that support them.
- [ ] Ghost runs: race a recorded best run in the runner and arcade modes.
- [ ] Daily seed sharing: everybody gets the same spawn pattern on a given day.

### 2.4 Social and competitive

- [ ] Local leaderboards per mode (top 10 scores on the device).
- [ ] Friend codes and shareable challenge links.
- [ ] Weekly global leaderboards once there is a backend; show a player's percentile rather than
      only the top 100.
- [ ] Asynchronous duels: both players get the same seed and compare scores.
- [ ] Share cards that include career rank, streak and best score (the ShareButton already draws a
      score card; extend it).
- [ ] Telegram share messages with a deep link back into the same daily challenge.
- [ ] Clans or teams later; only if the player base supports it.

### 2.5 Feel and accessibility

- [ ] Haptic feedback on coins, level-ups and revives (where supported).
- [ ] Respect `prefers-reduced-motion` in every new animation (the sticker and pop-in styles
      already do).
- [ ] Larger tap targets and a high-contrast mode for the career chips.
- [ ] Full RTL review of the career strip, daily panel, shop and result sheet.
- [ ] Screen-reader labels for the XP bar, streak track and wallet, with live-region announcements
      for rewards.
- [ ] Keyboard and switch-access path through the result sheet and shop.
- [ ] Colour-blind-safe states: do not rely on red/green alone for affordable/unaffordable.
- [ ] Test the long German, Russian, Ukrainian, Persian and Arabic strings on a 390 px screen.

---

## 3. Retention: giving a reason to come back

### 3.1 Daily and weekly habits

- [x] Seven-day login track with escalating rewards.
- [x] One daily challenge per day.
- [ ] Weekly quests and a weekly chest.
- [ ] A monthly calendar with a bigger reward on the last day.
- [ ] Streak milestones at 7, 14, 30 and 100 days with permanent badges.
- [ ] Streak repair (see 2.2).
- [ ] A gentle reminder: "Your streak ends in 6 hours" via the Telegram bot or a local
      notification, opt-in only.
- [ ] "Comeback" rewards after a break: a small welcome-back bonus and a summary of what changed.
- [ ] Keep the daily reset local-midnight for now, but make the rule explicit in the UI; move to a
      server-authoritative day once accounts exist.

### 3.2 Progression that lasts

- [ ] More ranks and cosmetic titles beyond level 40.
- [ ] Mode mastery levels: each mode has its own small XP bar and unlocks a badge or a cosmetic.
- [ ] Unlockable characters, card backs, board themes and music tracks.
- [ ] A career "office" that visibly improves with rank (a joke version of the AMETRAS office).
- [ ] Collection completion rewards.
- [ ] Seasonal reset of a small side-track while lifetime XP stays permanent.
- [ ] Personal records per mode, per difficulty and per seed.

### 3.3 Content cadence

- [ ] One new mode or variant per month while the backlog lasts (see `todo.md`).
- [ ] Seasonal events with a temporary mode modifier.
- [ ] Rotating shop cosmetics; no gameplay advantage.
- [ ] Community challenges with a shared goal ("players finish 10,000 runs this week").
- [ ] A public changelog and "what's new" sheet after an update.
- [ ] Revisit the game balance of the modes that were only tested with bots.

### 3.4 Bringing players back

- [ ] PWA install prompt already exists; add "add to home screen" guidance after the first run.
- [ ] Offline play already works through the service worker; make it visible ("you can play
      offline").
- [ ] Telegram Mini App entry point with the same save state.
- [ ] Deep links to a specific daily challenge.
- [ ] A "continue where you left off" row (recent chips are the first step).
- [ ] Push or bot messages only with explicit consent, with a clear off switch.

---

## 4. Monetization: what people could pay for

### 4.1 Principles

- No pay-to-win: coins buy attempts, convenience and cosmetics, not score multipliers that make
  leaderboards meaningless.
- No surprise spending: every price is visible before a tap, and real-money purchases are always
  confirmed.
- No dark patterns: no fake countdowns, no "your friend is winning" pressure, no hidden
  auto-renewal.
- Spending limits and an age gate before real money is enabled.
- The game remains fully playable with the free coin flow and demo adverts.

### 4.2 Rewarded adverts (real)

- [x] Demo advert with a five-second countdown and a hard daily cap of five.
- [ ] Integrate a real rewarded-ad SDK or Telegram Ads where available.
- [ ] Keep the cap (5 per day) and add a cooldown between adverts.
- [ ] Pay a fixed, predictable amount; never make the reward random.
- [ ] Add consent and a clear "why am I seeing this?" note.
- [ ] Never show an advert in the middle of a run; only on the result sheet or in the shop.
- [ ] Add an "ad-free" state for Pro and for a one-time purchase.
- [ ] Measure opt-in rate and completion rate, not only revenue.

### 4.3 Telegram Stars

The concrete build design — identity, endpoints, schema, testing and rollout — is in section
4.8. The short version: Stars need a bot, a verified Mini App identity, a webhook and a Postgres
ledger, so this is a small backend project rather than a client-only change.

- [ ] Coin packs: 500 / 50 Stars, 1,200 / 100 Stars, 3,000 / 200 Stars (placeholder pricing).
- [ ] A single revival for Stars as an impulse purchase on the result sheet, clearly optional.
- [ ] A starter pack: coins, revivals and one cosmetic at a discount, once per account.
- [ ] Server-side invoice creation and payment validation through the Telegram bot.
- [ ] Entitlements stored server-side, not only in local storage.
- [ ] Handle refunds, chargebacks, duplicate receipts and expired invoices.
- [ ] Show the Stars price and the coin amount together; no invented exchange rate.
- [ ] Regional pricing and a minimum-age check where required.

### 4.4 Monthly Pro

- [ ] Paid with Telegram Stars, cancel-anytime, with a clear renewal date.
- [ ] Benefits: no adverts, double daily login reward, 10 revival tokens per month, one exclusive
      cosmetic per season.
- [ ] Do not lock modes or scores behind Pro.
- [ ] A free trial of 3 days, once per account.
- [ ] Grace period and a clear "what happens when it ends" screen.
- [ ] A "restore purchase" path for reinstalls and new devices.

### 4.5 Other paid offers

- [ ] **Remove ads forever** (one-time purchase).
- [ ] **Cosmetic shop**: character outfits, card backs, result-sheet stickers, start-screen themes.
- [ ] **Season pass** with a free and a paid track; the paid track is cosmetics and coins, never
      score power.
- [ ] **Revival bundles** with a visible per-token price.
- [ ] **Daily deal**: one discounted item, deterministic rotation, no fake urgency.
- [ ] **Gift a friend**: send a coin pack or a revival through Telegram.
- [ ] **Founder pack** for the first release: a badge, a cosmetic and coins, limited by time, not
      by a fake counter.
- [ ] **Support the developers** tip jar with no reward; some players prefer this.
- [ ] Avoid loot boxes and other randomized paid rewards unless legal review says otherwise.

### 4.6 Economy and sinks

- [ ] Watch the coin faucet: runs, streaks, challenges, adverts and level-ups all pay.
- [ ] Add meaningful sinks: revivals, cosmetics, streak repair, entry fees for special events,
      collection rerolls.
- [ ] Keep the starting balance generous enough to try a revival once.
- [ ] Add a coin-to-XP conversion only if it does not break the level curve.
- [ ] Publish the drop and price rules in-game; trust is part of retention.
- [ ] Review the caps monthly with real data; do not let the game feel like a second job.

### 4.7 Payment and account infrastructure (prerequisite)

- [ ] Telegram login through a bot.
- [ ] Server-side accounts and cloud saves.
- [ ] A payments table with receipts, entitlements and refund state.
- [ ] A feature flag for every paid surface, off by default in development.
- [ ] A test mode with fake Stars.
- [ ] Legal pages: terms, privacy, imprint, refund policy, age notice.
- [ ] Data export and account deletion.
- [ ] Fraud and anti-cheat checks on coin grants and scores.

### 4.8 Telegram Stars: build design

Recorded as the concrete plan behind section 4.3, so the next person does not have to rediscover the
constraints. Sources: [Telegram Stars](https://core.telegram.org/bots/payments-stars) and the
[Bot API payments section](https://core.telegram.org/bots/api#payments). The shop keeps its disabled
Stars shelf until the phases in 4.8.10 are done.

#### 4.8.1 Three constraints that shape everything

1. An invoice is created by a **bot** through the Bot API and can only be paid **inside a Telegram
   client**. A normal browser session can never complete a Stars payment.
2. Digital goods sold inside Telegram must use Stars, currency `XTR`, with an **empty**
   `provider_token`. App-store rules make other providers non-compliant inside the apps.
3. Goods are delivered only on the bot's `successful_payment` update. The client's
   `openInvoice` callback reports what the UI did, not what Telegram charged.

So the work needs a public server, a webhook and durable storage. The existing Vercel adapter
already deploys serverless functions; the bot, database and account identity are the new pieces.

#### 4.8.2 Identity before payments

- The Mini App reads `Telegram.WebApp.initData` at launch and sends it to our server.
- The server validates it: split the query string, build `data_check_string` from every field except
  `hash` (sorted by key, `key=value` joined with newlines), and compare against
  `HMAC_SHA256(key = HMAC_SHA256("WebAppData", bot_token), data_check_string)`. Reject an
  `auth_date` older than a few minutes. Third-party validators should check the Ed25519
  `signature` against Telegram's published key instead.
- The verified `user.id` becomes the account key. It is never accepted from a request body, a query
  parameter or local storage.
- Treat `initData` as a short-lived bearer token: do not log it, store it or put it in analytics.
- A browser session has no verified identity. The start screen, local career profile and demo shop
  keep working there; the Stars shelf stays hidden or disabled.

#### 4.8.3 Payment flow and endpoint contract

| Step | Who      | Call                                              | Notes                                                       |
| ---- | -------- | ------------------------------------------------- | ----------------------------------------------------------- |
| 1    | Shop     | `GET /api/stars/me` (initData)                    | account, wallet, entitlements, server catalogue             |
| 2    | Shop     | `POST /api/stars/invoice` `{ initData, sku }`     | server looks up the price, never trusts a client amount     |
| 3    | Player   | `Telegram.WebApp.openInvoice(url, cb)`            | status `paid`, `cancelled`, `failed` or `pending`           |
| 4    | Shop     | `GET /api/stars/me` after `paid`                  | poll a few times; the webhook can arrive after the callback |
| 5    | Telegram | `POST /api/telegram/webhook` `pre_checkout_query` | answer within 10 seconds                                    |
| 6    | Telegram | `POST /api/telegram/webhook` `successful_payment` | insert once, then grant in a transaction                    |

Details that are easy to get wrong:

- `createInvoiceLink` gets `currency: "XTR"`, a price array in whole Stars, `title`, `description`,
  and a `payload` such as `sku:userId:nonce` signed with a server-only HMAC and a short expiry.
  The payload is what binds an invoice to one account and one sku.
- The webhook is configured with `setWebhook` and a `secret_token`; every request must carry the
  matching `X-Telegram-Bot-Api-Secret-Token` header. Return 200 quickly and process idempotently.
- On `successful_payment`, verify `currency`, `total_amount` and `invoice_payload` against the sku,
  then insert a purchase keyed by the unique `telegram_payment_charge_id`. A duplicate delivery
  hits the unique constraint and grants nothing. Store `provider_payment_charge_id` as well.
- The `paid` callback only refreshes the UI. It must never unlock coins by itself.
- A handler that takes longer than 10 seconds for `pre_checkout_query` cancels the order; check the
  sku and signature locally instead of calling another service in that window.
- Return 200 even for updates we ignore, so Telegram does not retry forever.

#### 4.8.4 Catalogue, owned by the server

| SKU            | Grant                                 | Placeholder price | Notes                                         |
| -------------- | ------------------------------------- | ----------------- | --------------------------------------------- |
| `revive_1`     | 1 revival                             | 25 Stars          | impulse purchase on the result sheet, one tap |
| `coins_500`    | 500 coins                             | 50 Stars          |                                               |
| `coins_1200`   | 1,200 coins                           | 100 Stars         |                                               |
| `starter_once` | 1,000 coins, 5 revivals, one cosmetic | 150 Stars         | once per account, not a fake countdown        |
| `pro_30d`      | Pro for 30 days                       | 250 Stars         | Stars subscription                            |
| `remove_ads`   | no adverts forever                    | 300 Stars         | only once real adverts exist                  |

Rules: prices are whole Stars; the client shows the exact amount and the exact grant returned by the
server; no invented Stars-to-euro rate; no fake discount; every SKU has a stable id and an
idempotent grant.

#### 4.8.5 Storage sketch (Postgres)

Neon Postgres through the Vercel marketplace is the working choice: a money ledger wants
transactions and unique constraints, not a key-value store.

```sql
create table accounts (
	telegram_user_id bigint primary key,
	username text,
	first_seen_at timestamptz not null default now(),
	pro_until timestamptz
);

create table purchases (
	charge_id text primary key, -- telegram_payment_charge_id, the idempotency key
	telegram_user_id bigint not null references accounts,
	sku text not null,
	stars integer not null,
	payload text not null,
	refunded_at timestamptz,
	created_at timestamptz not null default now()
);

create table coin_ledger (
	id bigint generated always as identity primary key,
	telegram_user_id bigint not null references accounts,
	delta integer not null,
	reason text not null, -- stars:coins_500, refund, starter
	charge_id text references purchases,
	created_at timestamptz not null default now()
);
```

Revival grants get their own ledger table (or a `kind` column), and subscriptions get
`pro_until`, the last charge id and the current period. Balances are sums over the ledgers; a cached
balance column is optional and must be updated in the same transaction.

#### 4.8.6 What the server owns

- Today the career profile lives in local storage. Earned coins and XP are fine there, but anything
  bought is forgeable: a local grant can be replayed by resetting storage.
- The MVP should keep **purchased** coins, revivals and Pro on the server and let the client mirror
  them. Spending a purchased revival must be reported to the server (`POST /api/stars/spend`, or a
  server decrement before the game revives), otherwise one purchase can be used twice.
- The simpler alternative — grant bought coins into the local profile once — is acceptable only
  while nothing of value is at stake; document that it is cheat-prone and revisit before
  leaderboards.
- Run rewards, daily caps and scores stay client-side for now. A server economy eventually needs
  server-validated results; that is a separate project (section 6.1).
- On the first verified session, import the local profile once for convenience, marked as
  client-supplied and never trusted for purchases.

#### 4.8.7 Monthly Pro

- A 30-day Stars subscription: `subscription_period: 2592000`, the only period Stars subscriptions
  support.
- On `successful_payment`, store `pro_until` from `subscription_expiration_date`; every renewal
  extends it. Check `pro_until > now()` on the server when granting ad-free or the monthly revive
  allowance.
- The 10 monthly revivals are granted once per subscription period in a ledger row, not stacked and
  not banked indefinitely.
- "Restore purchase" is just `GET /api/stars/me` after initData verification; there is no client
  receipt to trust.
- Stars subscriptions have no trial parameter. A 3-day trial has to be a separate one-off
  entitlement with a follow-up offer, not an auto-charging trial.
- Cancellation happens in Telegram. The shop shows the paid-until date and that access lasts until
  then; it does not pretend to cancel from our side.
- Modes, scores and leaderboards stay outside Pro (section 4.4).

#### 4.8.8 Security, compliance and support

- Bot token only in server environment variables, never in the bundle; rotate it if it leaks.
- Validate the webhook secret header, the signed invoice payload, the user id, the sku and the
  amount on every path. Rate-limit invoice creation per user.
- Refunds use `refundStarPayment(user_id, telegram_payment_charge_id)` and then a ledger reversal.
  Keep the purchase row, mark it refunded and revoke the entitlement; never delete history.
- The bot needs `/terms` and `/paysupport`. The shop needs Terms, privacy, imprint, refund policy
  and an age notice before real money is enabled.
- Telegram requires the seller to handle disputes itself; Telegram support does not mediate bot
  purchases. Stars revenue is paid out through Telegram's own star balance and holding period, and
  tax/legal-entity questions are the operator's, not the code's.
- Never offer Stars outside Telegram; never show a self-invented Stars price in another currency.
- Add spending limits and, where required, an age gate; keep the game fully playable without any
  purchase (section 4.1).

#### 4.8.9 Testing and local development

- Telegram can test Stars in its dedicated test environment with a test bot, so the flow is
  exercisable without real money.
- `TELEGRAM_MOCK=1` for local development: a dev bot token, a test `initData` signer, an injected
  fake Bot API and webhook fixtures. Nothing in the mock path may be enabled in production.
- Tests that matter: invalid hash, stale `auth_date`, wrong amount, wrong sku, duplicate webhook
  delivery, refund reversal, subscription renewal, expired payload, unknown user, missing header.
- Pure parts (payload signing, catalogue lookup, ledger grants, expiry) belong in unit tests next to
  `src/lib/game/career/`; the webhook gets integration tests against the mock.
- Manual checklist: browser (no Stars UI), Mini App test payment, cancel an invoice, deliver the
  same update twice, refund, expire initData, second device.

#### 4.8.10 Rollout phases

| Phase | Work                                                                                   | Done when                                                                         |
| ----- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 1     | Bot, Mini App entry, env vars, initData verification, `GET /api/stars/me`              | a Mini App session resolves to one verified account; invalid initData is rejected |
| 2     | Postgres schema, ledgers, account import, wallet in `/api/stars/me`                    | a simulated purchase survives a redeploy and sums correctly                       |
| 3     | Server catalogue, `POST /api/stars/invoice`, Stars shelf in the shop, test environment | a test Stars invoice opens and pays                                               |
| 4     | Webhook with `pre_checkout_query` and `successful_payment`, grants, mock mode          | a paid SKU lands exactly once, including a duplicate delivery                     |
| 5     | Pro subscription, refunds, `/terms`, `/paysupport`, limits, go-live review             | a refund revokes the grant and the go-live checklist is signed off                |

Phases 1 to 4 are the bulk of the work; 5 is smaller in code but needs legal copy and a support
process. Roughly two to three days of engineering plus about a day of operations and copy, with no
redesign of the games.

#### 4.8.11 Decisions still open

- Database provider, and whether adding a driver is acceptable in a repo with no runtime
  dependencies today.
- Server-owned wallet from day one (recommended) or a local grant for speed.
- Whether Pro includes revivals at all; section 4.4 says yes, which weakens the revival sink.
- Stars price points, and whether a single revival is sold at all.
- Who operates the bot, owns the Telegram account, handles refunds and taxes.
- Whether browser players can ever pay. They cannot with Stars; that would need another provider
  and must respect the store rules.

#### 4.8.12 What already exists in the repo

- `/shop` with the disabled Stars shelf and clear "coming soon" copy (section 1.5).
- Career rules isolated in `src/lib/game/career/`, so a server wallet can replace the local one
  without touching the 28 modes.
- Vercel adapter with serverless output; hosting a webhook and API routes is solved.
- Root `prerender = true` and `ssr = false`: every API route must set `export const prerender = false`
  and must not be crawlable as a page.
- No database client, bot token, webhook, `/terms` or `/paysupport` yet.

---

## 5. Content and growth

Per-game depth ideas for the 35 existing games are in section 9; this section is about new modes and
content around them.

- [ ] Finish the modes already planned in `todo.md` (Iceberg Curling, Starlink Kill Switch,
      Hermit Hackers, Gig Saboteur, Shadow Fleet Shuffle and the backlog 3.16 list).
- [ ] Add more modes for under-represented countries and leaders.
- [ ] Native-speaker review for fa, ar, ru and uk, especially jokes and word lists.
- [ ] A proper About page with credits, privacy note, version and changelog.
- [ ] A "how the career works" help sheet, reachable from the career strip.
- [ ] SEO pages for every mode (already generated) plus a shop page and an about page; add
      structured data for the game collection.
- [ ] A lightweight landing page for Telegram and social previews.
- [ ] Share cards with rank, streak and a mode-specific joke.
- [ ] A public roadmap and a way to vote on the next mode.
- [ ] Creator/streamer mode: big score, no personal data, safe-for-work language toggle.
- [ ] A referral link that grants both sides a small coin bonus, capped against abuse.
- [ ] Localised store listings and screenshots.

---

## 6. Technical foundation

### 6.1 Data and sync

- [x] Versioned local profile with validation and a safe fallback.
- [ ] Profile migrations when the schema changes; never wipe a save silently.
- [ ] Cloud save with conflict resolution (last write wins is not enough for two devices).
- [ ] A server-authoritative daily reset and challenge seed.
- [ ] Offline queue for coin grants and purchases, replayed when online.
- [ ] Export/import the profile as a file for support and backups.

### 6.2 Analytics and experiments

- [ ] Privacy-friendly event tracking: run start/end, revive offer, revive use, daily claim,
      challenge complete, shop view, ad opt-in, purchase.
- [ ] Funnels: first run → first result → second run; shop view → purchase.
- [ ] Retention cohorts (D1, D7, D30), sessions per day, runs per session.
- [ ] Economy dashboard: faucet, sink, balance distribution, cap hits.
- [ ] A/B tests for reward sizes, prices and copy, with a pre-registered success metric.
- [ ] Crash and error reporting.
- [ ] A consent banner or a clear local-only analytics statement.
- [ ] Never send personal data or free-text input to analytics.

### 6.3 Quality

- [ ] Playwright or browser smoke tests for the start screen, one full run, the shop and the daily
      claim.
- [ ] Unit tests for every career rule (already started in `profile.test.ts`).
- [ ] Test the profile with old, corrupt and partial saves.
- [ ] Test midnight rollover with a mocked clock.
- [ ] Test RTL and the six locales at phone and desktop widths.
- [ ] Test the service worker with the new routes.
- [ ] Measure bundle size after adding icons and modals.
- [ ] Battery and frame-time check on mid-range phones.

### 6.4 Architecture

- [ ] Keep pure rules in `src/lib/game/career/` and UI in components; do not put economy logic in
      pages.
- [ ] One shared result-sheet hook is better than 28 copies; the current `GameOverModal` approach
      already does this.
- [ ] Add a small `CareerAward` helper for the modes with custom win panels.
- [ ] Consider a single `economy` module if Tycoon, Raid and Fleet Hunt are merged later.
- [ ] Document every storage key and its migration path in one place.
- [ ] Keep the shop and result sheet behind feature flags until the backend exists.

---

## 7. Suggested order

### Now (no backend required)

1. Achievements and badges, starting with first play, first win, 10 plays and a score milestone.
2. Weekly quests and a weekly chest.
3. Career stats page and collection album.
4. Revive hook for the custom win panels (Belt & Road, Maze, Parking) with a lower-is-better rule.
5. Streak repair and a level-40 prestige badge.
6. Polish: coin animation, near-miss copy, RTL and screen-reader pass.

### Next (small backend)

Sections 4.8.2 to 4.8.10 are the detailed Stars sequence: identity first, then the ledger, then the
first invoice, then the webhook, then Pro and refunds. Do not start with the invoice endpoint.

1. Telegram login and cloud saves.
2. Real rewarded adverts with consent and the existing cap.
3. Analytics and a small economy dashboard.
4. Telegram Stars coin packs and the starter pack.
5. Server-side entitlements, refunds and test mode.

### Later (full monetization)

1. Monthly Pro with the ad-free and daily-double benefits.
2. Cosmetic shop and season pass.
3. Global leaderboards, friend duels and shareable challenges.
4. Seasonal events and a content calendar.
5. Regional pricing, spending limits and a legal review.

---

## 8. Metrics and guardrails

Track at least:

- Activation: first run completed, first result seen, second run started.
- Retention: D1, D7, D30; streak length; daily claim rate.
- Engagement: runs per session, session length, modes tried, challenge completion.
- Economy: coins earned and spent, median balance, cap hits, revival purchases.
- Monetization: shop view → purchase, ad opt-in, ad completion, Pro conversion, refund rate.
- Quality: crash-free sessions, load time, frame time on low-end phones.
- Sentiment: support messages, store reviews, "would recommend".

Guardrails:

- A player must be able to reach level 10 and buy a revival without paying.
- No paid item may change a leaderboard score.
- No advert during a run.
- No purchase without an explicit confirmation.
- No fake scarcity, fake discounts or hidden renewal.
- Spending limits and an age gate before real money.
- Publish the odds and prices of anything randomized; prefer no randomization at all.

---

## 9. Per-game depth ideas

The career layer adds a reason to come back; this section is about giving each game another reason
to be interesting on the second, tenth and fiftieth run. These are candidates, not commitments.
Each entry states the current loop in one line, then specific additions. Effort: **(S)** hours,
**(M)** one to two days, **(L)** a new subsystem.

The rules for all of them: keep the first 30 seconds unchanged, add at most one new verb, seed every
random layout so a daily or a shared run is fair, and keep the games playable without spending
anything.

### 9.1 Levers worth reusing

1. **Objective cards** — three optional goals per run ("clear 2 lines with one piece"), scored and
   shown on the result sheet. Cheap, and it turns a score chase into a plan.
2. **Escalation phases** — at fixed marks, introduce one new threat with a radio line or a banner.
   The first minute stops being the whole game.
3. **A risk/reward resource** — fuel, ammo, time, a combo bank. A second bar the player can spend is
   depth without a new screen.
4. **A second information channel** — sound, a forecast, a banker's eyebrow. Depth comes from
   reading, not from more UI.
5. **A start-of-run choice** — ship class, loadout, doctrine, board size. It changes the solution
   rather than the stats.
6. **A seeded daily** — one board or sequence per day, par and a share card. Reuses the existing
   random helpers and the daily layer.

### 9.2 The 35 games

#### Balloon

_Loop: hold to climb, release to sink, five wind layers, hazards, photos._

- **Composition scoring**: a photo scores by altitude, framing and weather, with the three criteria
  shown after the snap, so the photo is a skill and not a drive-by. (S)
- **Album of 12 subjects** across America with a one-line joke each; complete sets unlock balloon
  patterns (cosmetic only). (M)
- **Forecast board** before launch: the first two wind patterns and the jet schedule, turning the
  route into a plan instead of a guess. (S)
- **Photo streak**: every subject photographed without a hit adds to a multiplier that a hazard resets,
  so the safe route and the photogenic route differ. (S)
- **Storm cells**: lightning forces a layer change and gusts push sideways; one new hazard per
  stretch so the crossing has chapters. (M)

#### Belt & Road

_Loop: draw routes across a grid, join every pair, keep the debt meter down, earn stars._

- **Toll gates and one-way lanes** as new tile types; coverage is no longer the only constraint. (M)
- **Contract levels**: "move six units to the port before the debt meter fills", reusing the debt
  meter as a soft timer. (S)
- **Daily trade route**: a seeded board with a par and a share card, no new level content. (S)
- **Port closures and sanctions** for two moves, announced one move ahead, so a good route has
  redundancy. (M)
- **Par ghost**: after a first failed star, a translucent preview of one optimal stroke teaches
  without a hint button. (M)

#### Blocks

_Loop: place one of three pieces, clear rows and columns, the run ends when nothing fits._

- **Objective cards**: three per run from a small deck ("clear two lines with one piece", "make a
  four-line cascade"), paying a score bonus at the end. (M)
- **Cascade meter**: clears in consecutive placements build a x2/x3 multiplier that resets on a
  placement without a clear. (S)
- **Earned specials** in a three-slot tray: a 1×1 filler after five clears, a line charge after ten,
  a colour bomb after fifteen. (M)
- **Board modes**: 6×6 Blitz with a move budget and 8×8 Classic, each keeping its own best. (S)
- **Rising stack**: a junk row appears every few placements and must be cleared from the bottom,
  making height a threat. (M)

#### Centrifuge

_Loop: watch the needle, press only on a real drift, ignore fake scares, keep hearts._

- **Scare families** with different tells: visual (banner, shake), audio (siren, colleague), social
  (phone call). Introduce one per difficulty so learning is legible. (M)
- **Trust meter**: false presses lower it; at low trust the real sirens look and sound dimmer, so
  panic compounds. (M)
- **Incident report** after the run: every alarm, real or fake, with the reaction time. Teaches the
  patterns and gives the run a story. (S)
- **Endurance mode**: one heart, news cycles per minute as the difficulty knob, daily-seeded scare
  order. (S)
- **Two actions**: acknowledge (cheap, wrong on a real drift) versus emergency shutdown (costly,
  right on a real drift), so the reflex becomes a decision. (M)

#### Chess

_Loop: chess against Putin, three cards per match, Vance may steal one._

- **Opponent personalities**: three leaders with different openings and one signature rule each (a
  free swap, a pawn wall, a card thief). (M)
- **Deck choice**: pick three of eight cards before the match, so a Vance steal is survivable and
  the deck is part of the plan. (M)
- **Puzzle ladder**: "win in two with one card" positions scored by moves, as a short second mode. (M)
- **Ladder twists** every few matches: a teleporting square, a fogged back rank, a one-move head
  start for the opponent. (L)
- **Grudge rematch**: after a loss, the opponent starts with a small advantage but the win pays
  double, giving an immediate reason to retry. (S)

#### Chip Fab

_Loop: stack a wafer, merge the modules it yields, keep the shortage bar down, keep hearts._

- **Yield**: a mis-stacked layer produces defective modules that must be scrapped, so speed trades
  against quality, with the yield shown on the HUD. (M)
- **Contracts**: "deliver three 16 GB modules" with a deadline and a payout, giving the merge stage a
  target beyond the shortage bar. (M)
- **Cleanroom events**: dust specks to tap off the wafer and a power flicker that freezes the
  stacker for two seconds. (S)
- **R&D choice** between levels: bigger board, slower shortage or more module value, one per level. (M)
- **Shortage market**: module value rises with the shortage bar, so pushing close to failure pays
  more. (M)

#### Convoy

_Loop: dodge in three lanes, grab barrels, chain near misses, keep the escort alive._

- **Fuel**: lane changes and mine hits burn it, barrels refill it, and running dry ends the run. The
  barrel line versus the safe line becomes the core decision. (M)
- **Ship classes** chosen before the run: tanker (three hearts, wide), corvette (two hearts, narrow,
  faster), tug (starts with an escort). (M)
- **Escort contracts**: keep a second ship alive for 60 seconds; it soaks one hit and pays a bonus if
  it survives. (M)
- **Escalation sets** at distance marks: crossfire, mine barrages, fog, each announced by radio so
  the change is readable. (M)
- **Emergency helm**: five near misses charge a one-use phase-through, giving the multiplier a
  payoff. (S)

#### Dome

_Loop: tap incoming rockets, prioritise what to save, limited ammo, faster waves._

- **Interceptor types**: short-range fast for drones, long-range for grad rockets, wide blast for
  clusters, each with its own count. (M)
- **Iron Beam**: one laser charge per wave on a cooldown, best saved for leakers; rewards restraint. (M)
- **Between-wave upgrades**: pick one of three (ammo, reload speed, rebuild a building). (M)
- **Building values**: a hospital is worth more than a shed, so the landing prediction becomes a
  triage decision. (S)
- **Drone swarms**: a cluster that needs one wide shot, breaking the single-tap rhythm. (M)

#### Drone Wall

_Loop: tower defence on a road, helmets as money, elite upgrades, powers, weather._

- **Doctrines** at wave one: infantry, air or engineering, changing upgrade costs and one power. (M)
- **Tech drafts** every five waves: one of three cards (medics cannot heal, mortars splash, drones
  cost less), so runs diverge. (L)
- **Wave intel**: show the next composition during the build phase, so preparation beats reaction. (S)
- **Rubble rebuild**: a destroyed defence leaves a cheap rebuild slot; a lost line is a setback, not
  a wipe. (M)
- **Commander unit**: one active hero with two cooldown abilities, so the player acts during a
  wave. (L)

#### Energiewende

_Loop: balance supply and demand, ramp plants, weather, storage, critics._

- **Demand response**: shed a block of demand for 30 minutes for money and a critic penalty, a third
  lever beside supply and storage. (M)
- **Interconnectors**: import and export at a moving price, cheap at night and expensive in a
  Dunkelflaute. (M)
- **Carbon budget**: coal gets expensive as the scenario's budget shrinks, so the cheap answer
  becomes a trap. (M)
- **Forecast error**: wind and sun forecasts are off by a margin, so reserve has to be planned, not
  just watched. (S)
- **Scenario campaign**: heatwave, storm and Dunkelflaute, each with a target, a par and a star
  rating. (L)

#### Fleet Hunt

_Loop: battleship on a 10×10, daily ammo, a fleet that persists across days._

- **Enemy salvos**: the fleet fires back at your harbour between days, so hunting carries a
  defensive cost. (M)
- **Sonar**: a limited scan reports how many ships sit in a row or column, earned by sinking a
  class. (M)
- **Fleet composition**: choose which class to hunt; a corvette chain is cheap, the Moskva pays big
  and needs rockets. (M)
- **Campaign**: several grids with damage and ammo carrying over, ending in a boss fleet. (L)
- **Daily mission**: sink one named class for a bonus, tying the hunt to the daily layer. (S)

#### Flamingo

_Loop: flap through gaps, dodge obstacles, keep hearts, revive once._

- **Rings and photo spots**: optional pickups in risky lines that raise the multiplier, greed versus
  safety. (S)
- **Weather blocks**: thermals, headwind gusts and rain that changes flap strength, seeded per run. (M)
- **Feather glide**: collect three feathers for a five-second glide, saved for a dense stretch. (M)
- **Medal gates** at 10, 25 and 50, with the next medal shown in the HUD and a share card at each. (S)
- **One-wing mode**: one hit, double score, no revive; a short second mode for players who have
  mastered the gaps. (S)

#### Fury

_Loop: slingshot birds with tap abilities, topple structures, finish levels, earn stars._

- **Loadout**: pick three of six birds before a level with limited counts, changing the solution
  rather than the power. (M)
- **Bonus objectives**: "finish with two birds left", "topple the dome without the bomb bird", beside
  the existing stars. (S)
- **Daily fort**: one seeded structure per day with a local best and a share card. (M)
- **Collapsing supports**: structures that fall when a lower block breaks, rewarding physics over
  brute force. (M)
- **Boss fortress** every fifth level: moving parts, an armoured core and two weak points. (L)

#### GPS Liar

_Loop: sail through fog with a lying GPS, read landmarks, limited cross-checks, 12 levels._

- **Triangulation**: pick two landmarks and cross two bearings for a fix, a skill layer above "check
  the compass". (M)
- **Radio beacons**: blips that give a bearing, using the sound channel instead of another
  readout. (M)
- **Currents**: the boat drifts while the GPS lies, so dead reckoning matters between fixes. (M)
- **Cargo contracts**: herring spoils faster than sauna stones, so the shortest route is not always
  the right one. (M)
- **Night levels**: only lights and buoys are visible; the same rules with a harder information
  diet. (S)

#### Leak Patrol

_Loop: hold fingers on leaks, grab items, answer the group chat, keep three hearts._

- **Rooms and doors**: leaks keep growing in rooms you leave, so triage across zones. (M)
- **Staff**: an intern who plugs one leak slowly and a second who sometimes causes one. (M)
- **Crisis types**: a burst main needs two fingers, a classified folder must be shredded, a reporter
  at the door must be blocked; different verbs, not more droplets. (M)
- **Group chat**: answering costs time but prevents a leak penalty; ignoring it grows. (S)
- **Shift structure**: three-minute shifts with a summary and a new floor, so the endless loop has a
  run shape and a payoff. (M)

#### Maple

_Loop: push a cart through a warehouse, snake up barrels, dodge moose cones, make the quota._

- **Tools with charges**: a syrup slick (a moose slips for a turn), a barrel decoy, a radio lure,
  found in the level. (M)
- **Noise**: a longer cart is louder and draws moose from further away, so route length is a stealth
  cost. (M)
- **Moose types**: sleepy, keen and a union rep who blocks a corridor for two turns. (M)
- **Efficiency stars**: moves against par, barrels against quota, no-detection; the level select
  shows which one is missing. (S)
- **Daily heist**: a seeded warehouse with a steps board and a share card. (M)

#### Maze

_Loop: find the counter with the form, collect stamps, avoid offices closed until Tuesday, fewer
steps is better._

- **Daily maze**: one seeded building per day with a par and a medal, reusing the generator. (S)
- **Efficiency rating**: par steps per size, plus a shortcut badge for the hidden vent. (M)
- **Form order**: the Passierschein lists forms in an order; collecting them in that order opens a
  shortcut, the wrong order wastes steps. (M)
- **Timed counters**: some offices close after a number of steps, so the route has to be chosen, not
  fully explored. (M)
- **Rules per size**: moving desks and one-way corridors from the medium size up, so sizes differ in
  mechanics and not just area. (L)

#### Merge

_Loop: swipe to merge ships, survive mines every five moves, earn submarines, reach the mega tanker._

- **Objective cards**: "build a ferry", "clear three mines", "make a triple", three per run and
  scored at the end. (S)
- **Mine types**: contact (blocks), drifting (moves one cell per merge) and cluster (splits), each
  needing a different answer. (M)
- **Combo chain**: merges on consecutive moves build a multiplier that resets on a non-merge move. (S)
- **High-tier abilities**: an oil tanker clears a row when merged, a supertanker spawns a submarine,
  so the top tiers stop being only points. (M)
- **Board variants**: 4×4 tight, 5×5 classic and 6×6 marathon with a move budget. (S)

#### Minefield

_Loop: minesweeper at sea, buoys, tools, an escort queue, a channel to clear._

- **Daily strait**: a seeded board with a par time and a medal, the same for everyone. (M)
- **Fair-board guarantee**: the generator proves the board is solvable without guessing, with a "no
  guess" badge on the difficulty. (M)
- **Tool charges**: the submarine and sonar are limited and earned by safe reveals, so using one is
  a decision. (M)
- **Convoy variant**: escort a tanker across while clearing, so the clock and the board interact. (M)
- **No-flag challenge**: buoys disabled, scored by time, a second board for the same layouts. (S)

#### Parking

_Loop: slide ships, free the red tanker, beat par, earn stars._

- **New blockers**: cranes that rotate a ship 90°, tugs that push a whole line, locks that open after
  a number of moves. (M)
- **Two tankers, one exit**: a shared move budget, so the order of freeing them matters. (M)
- **Currents**: after every third move a ship drifts one cell, so the plan has to survive drift. (M)
- **Daily puzzle** with a par and a fewest-moves board. (S)
- **Hint costs a star** rather than being free, keeping the par meaningful. (S)

#### Pipeline

_Loop: rotate pipes, repair cracks, intercept strikes, fill tankers, chain perfect saves._

- **Pressure**: pumps build pressure; too high cracks faster, too low stalls flow, and a relief valve
  is the new verb. (M)
- **Sabotage forecast**: the ticker names the next target type, so pre-repair and pre-position are
  possible. (S)
- **Pipe grades**: upgrading a segment buys crack resistance at a flow cost, a choice along the
  trunk line. (M)
- **Two terminals** with different demand, routed through junctions, so junctions become decisions. (L)
- **Spend the perfect-save streak** on a temporary flow boost, turning defence into economy. (S)

#### Purr Pentagram

_Loop: repeat the sequence of named cats, keep hearts, ignite the star._

- **Decoy cats** that look similar but are never named, plus longer sequences. (S)
- **Cat rules**: one cat repeats the previous name, one swaps two points mid-sequence; rules rather
  than raw memory. (M)
- **Rhythm mode**: names arrive on a beat and timing adds a multiplier. (M)
- **Daily riddle**: one seeded sequence with a share card. (S)
- **Nine Lives**: one heart, sequences grow forever, score by length; a short endurance mode. (S)

#### Raid

_Loop: survive waves, loot, level skills, fight bosses, run the season._

- **Build synergies**: weapon and perk tags combine with visible set bonuses (incendiary plus crit),
  so loot choice matters beyond the item level. (L)
- **Risk wave**: after a boss, choose a cursed next wave (more elites, double loot) or cash out the
  run bonus; a push-your-luck beat. (M)
- **Map modifiers** shown before entry: fog, elite surge, scavenger, cheap replayability. (M)
- **Companion** with two orders (hold, follow) and one ability; a light squad layer. (L)
- **Boss telegraphs and weak points** instead of more health, a skill check rather than a stat
  check. (M)

#### Rare Earth

_Loop: route crates from mines to the right factory, follow changing notices, meet deadlines._

- **Contracts with prices**: choose which crate to prioritise when capacity is short, and score the
  choice. (M)
- **Warehouses as buffers**: store a crate to dodge a deadline but pay storage, a timing tool. (M)
- **Bribes**: ignore one notice for a round with a scandal risk, a pressure valve with a cost. (M)
- **Rule forecast**: the ministry leaks the next notice type one round ahead. (S)
- **Refining**: combine two elements at a factory for a higher-value export, a second decision
  layer. (M)

#### Run Comrade

_Loop: three lanes, jump and duck, outrun the drone, survive the weather._

- **Run missions**: three optional objectives (collect ten sunflowers, five clean jumps, keep the
  drone back) with a completion bonus. (S)
- **Drone types**: spotter marks obstacles, dasher charges, jammer hides pickups; the chase becomes a
  puzzle. (M)
- **Pickup chain**: a helmet followed by a rice bowl within a few seconds upgrades the shield to a
  drone stun, so pickup order matters. (S)
- **Distance gates**: new obstacle pairs at 300, 600 and 900 metres, so the first minute is not the
  whole game. (M)
- **Daily seeded run** with a fixed obstacle order and a share card. (S)

#### Shootdown

_Loop: waves of drones, auto-fire, combos, a boss, a launcher on the ground._

- **Weapon pickups**: shotgun, railgun and flak with limited ammo from bosses, the one real choice in
  an auto-fire game. (M)
- **Launcher sandbags**: two absorbed hits before a heart, shown on the HUD, so positioning
  matters. (S)
- **Wave intel and an upgrade choice** during the break (fire rate or spread). (M)
- **Drone specials**: shields that need a flank, splitters, and jammers that disable auto-fire for
  three seconds. (M)
- **Night raid**: tracers only, so aim is by tracer and sound; a one-page mutator. (S)

#### Slice

_Loop: swipe missiles and drones, avoid friendly decoys, chain combos, keep hearts._

- **Formation volleys**: V shapes and crossing pairs that reward one planned swipe. (M)
- **Bomb types**: a cluster that splits if not cut in time, an EMP that disables the blade for two
  seconds. (M)
- **Flak burst**: a one-charge screen clear earned by a ten-hit combo, giving the combo a payoff. (S)
- **Precision bonus**: cutting through the centre adds points, so wild swipes cost accuracy. (S)
- **Boss helicopter** with exposed rotors, a multi-stage target in a reflex game. (M)

#### Sondage

_Loop: hold Othello rallies on France, answer the rival, survive events, win the poll._

- **Coalition partners**: at 30 percent pick one of two with a one-time power (an extra rally, a
  frozen region). (M)
- **Campaign budget**: rallies cost funds, funds come from held departments, so tempo is a
  resource. (M)
- **Debate round**: a short reaction mini-game that swings three departments. (M)
- **Regional blocs**: fully holding Brittany or Alsace gives a bonus, adding sub-goals to the map. (M)
- **Election night payoff**: a seat-count animation and a headline, turning the result screen into a
  moment. (S)

#### Suez

_Loop: wiggle the wedged ship free, call the excavator, keep the queue patient, keep hearts._

- **Tides**: at high tide the ship moves more easily; waiting costs queue patience, pushing costs
  hearts. (M)
- **Salvage tools** with charges: dredger, tug and airbags, each for a different wedging. (M)
- **Queue classes**: a livestock carrier that must go first and a tanker that blocks the canal if
  hit. (M)
- **Storms** re-wedge the ship and shake the queue, a mid-run reset that is not a full restart. (M)
- **Par time and a "no excavator" medal**; the narrower canals stay the difficulty ramp. (S)

#### Tycoon

_Loop: tap the derrick, buy producers, survive crises, chase achievements, prestige._

- **Contracts**: deliver a number of barrels within a time limit for a multiplier, a short-term goal
  in an idle loop. (M)
- **Market price**: selling now versus holding, reusing the existing price-spike machinery for a
  real decision. (M)
- **Managers**: assign one to a producer to automate a decision (reinvest, hold, sell), not just more
  output. (L)
- **New fields**: exploration with different cost and risk profiles, unlocked by prestige. (L)
- **Prestige tree** with three branches (extraction, logistics, influence), so resets play
  differently. (L)

#### Vault

_Loop: flip pairs, find bonus pairs, watch the banker, survive the phone shuffle, open bigger vaults._

- **Heist timer**: matches add time, mismatches cost it, while hearts stay the hard limit. (M)
- **Banker tells**: his eyebrow points near a bonus pair, a second information channel. (M)
- **Lock tiers**: gold bars need two keys, cheese is wild, watches come in threes; new card rules,
  not more cards. (M)
- **Scheduled phone calls**: the shuffle is announced with a countdown, so players can plan for it. (S)
- **Daily vault**: the same layout for everyone, fewest flips wins. (S)

#### Venezuela

_Loop: run, jump, twirl, slam, collect barrels, reach the flag, earn stars._

- **Oil-price modifier**: a high price means more guards and richer barrels, a low price the
  opposite; theme and mechanic in one. (M)
- **Bosses**: a rig foreman with a shockwave and a helicopter that drops guards. (L)
- **Vehicle section**: a stolen tanker truck auto-runs for 20 seconds with lane changes. (M)
- **Time medals and a no-damage badge** on the level select, next to the existing three stars. (S)
- **Hidden barrels** behind breakable crates, exploration versus the flag. (S)

#### Veto

_Loop: read five cards, vote aye, nay or veto before the clock, build a streak._

- **Resolution types**: procedural (abstain), substantive (majority) and emergency (veto); the right
  action depends on the type, not only on the cards. (M)
- **Veto limit**: three per session, so a veto has a cost while majority votes are free. (M)
- **Amendment window**: add a clause before voting that changes the required outcome, a second
  decision under time. (L)
- **Alliance signals**: a seat's card flickers to hint at a bloc, so reading beats reacting. (M)
- **Historical pack**: real-ish resolutions with a one-line context card after each round. (S)

#### Whack

_Loop: whack spokespeople before the statement bar fills, avoid decoys, keep the x5 combo._

- **Statement categories**: a lie (whack), a correction (leave) and a funding question (hold to
  fact-check); reading replaces pure reflex. (M)
- **Press-conference structure**: three rounds and a closing statement, with a bonus for reaching
  the end. (M)
- **Follow-up chains**: a whack spawns a follow-up card that must be tapped to complete the
  combo. (M)
- **Exclusive leak**: a rare golden target worth five times as much with a shorter bar, a greed
  decision. (S)
- **Board modifiers**: hideout targets move between podiums, the press hall adds more decoys. (M)

#### Wordle

_Loop: one five-letter word per day, six guesses, stats and a share card._

- **Hard mode** with its own stats: revealed letters must be reused. (S)
- **Themed weeks** announced in advance (energy, trade, bureaucracy) with a short intro line. (S)
- **Streak freeze**: one per week, bought with career coins, marked as used in the stats. (S)
- **Hint economy**: reveal one letter for coins, with aided solves counted separately. (M)
- **Challenge links**: pick a word and share a code that encodes it, so a friend plays the same
  puzzle without a backend. (M)

### 9.3 What to deepen first

Six candidates chosen for replay value against effort, not for how much code they touch.

| Order | Mode    | First change                        | Effort | Why this one                                                                                                  |
| ----- | ------- | ----------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------- |
| 1     | Blocks  | Objective cards and a cascade meter | M      | The purest score loop and the least run-to-run variation; it also sets the pattern for the other arcade modes |
| 2     | Whack   | Statement categories                | S      | The cheapest way to turn a reflex game into a reading game                                                    |
| 3     | Convoy  | Fuel and a ship choice              | M      | A runner needs a second resource more than more obstacles                                                     |
| 4     | Maze    | Daily maze and an efficiency rating | S      | Already step-scored and deterministic, ideal for a daily                                                      |
| 5     | Vault   | Heist timer and banker tells        | M      | The memory loop needs a clock and a second channel                                                            |
| 6     | Balloon | Forecast and composition scoring    | M      | The photos are the theme; make them the goal                                                                  |

Do one or two per release, and pair each with a matching mastery badge or result-sheet line from
section 2.2 so the new depth is visible without a new screen.

Done so far: Blocks (objective cards in `src/lib/game/blocks/objectives.ts`, cascade meter in
`scoring.ts` and the store) and Whack (lives, corrections and held fact-checks in
`src/lib/game/whack/`). Next pair: Convoy fuel and ship choice, then the Maze daily.

### 9.4 Guardrails for depth

- Leave the first 30 seconds alone. New mechanics arrive after the first minute or in a separate
  mode.
- One new verb at most. If an idea needs a new control scheme, it needs a very good reason.
- Seed every random layout. A daily, a share card and a test all need the same input to give the
  same output.
- Put new rules in the mode's pure logic folder with tests, not in the page component.
- No depth behind a paywall. Coins can speed up cosmetics, never change a rule.
- Keep runs under three minutes unless the mode is a campaign (Belt & Road, Maze, Parking, Tycoon).
- Six locales, logical CSS and icons over prose for every new label; a mechanic that needs a
  paragraph is probably too complicated.
- Measure retries and second runs, not just session length. Depth that nobody reaches is cost
  without value.

---

## 10. Open questions

- Should the daily reset be local midnight or a fixed UTC time once accounts exist?
- Should coins be shared with Tycoon cash, Raid crystals and Fleet Hunt points, or kept separate?
- Is a season pass compatible with a small game collection, or will it feel like a second job?
- How much of the career layer should work offline?
- Which locale needs a native review first (fa and ar carry the highest risk of bad jokes)?
- Do we want global leaderboards if they invite cheating, or only friend leaderboards?
- Is Telegram the only account provider, or should there be a guest account with an upgrade path?
- How do we handle a player who changes the device clock to farm the daily track? (For now: accept
  it; later: server day.)
- Should Pro include revivals, or only convenience and cosmetics?

---

## 11. Relationship to `todo.md`

This document is the idea catalogue. `todo.md` remains the short list of concrete open work. When an
item here becomes planned, add a matching checkbox there with a file or a design note. The existing
monetization section in `todo.md` (Telegram login, Stars revivals, Pro, database, Fleet Hunt ads)
maps directly to sections 4.3, 4.4 and 6.1 here.
