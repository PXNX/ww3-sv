# Open work

State as of the PauseOverlay migration commit (`06bbcbd`). Source of truth for specs: the ww3-sv roadmap (sections 1 to 5).

## 1. Modes still to build

### Requested, not started

- [ ] **Shadow Fleet Shuffle** (backlog 3.16): shell game that tracks a sanctioned tanker. A worktree and branch `mode/shuffle` exist but are empty.

### Roadmap section 3 leftovers

- [ ] **Sondage Slider**: the lighter alternative to Sondage Surge (tap rally icons to push a wobbling poll line down). Skipped on purpose.

### Backlog 3.16, never started

Russia / Ukraine

- [ ] Grain Corridor: guide grain ships through the Black Sea, dodge mines
- [ ] Frontline Tug: tap-to-push tug of war

Iran / Israel / USA

- [ ] Strait of Hormuz Slalom: Convoy Runner variant with a shrinking lane
- [ ] Diplomacy Poker-Face: match statements to factions

Venezuela

- [ ] Heavy Crude Blend: mix crude and diluent to hit a quality target

China

- [ ] Dragon Container Stack: crane timing stacker
- [ ] Taiwan Strait Slalom: chip cargo ships dodge patrol boats

Germany

- [ ] Autobahn Dash: no speed limit runner
- [ ] Pfand Pickup: catch bouncing bottles

France

- [ ] Grève Dodge: blockade runner
- [ ] Baguette Defense: gulls steal baguettes (tower defense lite)
- [ ] Nuclear Fuel Rod Juggler
- [ ] Wine & Cheese Diplomat: matching game
- [ ] Fromage Chase: maze chaser with a surrender countdown
- [ ] Maginot Breakout: brick breaker with a surrender timer

Generic

- [ ] Strait Memory Match (flags and cargo, Circle Flags already bundled)
- [ ] Bosphorus Traffic Jam (sliding block with ferries, tankers, cats)
- [ ] Pasta Pipeline (Italy gas pipe puzzle)
- [ ] Production Cut Dial (Saudi Arabia balance game)
- [ ] Bullet Train Merge (Japan)
- [ ] Icebreaker Race (Arctic Convoy Runner variant)
- [ ] Stack the Containers
- [ ] Price Cap Slider (2048 variant)

Check against the modes that landed outside this plan (chess, purrpentagram, balloon, gpsliar, leakpatrol, maple) before starting, in case one already covers an idea.

## 2. Roadmap items not finished

Done: **1.3** the older pause overlays (convoy, minefield, pipeline, fury, flamingo, shootdown) now use the shared `PauseOverlay` (commit `06bbcbd`).

- [ ] **1.5 Persian and Arabic RTL review** of the HUD for every mode (the playfield must stay LTR). Not started. Plan: run each play route at 390x844 in fa and ar in a headless browser, check clipped or overflowing text, physical left/right Tailwind classes that should be logical (`ms-`/`me-`/`start-`/`end-`), arrows that should flip, Latin names inside RTL text, fonts with missing glyphs, and the LivesBar order. Previous checks only covered English and sometimes German or Persian.
- [ ] **Section 4, step 8: About page, consent, PWA and general polish** "as in the existing commit plan". Not started. Only the satire note and a small `/about` route exist. Needs: finish the About page (credits, privacy note about local storage, version), decide whether a consent notice is needed for a client-only app, check the manifest, service worker, offline behaviour and install hint, and a polish pass.
- [ ] **1.3** Decide whether the idle game (Oil Tycoon) and the puzzle modes without lives (Parking, Belt & Road, Maze, Wordle) need a shared "result panel" instead of per-mode panels.
- [ ] Make sure every `leaders` list in the registry is meaningful. Several new modes use `leaders: []`, which changes what the leader filters show.

## 3. Verification gaps (nothing was tested on a real device)

