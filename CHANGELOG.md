# Changelog

All notable changes to the game. Entries are grouped by change type and by the part of the game they
touch; `scripts/release.ts` cuts each release from the Unreleased section below and the Conventional
Commits since the last tag. The in-app version history and public `/changelog` page read this file.

## Unreleased

### New

#### shop

- A `PRO6M` gift code that grants six months of Pro and five revival tokens once per Telegram
  account, redeemable from a bot link, a Mini App link or the supply depot
- Pro players get a warm gold wash and a slow sheen on the page, and the gift confirmation names the
  exact date Pro runs to

#### warroom

- Pro grants a second council directive every day, so a campaign can move faster without changing
  what a directive costs

#### fleethunt

- Pro adds a few extra shots and one more sonar scan to each day's supply, so a hunt lasts longer

#### convoy

- Ship choice before a run: the tanker is balanced, the corvette trades a heart for speed and a
  narrower silhouette, and the tug is slow but efficient and starts with an escort

#### balloon

- Photos are now scored on altitude, framing and weather, shown after each snap, so lining up a
  good shot pays more than a drive-by
- A forecast strip before launch shows the first two wind patterns to help plan the climb

#### vault

- A heist timer: the vault locks when time runs out even with hearts left; matches buy time, the
  bonus pair buys more, and mismatches cost it
- The banker glances towards the side of the grid hiding the gold-and-cheese pair until it is found

#### tycoon

- Delivery contracts: a time-limited barrel target that pays a cash reward and a small permanent
  output bonus, offered again after each run
- Pro extends away-time earnings to a 24-hour shift credited at full speed
- The bank now shows the active contract's progress and time, and toasts announce new, completed
  and missed contracts

#### beachhead

- Squad synergies: boats carrying complementary troops hit harder — combined arms, fire support,
  field medics and breach-and-clear — with the active ones listed in the landing party sheet

## v1.6.0 - 2026-11-28

Interactive how-to-play walkthroughs in every game, with spotlights on the controls they describe.

### New

#### beachhead

- The two commanders are now animated 3D renders from Blender: the Azov commander raises his pistol
  and pennant, Prigozhin swings his hammer and heals, on their hero screens and picker cards

#### changelog

- An in-app version history sheet and a public changelog page
- Entries grouped by change type and by the part of the game they touch

#### shop

- Agent looks for Telegram Stars: a tinfoil hat, laser eyes, a gold shirt and neon pink hair, bought once
  and kept on the Telegram account

#### flamingo

- The Crimea bridge is now a big target: fly into it to bring a span down for 150 points

#### telegram

- Search games from any chat in Telegram's inline mode: type `@game_ww3_bot games Flamingo` and open a
  result, with the group's scoreboard in a group and a Mini App play button everywhere else

#### tutorials

- Every game's how-to-play screen is now an interactive walkthrough instead of a wall of text: one
  short tip at a time, a spotlight on the real control it describes, and steps you finish by actually
  using that control
- The wizard has a progress bar, Back, Skip and Next, works with the arrow keys and Escape, and the
  help button reopens it at any time

### Improved

#### slice

- Later waves mix in formation volleys: crossing pairs and V shapes whose arcs are laid out for
  one well-planned swipe

#### merge

- Three optional run goals, drawn each game and paid out on completion: reach a ship tier, clear
  mines, pull off a triple merge or hit a score target

#### maze

- A faint breadcrumb trail shows the route already walked, with the last step picked out
- Bumping into a wall or a locked door now flashes that edge, so a blocked move reads at a glance

#### telegram

- The legal links in the bot (purchase consent, `/impressum`, `/agb`, `/widerruf` and `/datenschutz`) now open the
  translated documents on the game website instead of pages on the bot's own server

#### tutorials

- Steps spotlight the control they actually describe — the board and cards in Chess, the armory in
  Fleet Hunt, the source sliders in Energiewende, the shop tabs in Tycoon and War Room, and the HUD
  counters in many modes — rather than a generic outline of the whole playfield

### Fixed

#### runcomrade

- Every obstacle you hit now costs a heart, and runs get faster and busier sooner

#### telegram

- Telegram Stars purchases go through again: revival tokens, Pro and agent looks can be bought in the
  Mini App and in the bot, with the catalogue no longer held back by the operator data
- Games opened from a group chat drop the back button and use a slimmer banner, and their playfields fit
  the height of Telegram's game browser instead of running off the bottom
- The score in a game's banner is readable again

#### tutorials

- Tutorial steps work from the very first visit, before the game is started: tapping the highlighted
  Start or Resume overlay counts as doing the step and starts the game at the same time
- Closing the walkthrough in Curling, Shuffle, Slider and Tycoon resumes the game again instead of
  leaving it paused

## v1.5.0 - 2026-11-17

A mission-board home screen, small new toys in several modes and a fresh art pass.

### New

#### home

- The start screen is now a mission board, with games grouped by playstyle and a leaner profile
- Game cards stay on a dark stage and the start screen no longer scrolls sideways

#### physics

- A shared fixed-step physics world that every game mode builds on
- Particle effects and joyful feedback shared across all modes

#### convoy

- A fuel meter that tankers refill by driving through barrels

#### maze

- A shared daily building with its own best time

#### slider

- A rival campaign the press conference can push back

#### flamingo

- A rare Crimea bridge that is worth a lot of points

#### parking

- One hint per level, now finished

#### telegram

- A mock login with a fake bot database for local development

#### ui

