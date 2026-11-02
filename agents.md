# Agent rules

- Every feature change must be committed automatically before ending the turn. No uncommitted feature work left behind.
- Commit feature by feature: one coherent slice per commit (rules layer, store, UI + messages, tests), never one big dump.
- Use the prefixes: `feat(<mode>)`, `fix(<mode>)`, `chore(<mode>)`, `docs(<mode>)`, `refactor(<mode>)`; `<mode>` is the game / system touched (e.g. `hackers`, `profile`, `settings`, `tycoon`, `recon`).
- Push each slice to the remote as soon as it is committed — branch never ahead of `origin`.
- If work was interrupted, pick up exactly where it left off; do not summarize prior turns to the user.