- [ ] Real touch devices: Convoy and Blocks drag (roadmap 1.1), Suez two-finger drag, Venezuela move strip plus jump button, Radar Slice swipes, Belt & Road drawing, Maze swipes, Run Comrade lane swipes, Iron Dome taps, Whack tapping.
- [ ] Audio for every new mode (only existing sound ids are wired; Run Comrade added `drone-buzz` and `drone-brzzz`).
- [ ] Modes that were never opened in a browser at all: Radar Slice, Centrifuge Spin, Belt & Road.
- [ ] Visual check of art and cameo SVGs: Kremlin board in Whack, Venezuela canvas, Suez canvas, Energiewende cameos, The Jacket, Rare Earth notices and rule icons, Oil Tycoon crisis card, prestige dialog and welcome-back panel.
- [ ] Run Comrade: dawn and fog look, the shocked look-back, and the scared game-over cameo.
- [ ] Game balance was tuned only with bots or tests, never by playing: Drone Wall, Radar Slice, Whack, Centrifuge, Energiewende, Sondage, Suez, Vault, Veto, Rare Earth, Oil Tycoon (first pass).
- [ ] Layouts for the long German, Russian and Ukrainian strings and for Arabic.

## 4. Content that needs a native speaker

- [ ] fa, ar, ru and uk UI text for every new mode (all translations were written by the agents).
- [ ] **Sanctions Wordle word lists** for de, fa, ar, ru and uk. Only length and alphabet are tested, not whether a word is real, common or inoffensive. Persian and Arabic are the riskiest (some inflected verb forms are in the allowed lists).
- [ ] Jokes in Veto (36 resolution texts), Whack, Energiewende, Centrifuge and Oil Tycoon in fa and ar.

## 5. Known design choices to revisit

- Radar Slice: a missed threat costs a heart (not in the spec).
- Run Comrade: the helmet boost also plows through obstacles. Distance score counts in steps of five.
- Blocks: the lift above the fingertip was removed, so the finger now covers part of the dragged piece.
- Drone Wall: a "sell for 60%" action was added.
- Sondage Surge: the rival wins ties, and the rules end the game as soon as one side holds more than half the map.
- Gold & Cheese Vault: three matches in a row remove one raised eyebrow (not in the spec).
- Oil Tycoon: offline progress is capped at 8 hours at 50% speed, and a corrupt save is discarded without a backup. The Upgrades tab shows a "(4)" badge on a fresh game.
- Maze, Parking, Belt & Road and Wordle have no lives, so they use steps, moves, debt or guesses plus stars instead of `LivesBar`.

## 6. Repository housekeeping

