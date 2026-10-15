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

- [ ] **1.4 Guardrail audit: decision needed, then land.** The audit is finished and committed on the local branch `audit/guardrails` (commit `9261a60`), but it is NOT on main. It rewrites content that the owner added on purpose, so it needs a go or no-go per item:
  - Renames `Azov Brigade` to a generic `Volunteer Brigade` in Drone Wall (ids, keys and all six texts).
  - Removes the real brands Wildberries and Yandex (text, "WB" lettering, red "Я" logo) from Flamingo Flight.
  - Reverts `Jason Huang of Novideo` in Chip Fab Rush back to the nameless archetype "The Jacket" (undoes `fb684ab`).
  - Renames the Pokémon ball cards in 4D Chess (Gotcha, Great, Ultra and Master Ball) to Lasso, Fishing Net, Trawl Net and Dragnet, with new icons.
  - Replaces "Sharpie" with "marker" in Leak Patrol, and turns the red cross on the Drone Wall medic into a green plus (the red cross is a protected emblem).
  - Adds a "Credits and licences" section to the About page in six locales, the OFL texts for three fonts in `static/fonts/`, and `src/lib/contentGuardrails.test.ts` (scans for removed names, blood terms, blood-red SVG colours, platformer look-alike shapes, embedded images in SVGs and missing licence files; 15 of its 38 checks fail without the renames).
  - Suggested way forward: cherry-pick the parts the owner accepts, and relax the test's name list for the rest. The credits section, font licences and the red cross fix are uncontroversial.
- [ ] **1.4 Judgement calls from the audit, nothing changed yet:**
  - Third-party sounds with unknown provenance: `putin-laugh.mp3` (tagged www.voicy.network, a meme soundboard, a real person's voice), `slava-ukraini.wav`, `welcome-to-ukraine.mp3`. The About page says nothing about sound credits until the source and licence are known.
  - Weapon and product names kept as descriptive: Patriot, HIMARS, Javelin, Bayraktar, Leopard 2, Gepard, Pion, Storm Shadow, F-16, Pantsir, Zircon, Kinzhal, Geran, Kalibr, "Iron Dome Juggler".
  - Game-brand look-alikes: "Sanctions Wordle" (NYT trademark), "Whack-a-Spokesperson" (Whac-A-Mole), "Magyar's Birds" (Angry Birds style).
  - Fury "Topple every golden dome": onion domes in the style of Russian churches, which could read as attacking religious buildings.
  - Stereotypes aimed at nations rather than governments: red fez on the Erdoğan cameo, Swiss banker/cheese/watches, Canadian moose, Finnish herring and sauna, French croissants, tea jokes for Iran and Turkey.
  - Others: Soviet helmet with a red star and Ukraine's trident on a portrait, Drone Wall snipers prioritising medics, "Passierschein B-38" and "Ever Stuck" as nods to existing works.
  - Bug: the ru `cameo_erdogan_3` text ends in an odd "Гость: {characterName}".
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
