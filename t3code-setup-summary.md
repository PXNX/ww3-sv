# T3 Code setup — root@apps + nyx@mn (2026-10-31)

## Completed
- T3 Code updated 0.0.45/0.42 → 0.1.5 (service install/restart; stale drop-in removed on apps; old t3 processes killed on mn)
- Services active: apps (127.0.0.1:3773, root), mn (100.77.119.32:3773, nyx, systemd linger=yes)
- OpenCode CLI installed: apps (1.19.5), mn (1.19.5)
- Provider model verified: opencode/deepseek-v4.1-flash-free (Zen) visible
- OpenRouter auth present locally (opencode auth list); remotes need mirroring

## Not completed / needs user / secret
- Zen model key on remotes → timeouts
- T3 Connect pairing (`t3 connect link`) + environment link (beta) for cross-machine delegation
