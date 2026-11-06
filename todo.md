# Open work

State as of the PauseOverlay migration commit (`06bbcbd`). Source of truth for specs: the ww3-sv roadmap (sections 1 to 5).

## 0. In flight: five modes still need implementation

The commits `feat(slice)`, `feat(curling)`, `feat(fleethunt)`, `feat(gpsliar)` and `feat(maple)` land a first cut of a polish pass on five existing modes, plus the missing sound effects. The code compiles and the new rules come with tests, but this is **work in progress that still requires additional implementation** before it counts as finished:

- [ ] **Radar Slice**: the new armoured `iskander`, the `cluster` that splits into bomblets, the floating `mine` decoy and the `focus`/`repair` pickups are wired through rules, spawner, scoring, renderer and store, but the balance, the spawn weights and the pickup cadence have not been played. Art and the HUD for the pickups need a visual pass.
- [ ] **Iceberg Curling**: the rebuilt end flow, sweep, curl, gamble, wind, penguin, seals and drifting ice have rule tests, but the power/sweep balance, the hazard ramp and the end-summary cadence are untuned and untested on a touch device. The renderer is a first cut and needs a browser check.
- [ ] **Black Sea Fleet Hunt**: salvos, depth charges, sonar, decoy buoys and patrol boats are in, with shell arcs, splashes and sinking ships. Weapon balance, the larger late fleets and the save migration for existing hunts need a pass; the effects layer is unmeasured on low-end phones.
- [ ] **GPS Liar**: coast guard patrols, storms and the spoof pressure are covered by `pressure.test.ts`, but the weather module has no direct tests and the new sea, wakes and win panel need a visual check and a balance pass.
- [ ] **Maple Reserve Heist**: the lever/truck, coffee and toque gadgets, rewinds, golden barrels and the new moose routines are implemented, but the store tests are still red: `LEVEL_1_RUN` is stale after the level rebuild and six tests in `src/lib/stores/mapleGame.test.ts` fail (quota, win flow and the heart-loss setup). The new level curve and scoring need a play-test.
- [ ] None of the five modes was played in a browser in any locale. Balance, touch input, RTL layouts and the Persian, Arabic, Russian and Ukrainian strings still need the usual checks from section 3.

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

