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

---

## 5. Content and growth

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

## 9. Open questions

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

## 10. Relationship to `todo.md`

This document is the idea catalogue. `todo.md` remains the short list of concrete open work. When an
item here becomes planned, add a matching checkbox there with a file or a design note. The existing
monetization section in `todo.md` (Telegram login, Stars revivals, Pro, database, Fleet Hunt ads)
maps directly to sections 4.3, 4.4 and 6.1 here.
