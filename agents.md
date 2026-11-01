# Agent rules

- Every feature change must be committed automatically by the agent before ending the turn. No uncommitted feature work should be left behind.
- Commit feature by feature: one coherent slice per commit (rules layer, store, UI plus messages, tests), never one big dump. Use a `feat(<area>): ...` subject that says what the slice does.
- Push each slice to the remote as soon as it is committed, so the branch is never left ahead of `origin`.