- [ ] Remove the leftover worktrees under `C:\dev\OLD\ww3-modes\` and `C:\dev\OLD\ww3-sv\.claude\worktrees\`, plus the local branches `mode/*`, `integration/phase-1` and `worktree-agent-*`.
- [ ] The local `main` checkout in `C:\dev\OLD\ww3-sv` is behind `origin/main` and had uncommitted `messages/*.json` changes. Commit or stash them, then pull. Expect conflicts in `messages/*.json` and `src/lib/modes/registry.ts` because every mode appends there.
- [ ] Consider an automatic way to avoid merge conflicts in `registry.ts` and `messages/*.json` (for example one message file per mode merged at build time), since every new mode touches both.
- [ ] `bun run check` regenerates the gitignored `project.inlang/.lix` folder, which `prettier --check` then flags. Add it to `.prettierignore`.

## 7. Future monetization

- [ ] Release the current state as version 1.0 on GitHub: bump `version` in `package.json`, tag the commit `v1.0.0` and publish a GitHub release with that tag and label.
- [ ] Telegram login through a Telegram bot, modelled on [pxnx/ptb-rw](https://github.com/pxnx/ptb-rw) and [pxnx/ptb-psyops](https://github.com/pxnx/ptb-psyops) (python-telegram-bot). Start with Mini App `initData` verification rather than a password flow: `improvements.md` §4.8.2.
- [ ] Payments with Telegram Stars inside the app to buy a revival. Invoice endpoint, webhook and idempotency: `improvements.md` §4.8.3 and §4.8.8.
- [ ] Monthly Pro subscription (paid with Telegram Stars): skips watching ads once ads exist, and includes 10 free revivals per month. Stars subscription rules: `improvements.md` §4.8.7.
- [ ] Database design: check whether the app and its backend can be hosted serverless as a Telegram Web App, see [Telegram: serverless bots](https://core.telegram.org/bots/serverless). Needs to store accounts, Stars purchases, subscriptions, revivals left this month and, later, the shared points wallet. Working schema: `improvements.md` §4.8.5.
- [ ] Execute the five Stars phases in `improvements.md` §4.8.10 in order: identity, ledger, invoice, webhook, then Pro and refunds. Do not build the shop shelf first.
- [ ] Wire up the open monetization TODOs in the code: the rewarded ad before the bonus shots in Black Sea Fleet Hunt (`fleethunt`), and moving its points into a shared wallet so they can be spent as currency in other games.

# ww3-sv: open items (as of 2026-10-15)

Full specs for every mode: `C:\dev\OLD\ww3-new-modes-plan.md`.

## Done (on `origin/main`)

| Mode                | id           | Commit    |
| ------------------- | ------------ | --------- |
| Wandering Balloon   | `balloon`    | `45e7f55` |
| GPS Liar            | `gpsliar`    | `cddc969` |
| Leak Patrol         | `leakpatrol` | `60fbf28` |
| Maple Reserve Heist | `maple`      | `78d3083` |

## Still to implement

| #   | Mode                 | id           | Country / leaders                         | Core idea                                                                                                                                                                                          |
| --- | -------------------- | ------------ | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5   | Iceberg Curling      | `curling`    | Greenland, `['trump']`                    | Curling physics against the realtor's "For Sale" sign, sweeping, seals and a lost penguin, 8 ends with stars                                                                                       |
| 6   | Starlink Kill Switch | `killswitch` | Ukraine / Russia, `['zelensky', 'putin']` | You play Elon Musk: cut the satellite link of drones before they reach the refinery, leave civilians alone, geofence power-up, your own posts flip the rules; needs a new Elon Musk caricature SVG |
| 7   | Hermit Hackers       | `hackers`    | North Korea, `['kim']`                    | Retro terminal: Mastermind to crack fictional crypto accounts, alternating with Lights Out on a power-plant breaker panel, trace meter, quota                                                      |
| 8   | Gig Saboteur         | `sabotage`   | Russia, `['putin']`                       | Bumbling 50-euro messenger-channel hire, top-down stealth on a timer (power line, depot, shell factory), ends with a wanted poster; 9 levels with stars                                            |

To continue: resume the workflow with `MODES.slice(0, 8)` (the four finished modes replay from cache).

## Follow-ups on the finished modes

- **No playtest in a browser for any of the four.** Only unit tests, svelte-check, lint and build ran. Play each once on phone and desktop and check art, feel and balance.
- **Balloon:** tuning in `src/lib/game/balloon/config.ts` (track 5600 ≈ 90 s; the fastest wind layer is too quick for photos, which is intentional but may frustrate).
- **GPS Liar:** no foghorn sound (no matching SoundId exists); the tanker is deliberately hidden from the chart.
- **Leak Patrol:** no own game-over cameo, it reuses the shared Trump cameo; balance numbers are first pass (a fix takes 4.5 s of holding, waves last 18 s).
- **Maple Reserve Heist:** no pause button (turn-based, has a Wait button instead); early levels are easy; tile colour `bg-mustard` is shared with `dome`.
- **Shared:** every mode with leaders edits `src/lib/modes/registry.test.ts`, so expect merge conflicts there when several people add modes in parallel.

## Ideas not chosen yet (from the brainstorm)

Coalition Tower (Italy), Carnival Rush (Brazil), Last Train (Japan), Douze Points (Eurovision), Sauna Sisu (Finland), Sisyphus Bailout (Greece), Rubber Army (USA 1944), Baltic Elves (Lithuania), Phishing Trip (Estonia), Six Fingers (Ukraine), DMZ Sort (South Korea), Rooftop Dish (Iran).

- [ ] Per-game depth pass: six candidates and their effort are in `improvements.md` §9.3. Blocks objective cards + cascade and Whack statement categories are done; next are Convoy fuel and the Maze daily.
