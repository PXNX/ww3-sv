# Brand

The World War 3 artwork that is not served by the app itself: sources of the icons and the pictures uploaded to Telegram. All of it is the same globe bomb (the world as a cartoon bomb with a lit fuse).

| File | Use |
| --- | --- |
| `app-icon.svg` | Source of `static/icons/icon-192.png`, `icon-512.png` and `apple-touch-icon.png` |
| `app-icon-maskable.svg` | Source of `static/icons/icon-maskable-512.png` (art inside the safe circle) |
| `splash.svg` | Splash screen icon, 512×512, on the sunburst background |
| `loading.svg` | Loading screen icon, 512×512 on transparency (BotFather › Mini App › Loading Screen); `#fuse` and `#spark` can be animated. Background: `#e8e1bc` in light mode, `#16213a` in dark mode |
| `telegram-description.svg` / `.png` | The picture above the bot's description in an empty chat (640×360, BotFather › Edit Bot › Edit Description Picture) |
| `telegram-profile.jpg` | The bot's profile photo, as set by `/set_cmd` (source: `mn/ptb-ww3/res/icon.svg`) |

`static/favicon.svg` is the version for browser tabs.

Render the description picture with `bun scripts/generate-brand.ts` (uses the Baloo font from `static/fonts` through a headless Chromium).
