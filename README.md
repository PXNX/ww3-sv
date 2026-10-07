# World War 3

A satirical cartoon puzzle and arcade collection about oil, shipping, and geopolitics, built as a
SvelteKit Progressive Web App. Eight game modes are planned; they are added one commit at a time
(see the commit plan below). There is no backend, no database, and no account system: scores and
settings stay in the browser's local storage.

## Tech stack

- SvelteKit with Svelte 5 runes, deployed with `@sveltejs/adapter-vercel`
- Tailwind CSS and daisyUI (custom `ww3` theme)
- unplugin-icons with the Fluent, Lucide, Fluent Emoji, and Circle Flags icon sets (bundled locally)
- inlang Paraglide JS for English, German, Ukrainian, Russian, Persian, and Arabic (Persian and Arabic are right-to-left)
- Vitest for pure logic unit tests
- Bun 1.4.2 as package manager and local runtime
- Self-hosted Baloo 2 display font (SIL Open Font License) under `static/fonts/`

## Setup

```sh
bun install --frozen-lockfile
bun run dev
```

The development server runs on <http://localhost:3021>.

## Scripts

| Script                 | Purpose                                                           |
| ---------------------- | ----------------------------------------------------------------- |
| `bun run dev`          | Development server                                                |
| `bun run check`        | Compiles the message files, then Svelte and TypeScript type check |
| `bun run lint`         | Prettier check and ESLint                                         |
| `bun run format`       | Formats all files with Prettier                                   |
| `bun run test`         | Vitest unit tests (single run)                                    |
| `bun run test:watch`   | Vitest in watch mode                                              |
| `bun run build`        | Production build using the Vercel adapter                         |
| `bun run preview`      | Serves the production build locally                               |
| `bun run i18n:compile` | Regenerates `src/lib/paraglide/` from `messages/`                 |

Before every commit, all of these must pass: `bun install --frozen-lockfile`, `bun run check`,
`bun run lint`, `bun run test`, and `bun run build`.

## Project layout

```
messages/{en,de,fa,ar,uk,ru}.json translatable strings (key parity is enforced by a unit test)
project.inlang/settings.json   inlang project configuration
src/lib/modes/registry.ts      single list of game modes; the start screen renders from it
src/lib/theme/character.ts     swappable mascot configuration (name, poses, asset paths)
src/lib/styles/tokens.css      design tokens and font faces
src/lib/styles/playful.css     tilt, bounce, and press interaction styles
src/lib/components/            shared components (mode select, mascot, locale switcher)
src/routes/+page.svelte        start screen
static/assets/mascot/          mascot artwork, one SVG per pose
static/assets/cameos/          cameo portraits, one SVG per cameo id
static/fonts/                  self-hosted font files and license
```

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

Each step is a separate commit that leaves the repository in a working state.
