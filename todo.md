# Open work

State as of the Rare Earth Squeeze commit (`6fef013`). Source of truth for specs: the ww3-sv roadmap (sections 1 to 5).

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

- [ ] **1.3** Migrate the five older pause overlays to the shared `PauseOverlay`. It was left alone to avoid merge conflicts.
- [ ] **1.3** Decide whether the idle game (Oil Tycoon) and the puzzle modes without lives (Parking, Belt & Road, Maze, Wordle) need a shared "result panel" instead of per-mode panels.
- [ ] **1.4** Audit all art and text against the guardrails: no real unit insignia or trademarks, bloodless violence, satire aimed at governments and situations. Real politicians may be named (decision by the owner), but each mode spec still says "original archetype" for some cameos (Chip Fab "The Jacket", Venezuela caricature, La Candidate).
- [ ] **1.5** Persian and Arabic RTL review of the HUD for every new mode (the playfield must stay LTR). Most agents only checked English, and sometimes German or Persian, in a headless browser.
- [ ] **Section 4, step 8**: About page polish, consent, PWA and general polish "as in the existing commit plan". Only the satire note and a small `/about` route exist.
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
