# World War 3

A satirical cartoon puzzle and arcade collection about oil, shipping, and geopolitics, built as a
SvelteKit Progressive Web App with 50 playable modes. Scores and settings stay in the browser's
local storage; inside Telegram the optional cloud save mirrors progress to the bot's database in
`bot/`. Diagnostics are recorded locally too and never leave the device.

## Tech stack

- SvelteKit with Svelte 5 runes, deployed with `@sveltejs/adapter-vercel`
- Tailwind CSS and daisyUI (custom `ww3` theme)
- unplugin-icons with the Fluent, Lucide, Fluent Emoji, and Circle Flags icon sets (bundled locally)
- inlang Paraglide JS for English, German, Ukrainian, Russian, Persian, and Arabic (Persian and Arabic are right-to-left)
- Vitest for pure logic unit tests
- Planck for the shared rigid-body physics wrapper
- Bun 1.4.4 as package manager and local runtime
- Self-hosted Baloo 2 display font (SIL Open Font License) under `static/fonts/`

## Setup

```sh
bun install --frozen-lockfile
bun run dev
```

The development server runs on <http://localhost:3021>.

## Deployment

[`vercel.json`](vercel.json) holds the deploy configuration. Vercel installs with
`bun install --frozen-lockfile` and builds with `bun run lint && bun run build`, so a deploy fails
if formatting (`bun fmt --check`) or ESLint fails. `bun run lint` is the one command that runs both;
use `bun fmt` to fix formatting and `bun lint --fix` for the linter's own fixes. The SvelteKit
Vercel adapter (configured in `vite.config.ts`) builds the serverless function, so no extra output
settings are needed here.

Pushing to `main` deploys the web app automatically. Before pushing, run the same commands locally:

```sh
bun install --frozen-lockfile
bun run lint
bun run check
bun run test
bun run build
```

The Telegram bot in `bot/` is not deployed by Vercel; it runs as a container on the server.

## Scripts

| Script                 | Purpose                                                           |
| ---------------------- | ----------------------------------------------------------------- |
| `bun run dev`          | Development server                                                |
| `bun run check`        | Compiles the message files, then Svelte and TypeScript type check |
| `bun run lint`         | `bun fmt --check` and ESLint                                      |
| `bun run format`       | Formats all files with `bun fmt`                                  |
| `bun run test`         | Vitest unit tests (single run)                                    |
| `bun run test:watch`   | Vitest in watch mode                                              |
| `bun run build`        | Production build using the Vercel adapter                         |
| `bun run preview`      | Serves the production build locally                               |
| `bun run i18n:compile` | Regenerates `src/lib/paraglide/` from `messages/`                 |

Before every commit, all of these must pass: `bun install --frozen-lockfile`, `bun run check`,
`bun run lint`, `bun run test`, and `bun run build`.

## Project layout

```
messages/{en,de,fa,ar,uk,ru}.json  translatable strings (key parity is enforced by a unit test)
project.inlang/settings.json      inlang project configuration
src/lib/modes/registry.ts         single list of game modes; the start screen renders from it
src/lib/game/                     per-mode rules plus the shared juice and physics helpers
src/lib/services/telemetry.ts     local-only event log; /telemetry reads the same store
src/lib/theme/                    mascot, cameos, leaders and sprite configuration
src/lib/styles/tokens.css         design tokens and font faces
src/lib/styles/playful.css        sticker, button, banner and juice animations
src/lib/components/               shared components (mode select, game shell, overlays)
src/routes/+page.svelte           start screen
src/routes/play/<mode>/           one route per game mode
bot/                              Telegram Mini App bot (Python, its own database)
brand/                            canonical logo sources and Telegram artwork
docs/                             API contracts and planning documents
scripts/                          generators for cards, OG images, brand and level data
static/cards/                     gameplay backgrounds for the mode cards (one per mode)
static/og/                        link-preview images (one per mode)
static/icons/                     PWA and touch icons rendered from brand/
static/assets/mascot/             mascot artwork, one SVG per pose
static/assets/cameos/             cameo portraits, one SVG per cameo id
static/fonts/                     self-hosted font files and license
```

Planning notes live in `docs/planning/` (`todo.md` is the short open-work list and `improvements.md`
is the idea catalogue). API contracts for the Mini App are in `docs/`.

### Internationalization and right-to-left

The locale is taken from local storage if the player picked one in the locale switcher, otherwise
from the browser language, and falls back to English. Pages are rendered in the browser only
(`ssr = false`, prerendered shells), because the locale is only known on the device. When Persian or Arabic
is active, the document direction switches to right-to-left; playing fields must carry the
`data-playfield` attribute so they always stay left-to-right.

### Mascot artwork

Every pose and every cameo ships with an original SVG caricature. The generic placeholders
(`_placeholder-mascot.svg`, `_placeholder.svg`) remain as fallbacks for a missing file. To replace
a pose with the owner-supplied artwork, add the file to `static/assets/mascot/` and point the pose
in `POSE_FILES` in `src/lib/theme/character.ts` at it; cameo portraits work the same way in
`src/lib/theme/cameos.ts`.

### Local diagnostics

`/telemetry` shows a bounded log of app opens, page and mode visits, results and dashboard actions.
`src/lib/services/telemetry.ts` keeps it under its own localStorage key so it never joins the cloud
save and nothing is sent over the network. Events are sanitized to small primitives: no free text,
contact details or Telegram launch parameters. Export and clear are available on the dashboard.

### Juice and physics

`src/lib/game/juice.ts` holds the pure particle physics (gravity, drag, floor bounce), drifting score
numbers and screen-shake decay; `juice.svelte.ts` is its reactive front end and `JuiceLayer.svelte`
is mounted once in the root layout. Any mode can call `juice.burst()`, `juice.float()` or
`juice.shake()` without its own effects code. `src/lib/game/physics.ts` wraps planck with a fixed
time step, sleeping bodies and a debug draw for modes that need rigid bodies. Both respect
`prefers-reduced-motion`.

### Generated artwork

The pictures under `static/cards/`, `static/og/` and `static/icons/` are generated, not hand-edited:

```sh
bun run dev                                  # in one terminal
bun scripts/generate-card-screenshots.ts http://localhost:3021
bun scripts/generate-og-images.ts
```

`brand/app-icon.svg` and `brand/app-icon-maskable.svg` are the single source for the PWA icons; see
`brand/README.md` for the rest of the Telegram artwork. Card captures hide the shared game shell so
only gameplay shows in the background of a mode card.

## Commit plan

1. `chore: scaffold Chokepoint Chaos with start screen`
2. `feat: add shared services and game-over cameo`
3. `feat(blocks): add Block Puzzle mode`
4. `feat(minefield): add Minefield mode`
5. `feat(merge): add Merge Tankers mode`
6. `feat(convoy): add Convoy Runner mode`
7. `feat(shootdown): add Shahed Shootdown mode`
8. `feat(pipeline): add Pipeline Panic mode`
9. `feat(flamingo): add Flamingo Flight mode`
10. `feat(fury): add Feathered Fury mode`
11. `feat: add About page with artist credit and privacy notice`
12. `feat: add consent management and Google H5 Games Ads on game over`
13. `feat: add Progressive Web App support and generated icons`
14. `chore: final polish, right-to-left review, and deployment configuration`

Each step is a separate commit that leaves the repository in a working state. The ninth mode, 4D Chess
(`feat(chess): add 4D Chess mode`), is a chess match against Putin with event cards; it was added after
Feathered Fury.