- A refreshed game frame without sideways scrollbars

#### assets

- The canonical brand bomb for the PWA, regenerated game cards and missing link previews

#### telemetry

- A local-only event log with an in-app dashboard

### Fixed

#### flamingo

- Crashes into the Crimea bridge are labelled

#### dark

- Better contrast and readability in the night theme

## v1.4.0 - 2026-11-11

Crossovers between the games, group play with chat leaderboards and a full Beachhead base builder.

### New

#### beachhead

- A sea-map base builder: place, move and upgrade buildings and defences, train troops and heroes, socket crystals and raid other players' islands
- Hero screens for the Azov commander and Prigozhin, with troop and support skills upgraded in the lab
- Round timers, rising prices, bigger storage, expeditions with reward chests and a defence test for your own base

#### hackers

- A green terminal with a boot sequence and typed output, contracts against systems from the other modes and a bank of DogeLite
- Hardware and software shops, favourites, a mail archive and terminal easter eggs
- Other players' dossiers, a firewall log with a hack-back button and thefts taken from their banks

#### telegram

- Group games with chat leaderboards across sixteen more arcade modes
- A rewritten bot with payments, invites, streak reminders and its own server for raids and hacks between players
- When a group run beats someone's best, your agent runs past them on the result sheet's leaderboard

#### crossover

- Gifts between the games: Prigozhin's hammer for the raids, crystals for Beachhead, Fake News and DogeLite from hacking
- The Matrix coat for finding the whole hacker network

#### cloud

- Mirror progress to your Telegram account, with a transfer link that carries browser progress over

#### rivals

- A server contract and a validated client for raiding and hacking other players

### Fixed

#### rivals

- Skip a rival entry the client cannot read instead of dropping the whole list

#### bot

- An invite link makes two players friends, and the bot answers the friends and presence calls the app already makes

## v1.3.0 - 2026-11-04

The five-mode pass: the new arcades made playable, animated and translated.

### New

#### games

- New modes: Grain Corridor, Shadow Fleet Shuffle, Iceberg Curling, Starlink Kill Switch, Recon, Iron Dome, Falklands, Fleet Hunt, GPS Liar and Purrpentagram
- Curling gets two stones per end with sweep, curl, gambles, hazards and scored rings
- Slice is reworked into an approval-rating survival game with rallies, scandals and a press conference
- Warroom gets a crisis desk, council directives, escalating pacts and a ranked result screen
- Grain Corridor, Shadow Fleet Shuffle and Kill Switch get canvas playfields, waves and star ratings

#### hackers

- A fullscreen green terminal with a boot sequence, typed output, glitches and flashes
- A persistent profile with a bank, hardware and favourites, plus a shop for software and upgrades

#### recon

- FPV, satellite and UAV views with their own zoom, HUD and camera controls
- Thermal vision, artillery barrages, ground orders, moving contacts and hidden bunkers

#### sound

- Sounds and haptics for the remaining effects and every mode in the pass

#### pwa

- A new-version nudge that appears as a bottom sheet

#### i18n

- Missing strings for the new modes in all six languages

## v1.2.0 - 2026-10-31

A wave of rebuilt classics and a first set of brand-new modes.

### New

#### recon

- Procedural terrain and solvable sorties that scale with the sortie number
- A sortie engine with lock-on, strikes, collateral damage, AA fire and scoring

#### hackers

- Hermit Hackers rebuilt around breaking into a system, with a retro terminal and a crypto wallet

#### killswitch

- Starlink Kill Switch rebuilt as a canvas reaction game

#### games

- Shadow Fleet Shuffle, plus fresh cards for every new mode on the play page

#### tycoon

- Producer tiers, new events, a turbo perk and a fullscreen offline earnings overview

### Fixed

#### i18n

- Missing Oil Tycoon translations in all six languages

## v1.1.0 - 2026-10-29

Telegram sign-in, a custom agent, the raid and Oil Tycoon.

### New

#### telegram

- A bot with Stars payments, invites, streak reminders and legal pages
- Mini App sign-in, with the Telegram profile and streak passed to the bot
- Group games with chat leaderboards, starting with Block Puzzle

#### profile

- A customizable cartoon agent and a profile page to dress it up
- Looks unlocked by playing, by streaks and by levelling, plus ready-made presets
- Invite friends from the profile and earn a revival token for each one who starts the bot

#### raid

- A mo.co-style HUD, leave and result screens, weapon pages and a minimap
- New weapons, skills and armour perks, elite bosses and sandstorms
- Squad links shared through Telegram and a season of rewards

#### tycoon

- Oil Tycoon with producers, upgrade tiers, achievements and avatar hats
- Producer countdowns and rates, critical taps and nationalisation

#### career

- Revivals bought with Telegram Stars, a daily reward and double XP for Pro players
- A near-miss offer of a revival instead of an advert

#### social

- Gift codes in a leaner shop, with referrals, squads and friends kept apart

#### legal

- Imprint, privacy, terms and withdrawal pages, each with its own link preview

#### brand

- A globe-bomb app icon and a Telegram splash icon

### Fixed

#### layout

- Game controls stay clear of Telegram's fullscreen buttons

## v1.0.0 - 2026-10-27

The first public build: the game collection, the career and the Telegram bot.

### New

#### games

- Dozens of playable modes, from chess and maze to Beachhead and the supply convoys

#### bot

- Telegram play with friends, raids on Beachhead bases and hacking other players' rigs

#### career

- Personal records, streaks, coins and a shop across every mode