- [x] Release the current state as version 1.0 on GitHub (`v1.0.0`, version label on the About page): bump `version` in `package.json`, tag the commit `v1.0.0` and publish a GitHub release with that tag and label.
- [x] Telegram login through a Telegram bot (done as the Mini App sign-in, bot in `mn/ptb-ww3`), modelled on [pxnx/ptb-rw](https://github.com/pxnx/ptb-rw) and [pxnx/ptb-psyops](https://github.com/pxnx/ptb-psyops) (python-telegram-bot). Start with Mini App `initData` verification rather than a password flow: `improvements.md` §4.8.2.
- [x] Payments with Telegram Stars inside the app to buy a revival. Invoice endpoint, webhook and idempotency: `improvements.md` §4.8.3 and §4.8.8.
- [x] Monthly Pro subscription (paid with Telegram Stars): skips watching ads once ads exist (still to wire once real ads exist), and includes 10 free revivals per month. Stars subscription rules: `improvements.md` §4.8.7.
- [x] Database design: check whether the app and its backend can be hosted serverless as a Telegram Web App (yes: SQLite on Telegram Serverless, schema in `mn/ptb-ww3/tgcloud/schema.js`; no refunds beyond the statutory rights), see [Telegram: serverless bots](https://core.telegram.org/bots/serverless). Needs to store accounts, Stars purchases, subscriptions, revivals left this month and, later, the shared points wallet. Working schema: `improvements.md` §4.8.5.
- [x] Execute the five Stars phases in `improvements.md` §4.8.10 in order: identity, ledger, invoice, webhook, then Pro and refunds. Do not build the shop shelf first.
- [x] Group leaderboards through [Telegram's gaming platform](https://core.telegram.org/bots/games) for Block Puzzle (`blocks`): in a group (never in a private chat or channel) the bot posts the game with `/games`, Play opens `/play/<mode>?game_session=<id>` in Telegram's game browser, and the result sheet (`GameOverModal`) sends the score with that session to the bot's `gamescore` route, which calls `setGameScore` on that group's message. Telegram keeps the scoreboard per chat and posts each new best there; the bot adds `/top` and a message when someone takes the group's record. A t.me `startapp` link as the Play answer does not work: the game browser only flashes open and shut instead of starting the Mini App, so the game page runs without initData and the session id is the credential.
- [ ] Telegram Serverless does not work for the bot yet (still waitlisted), so the bot and its endpoints run on nyx (`mn/ptb-ww3`, README "Run on nyx"). When it moves to Serverless, `gamescore` needs another way in: Serverless checks the Mini App initData for every endpoint, and a game page has none.
- [x] Group leaderboards for the quick arcade modes as well: `convoy`, `merge`, `shootdown`, `flamingo`, `slice`, `whack`, `runcomrade`, `dome`, `leakpatrol`, `killswitch`, `veto`, `shuffle`, `centrifuge`, `rareearth`, `balloon` and `grain` join `blocks` in `GROUP_GAME_ROUTES` (`src/lib/services/telegram.ts`) and in the bot's game list. Each ends on the shared result sheet with one score where higher is better and has no levels or variants. Each still has to be registered with @BotFather under its mode id as the short name (`/newgame`, with a 640×360 picture); until then `/games` answers that it is not set up yet.
- [ ] More modes as group games. Per mode: register it with @BotFather as above, add it to `GROUP_GAME_ROUTES` and to the bot's game list, and check that its result-sheet score is "higher is better", because Telegram only ranks that way. `beltroad`, `fleethunt`, `maze`, `parking`, `tycoon` and `wordle` have their own end screens and first need to call `telegram().reportGroupScore(mode, score)` there. Modes with levels, maps or variants (`minefield`, `pipeline`, `fury`, `chipfab`, `vault`, `dronewall`, `curling`, `slider`, `maple`, `venezuela`) would mix them on one board unless each becomes its own game.
- [ ] Wire up the open monetization TODOs in the code: the rewarded ad before the bonus shots in Black Sea Fleet Hunt (`fleethunt`), and moving its points into a shared wallet so they can be spent as currency in other games.

## 8. Beachhead (game mode `beachhead`)

State: everything below is built and committed locally on `main`, nothing pushed. Nothing of it was played on a real device; the visual checks were done in headless Edge only.

### Not built yet

- [ ] **Real multiplayer.** The sea log (lost, raided, defended, attacks, raiders) is simulated from the clock in `mapLog.ts`. Missing: a backend (the Telegram Serverless one, see section 7) that every 24 h lets another player take a random island, lets the attacker earn 50% of the victim's exposed stock (the bunker already secures a share), takes that stock from the victim and writes real log entries for both.
- [ ] **Defence test with real art.** `defenseTest.ts` maps the HQ, warehouses, bunker, training ground, radar, dojo and cottages to generic `depot` buildings. They should be drawn as the real home buildings.
- [ ] **Tests that were failing before this work** (5 in `campaign.test.ts`: maximum level of every building, packing big units first, packing the heavy units, hero alone on an empty boat, the fortress reward), plus type errors in `render.ts` (`case 'orc'`), `campaign.ts` (Azov in `Army`) and test typing. They need fixing or deleting.
- [ ] **Lint errors that were already there:** unused imports in `beachheadGame.svelte.ts` and `baseArt.ts`, a `Set` that should be a `SvelteSet`.
- [ ] **Check by eye on a phone:** the solid-built tanks, personnel carriers and howitzers (barrel directions in a real attack), the narrow upgrade popup, the store tabs, the chest opening animation, the compact sea log, the skill detail page.
- [ ] **Measure the zoom lag.** The battle and island canvases now stay within a fixed pixel budget (`PIXEL_BUDGET` in `BeachheadCanvas.svelte` and `BeachheadIsland.svelte`); nobody timed the frames. Tune the budget if it is still slow on a weak phone or too blurry.
- [ ] **Sound.** Only existing sound ids are used (click, chime, ui-error, explosion). Missing ones: chest opening, hammering builders, boat horn, skill research done.
- [ ] **Translations.** All new `beachhead_*` keys in fa, ar, uk and ru were written by the agent and need a native speaker.

### Ideas, not decided

- A hammering sound for the builders, and let the builder walk to the defence instead of standing there.
- Show defence levels on the island (small badge like the buildings have).
- A "shop" for hero shards and crystals with Fake News.
- A leaderboard of islands held, or a weekly event island (needs the backend above).
- Allied or clan bases that can send troops to defend yours.
- Seasonal biomes (winter north spreading south).
- Daily expedition quests and expedition tiers that unlock with the radar level.
- A tutorial for the new built-from-the-store flow (warehouses, bunker, extra cottages, boats), since new saves start with almost nothing built.

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
