# Cloud save: bot server contract

Inside Telegram the game mirrors the whole progress to the bot's server; in a normal browser it offers carrying the progress into Telegram. Client: `src/lib/services/cloudSave.ts` and `src/lib/stores/cloudSave.svelte.ts`. Transport, identity and envelope as in `docs/squad-api.md`.

A **snapshot** is an object of the raw local storage values by key (without the `ww3:` prefix), `Record<string, string>`. The server stores it opaquely, at most **512 KiB** of JSON per player, and refuses bigger ones with code `TOO_LARGE`.

| Name                | Auth     | Input                | Result                                           | Errors           |
| ------------------- | -------- | -------------------- | ------------------------------------------------ | ---------------- |
| `progress_load`     | initData | `{}`                 | `{ data: Snapshot \| null, updated_at: number }` | none             |
| `progress_save`     | initData | `{ data: Snapshot }` | `{ updated_at: number }` (server time, ms)       | `TOO_LARGE`      |
| `progress_transfer` | **none** | `{ data: Snapshot }` | `{ code: string, expires_at: number }`           | `TOO_LARGE`      |
| `progress_import`   | initData | `{ code: string }`   | `{ data: Snapshot }`                             | `INVITE_EXPIRED` |

- `progress_transfer` is called from a normal browser through `POST ${VITE_TELEGRAM_API_URL}/api/progress_transfer` without the init-data header. The code matches `[A-Za-z0-9_-]{6,40}`, is valid for **30 minutes** and can be claimed **once**; rate-limit it per IP. The browser then opens `https://t.me/<bot>?startapp=import_<code>`.
- `progress_import` hands the snapshot to the account that claims it and deletes it. It does not store it as the account's save; the client asks the player first and then calls `progress_save`.
- Conflict rule on launch (client side): an empty account gets the device's progress; a device that never synced gets the account's; otherwise the newer side (last local change vs. `updated_at`) wins.
- Privacy: the snapshot is the player's game progress, tied to their Telegram id. The privacy notice needs a line about it, and the server deletes it on request.
